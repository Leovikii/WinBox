//! Feed the authenticated handoff's in-memory package to the official updater.
//! Its public API requires HTTP for check/download; no external network or disk cache.
use std::{io, sync::Arc, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub const MAX_BYTES: usize = 512 * 1024 * 1024;

pub struct LocalPackage {
    pub endpoint: reqwest::Url,
    worker: tokio::task::JoinHandle<()>,
}

impl Drop for LocalPackage {
    fn drop(&mut self) {
        self.worker.abort();
    }
}

impl LocalPackage {
    pub async fn serve(version: &str, signature: &str, bytes: Arc<Vec<u8>>) -> io::Result<Self> {
        if bytes.is_empty() || bytes.len() > MAX_BYTES {
            return Err(io::Error::other("Invalid update package size"));
        }
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let token = uuid::Uuid::new_v4();
        let base = format!("http://{}/{token}", listener.local_addr()?);
        let metadata = serde_json::to_vec(&serde_json::json!({
            "version": version,
            "platforms": { "windows-x86_64-nsis": {
                "url": format!("{base}/installer"), "signature": signature
            }}
        }))?;
        let endpoint =
            reqwest::Url::parse(&format!("{base}/metadata")).map_err(io::Error::other)?;
        let worker = tokio::spawn(async move {
            let _ = tokio::time::timeout(Duration::from_secs(60), async move {
                // Exactly the two official updater requests; unknown paths fail closed.
                for (path, body) in [("metadata", metadata.as_slice()), ("installer", bytes.as_slice())] {
                    let (mut stream, _) = listener.accept().await?;
                    let mut header = Vec::new();
                    while !header.ends_with(b"\r\n\r\n") && header.len() < 8192 {
                        header.push(stream.read_u8().await?);
                    }
                    let expected = format!("GET /{token}/{path} HTTP/1.1\r\n");
                    if !header.starts_with(expected.as_bytes()) || !header.ends_with(b"\r\n\r\n") {
                        return Err(io::Error::other("Invalid local updater request"));
                    }
                    stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).as_bytes()).await?;
                    stream.write_all(body).await?;
                    stream.shutdown().await?;
                }
                Ok::<(), io::Error>(())
            }).await;
        });
        Ok(Self { endpoint, worker })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn handoff_serves_only_local_metadata_and_exact_package() {
        let bytes = Arc::new(b"verified installer bytes".to_vec());
        let local = LocalPackage::serve("3.0.0-beta.1", "original signature", bytes.clone())
            .await
            .unwrap();
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let metadata: serde_json::Value = client
            .get(local.endpoint.clone())
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(metadata["version"], "3.0.0-beta.1");
        let target = &metadata["platforms"]["windows-x86_64-nsis"];
        assert_eq!(target["signature"], "original signature");
        let url = reqwest::Url::parse(target["url"].as_str().unwrap()).unwrap();
        assert_eq!(url.host_str(), Some("127.0.0.1"));
        let response = client.get(url).send().await.unwrap().bytes().await.unwrap();
        assert_eq!(response.as_ref(), bytes.as_slice());
    }

    #[tokio::test]
    async fn local_package_rejects_unknown_paths_and_closes_on_cancel() {
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let local = LocalPackage::serve("3.0.0-beta.1", "sig", Arc::new(vec![1]))
            .await
            .unwrap();
        let mut wrong = local.endpoint.clone();
        wrong.set_path("/unknown/metadata");
        assert!(client.get(wrong).send().await.is_err());
        let endpoint = local.endpoint.clone();
        drop(local);
        tokio::task::yield_now().await;
        assert!(client.get(endpoint).send().await.is_err());
        assert!(LocalPackage::serve("3.0.0-beta.1", "sig", Arc::new(vec![]))
            .await
            .is_err());
    }
}
