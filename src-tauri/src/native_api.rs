//! The two sing-box StartedService RPCs used by WinBox (sing-box >= 1.14).
//! gRPC-Web transport reuses reqwest; protobuf encoding is handled by prost.
use prost::Message;
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr, TcpListener};
use std::time::Duration;

const MAX_FRAME: usize = 64 * 1024;

pub struct Api {
    client: reqwest::Client,
    base: String,
    secret: Option<String>,
}

#[derive(Clone, PartialEq, Message)]
pub struct Version {
    #[prost(string, tag = "1")]
    pub version: String,
}

#[derive(Clone, PartialEq, Message)]
pub struct Status {
    #[prost(bool, tag = "5")]
    pub traffic_available: bool,
    #[prost(int64, tag = "6")]
    pub uplink: i64,
    #[prost(int64, tag = "7")]
    pub downlink: i64,
}

#[derive(Clone, PartialEq, Message)]
struct SubscribeStatus {
    // The server interprets this value as a Go time.Duration (nanoseconds).
    #[prost(int64, tag = "1")]
    interval: i64,
}

impl Api {
    pub fn new(base: String, secret: Option<String>) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| "Cannot create native API client")?;
        Ok(Self {
            client,
            base,
            secret,
        })
    }

    async fn call(&self, method: &str, payload: &[u8]) -> Result<Stream, String> {
        let mut body = vec![0];
        body.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        body.extend_from_slice(payload);
        let mut request = self
            .client
            .post(format!("{}/daemon.StartedService/{method}", self.base))
            .header("content-type", "application/grpc-web+proto")
            .header("x-grpc-web", "1")
            .body(body);
        if let Some(secret) = &self.secret {
            request = request.bearer_auth(secret);
        }
        let response = request
            .send()
            .await
            .map_err(|_| "Native API connection failed")?;
        if !response.status().is_success() {
            return Err(format!("Native API HTTP status {}", response.status()));
        }
        if let Some(status) = response.headers().get("grpc-status") {
            if status != "0" {
                return Err("Native API rejected the request (check authentication)".into());
            }
        }
        if !response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| {
                v == "application/grpc-web" || v.starts_with("application/grpc-web+proto")
            })
        {
            return Err("Expected sing-box native API (requires sing-box 1.14 or newer)".into());
        }
        Ok(Stream {
            response,
            buffer: Vec::new(),
            ended: false,
        })
    }

    pub async fn version(&self) -> Result<Version, String> {
        let mut stream = self.call("GetVersion", &[]).await?;
        let bytes = stream.next().await?.ok_or("Missing native API version")?;
        let version =
            Version::decode(bytes.as_slice()).map_err(|_| "Invalid native API version")?;
        if version.version.is_empty() || stream.next().await?.is_some() {
            return Err("Invalid native API version response".into());
        }
        Ok(version)
    }

    pub async fn subscribe(&self) -> Result<Stream, String> {
        self.call(
            "SubscribeStatus",
            &SubscribeStatus {
                interval: 1_000_000_000,
            }
            .encode_to_vec(),
        )
        .await
    }
}

pub struct Stream {
    response: reqwest::Response,
    buffer: Vec<u8>,
    ended: bool,
}

impl Stream {
    pub async fn next(&mut self) -> Result<Option<Vec<u8>>, String> {
        if self.ended {
            return Ok(None);
        }
        loop {
            if let Some((flags, payload)) = take_frame(&mut self.buffer)? {
                if flags == 128 {
                    self.ended = true;
                    let trailers =
                        std::str::from_utf8(&payload).map_err(|_| "Invalid gRPC trailers")?;
                    let status = trailers
                        .lines()
                        .filter_map(|line| line.split_once(':'))
                        .find(|(key, _)| key.eq_ignore_ascii_case("grpc-status"))
                        .map(|(_, value)| value.trim());
                    if status != Some("0") {
                        return Err("Native API stream ended with an error".into());
                    }
                    if !self.buffer.is_empty() {
                        return Err("Data after gRPC trailers".into());
                    }
                    return Ok(None);
                }
                return Ok(Some(payload));
            }
            let chunk = self
                .response
                .chunk()
                .await
                .map_err(|_| "Native API stream read failed")?
                .ok_or("Native API stream closed without trailers")?;
            // Bound both an incomplete frame and a transport chunk before copying.
            if self.buffer.len() + chunk.len() > MAX_FRAME * 2 {
                return Err("Native API response exceeds the size limit".into());
            }
            self.buffer.extend_from_slice(&chunk);
        }
    }

    pub async fn status(&mut self) -> Result<Option<Status>, String> {
        tokio::time::timeout(Duration::from_secs(5), self.next())
            .await
            .map_err(|_| "Native API traffic sample timed out".to_owned())??
            .map(|bytes| {
                Status::decode(bytes.as_slice()).map_err(|_| "Invalid native API status".into())
            })
            .transpose()
    }
}

fn take_frame(buffer: &mut Vec<u8>) -> Result<Option<(u8, Vec<u8>)>, String> {
    if buffer.len() < 5 {
        return Ok(None);
    }
    let flags = buffer[0];
    if !matches!(flags, 0 | 128) {
        return Err("Unsupported gRPC frame flags".into());
    }
    let length = u32::from_be_bytes(buffer[1..5].try_into().unwrap()) as usize;
    if length > MAX_FRAME {
        return Err("Native API frame exceeds the size limit".into());
    }
    if buffer.len() < length + 5 {
        return Ok(None);
    }
    let payload = buffer[5..length + 5].to_vec();
    buffer.drain(..length + 5);
    Ok(Some((flags, payload)))
}

fn controller_address(value: &str) -> Result<SocketAddr, String> {
    let value = if value.starts_with(':') {
        format!("0.0.0.0{value}")
    } else if let Some(port) = value.strip_prefix("localhost:") {
        format!("127.0.0.1:{port}")
    } else {
        value.to_owned()
    };
    let mut address: SocketAddr = value
        .parse()
        .map_err(|_| "API listener must use an IP address and nonzero port")?;
    if address.port() == 0 {
        return Err("API listener port must not be zero".into());
    }
    if address.ip().is_unspecified() {
        address.set_ip(if address.is_ipv4() {
            std::net::Ipv4Addr::LOCALHOST.into()
        } else {
            std::net::Ipv6Addr::LOCALHOST.into()
        });
    }
    Ok(address)
}

fn service_address(service: &Value) -> Result<SocketAddr, String> {
    let host = service
        .get("listen")
        .and_then(Value::as_str)
        .unwrap_or("::");
    let ip: IpAddr = if host == "localhost" {
        std::net::Ipv4Addr::LOCALHOST.into()
    } else {
        host.parse()
            .map_err(|_| "Native API listener must use an IP address")?
    };
    let port = service
        .get("listen_port")
        .and_then(Value::as_u64)
        .and_then(|p| u16::try_from(p).ok())
        .filter(|p| *p > 0)
        .ok_or("Native API requires a nonzero listen_port")?;
    controller_address(&SocketAddr::new(ip, port).to_string())
}

fn tls_enabled(service: &Value) -> bool {
    service
        .pointer("/tls/enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

pub fn prepare(config: &mut Value) -> Result<(SocketAddr, Option<String>), String> {
    let object = config
        .as_object_mut()
        .ok_or("Configuration must be an object")?;
    let services = object.entry("services").or_insert_with(|| json!([]));
    if services.is_null() {
        *services = json!([]);
    }
    let services = services.as_array_mut().ok_or("services must be an array")?;
    // A TLS-only public listener may require a private CA/client certificate.
    // Use a private local listener in that case; never weaken its TLS policy.
    for service in services.iter() {
        if service["type"] == "api" && !tls_enabled(service) {
            if let Ok(address) = service_address(service) {
                let secret = service["secret"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .map(str::to_owned);
                return Ok((address, secret));
            }
        }
    }
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|_| "Cannot reserve native API port")?;
    let address = listener
        .local_addr()
        .map_err(|_| "Cannot read native API port")?;
    let secret = uuid::Uuid::new_v4().to_string();
    services.push(
        json!({"type":"api", "listen":"127.0.0.1", "listen_port":address.port(), "secret":secret}),
    );
    Ok((address, Some(secret)))
}

pub fn dashboard_url(config: &Value) -> Result<Option<String>, String> {
    if let Some(services) = config["services"].as_array() {
        for service in services {
            let dashboard = &service["dashboard"];
            let enabled = dashboard.as_bool().unwrap_or(false)
                || dashboard.is_string()
                || dashboard["enabled"].as_bool().unwrap_or(false);
            if service["type"] == "api" && enabled {
                let scheme = if tls_enabled(service) {
                    "https"
                } else {
                    "http"
                };
                return Ok(Some(format!("{scheme}://{}/", service_address(service)?)));
            }
        }
    }
    let clash = &config["experimental"]["clash_api"];
    if clash["external_ui"].as_str().is_some_and(|s| !s.is_empty()) {
        let address = controller_address(
            clash["external_controller"]
                .as_str()
                .ok_or("Clash dashboard requires a controller")?,
        )?;
        return Ok(Some(format!("http://{address}/ui/")));
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn response_fixture(
        body: Vec<u8>,
        headers: &str,
        fragment: bool,
    ) -> (Api, tokio::task::JoinHandle<()>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let headers = headers.to_owned();
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            loop {
                let mut bytes = [0; 1024];
                let count = socket.read(&mut bytes).await.unwrap();
                assert!(count > 0);
                request.extend_from_slice(&bytes[..count]);
                if request.windows(4).any(|s| s == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request).to_ascii_lowercase();
            assert!(request.contains("/daemon.startedservice/"));
            assert!(request.contains("authorization: bearer fixture-secret"));
            let header=format!("HTTP/1.1 200 OK\r\nContent-Type: application/grpc-web+proto\r\n{headers}Content-Length: {}\r\nConnection: close\r\n\r\n",body.len());
            socket.write_all(header.as_bytes()).await.unwrap();
            if fragment {
                for part in body.chunks(2) {
                    if socket.write_all(part).await.is_err() {
                        break;
                    }
                    tokio::task::yield_now().await;
                }
            } else {
                let _ = socket.write_all(&body).await;
            }
        });
        (
            Api::new(format!("http://{address}"), Some("fixture-secret".into())).unwrap(),
            task,
        )
    }

    fn frame(flags: u8, payload: &[u8]) -> Vec<u8> {
        let mut result = vec![flags];
        result.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        result.extend_from_slice(payload);
        result
    }

    #[tokio::test]
    async fn grpc_transport_validates_authentication_trailers_eof_and_fragmented_samples() {
        let version = Version {
            version: "1.14.3".into(),
        }
        .encode_to_vec();
        let mut valid = frame(0, &version);
        valid.extend(frame(128, b"grpc-status: 0\r\n"));
        let (api, task) = response_fixture(valid, "", true).await;
        assert_eq!(api.version().await.unwrap().version, "1.14.3");
        task.await.unwrap();
        for (body, headers) in [
            (frame(0, &version), ""),
            (frame(128, b"grpc-status: 16\r\n"), ""),
            (vec![], "grpc-status: 16\r\n"),
            (vec![0, 0, 2, 0, 0], ""),
            (vec![0, 0, 0, 0, 4, 1], ""),
        ] {
            let (api, task) = response_fixture(body, headers, true).await;
            assert!(api.version().await.is_err());
            task.await.unwrap();
        }
        let sample = Status {
            traffic_available: true,
            uplink: 123,
            downlink: 456,
        };
        let mut body = frame(0, &sample.encode_to_vec());
        body.extend(frame(0, &Status::default().encode_to_vec()));
        body.extend(frame(128, b"grpc-status: 0\r\n"));
        let (api, task) = response_fixture(body, "", true).await;
        let mut stream = api.subscribe().await.unwrap();
        assert_eq!(stream.status().await.unwrap(), Some(sample));
        assert_eq!(stream.status().await.unwrap(), Some(Status::default()));
        assert_eq!(stream.status().await.unwrap(), None);
        task.await.unwrap();
    }

    #[tokio::test]
    async fn silent_native_stream_has_a_sample_deadline_and_is_cancellable() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = [0; 2048];
            let _ = socket.read(&mut bytes).await.unwrap();
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/grpc-web+proto\r\nTransfer-Encoding: chunked\r\n\r\n").await.unwrap();
            tokio::time::sleep(Duration::from_secs(30)).await;
        });
        let api = Api::new(format!("http://{address}"), None).unwrap();
        let mut stream = api.subscribe().await.unwrap();
        assert!(
            tokio::time::timeout(Duration::from_millis(50), stream.status())
                .await
                .is_err()
        );
        assert_eq!(
            stream.status().await.unwrap_err(),
            "Native API traffic sample timed out"
        );
        drop(stream);
        task.abort();
        assert!(task.await.unwrap_err().is_cancelled());
    }

    #[test]
    fn configuration_handles_tls_private_monitoring_and_invalid_panel_addresses() {
        let mut tls = json!({"services":[{"type":"api","listen":"127.0.0.1","listen_port":9443,"tls":{"enabled":true},"dashboard":true}]});
        let original = tls["services"][0].clone();
        let (address, secret) = prepare(&mut tls).unwrap();
        assert!(address.ip().is_loopback() && secret.is_some());
        assert_eq!(tls["services"][0], original);
        assert_eq!(tls["services"].as_array().unwrap().len(), 2);
        assert_eq!(
            dashboard_url(&tls).unwrap().as_deref(),
            Some("https://127.0.0.1:9443/")
        );
        for invalid in [json!(0), json!(65536), json!("9090")] {
            tls["services"][0]["listen_port"] = invalid;
            assert!(dashboard_url(&tls).is_err());
        }
        assert!(prepare(&mut json!({"services":null})).is_ok());
        assert!(prepare(&mut json!({"services":{}})).is_err());
        assert_eq!(dashboard_url(&json!({"services":[{"type":"api","listen_port":9090,"dashboard":{"enabled":false}}]})).unwrap(),None);
        assert_eq!(
            controller_address(":9090").unwrap().to_string(),
            "127.0.0.1:9090"
        );
    }
    #[test]
    fn frames_and_protobuf_handle_fragmentation_unknown_fields_and_limits() {
        let mut data = vec![0, 0, 0, 0, 4, 0x30];
        assert!(take_frame(&mut data).unwrap().is_none());
        data.extend([123, 0x38, 45, 128, 0, 0, 0, 0]);
        let (_, payload) = take_frame(&mut data).unwrap().unwrap();
        let status = Status::decode(payload.as_slice()).unwrap();
        assert_eq!((status.uplink, status.downlink), (123, 45));
        assert_eq!(take_frame(&mut data).unwrap(), Some((128, vec![])));
        assert!(take_frame(&mut vec![0, 0, 2, 0, 0]).is_err());
        assert!(take_frame(&mut vec![1, 0, 0, 0, 0]).is_err());
        assert!(Status::decode(&[0x30][..]).is_err());
        assert!(Status::decode(&[0x50, 1][..]).is_ok());
    }

    #[test]
    fn native_and_clash_dashboards_keep_addresses_paths_and_secrets_separate() {
        for dashboard in [
            json!(true),
            json!("custom-directory"),
            json!({"enabled":true}),
        ] {
            let config = json!({"services":[{"type":"api","listen":"::","listen_port":9443,"tls":{"enabled":true},"secret":"hidden","dashboard":dashboard}]});
            assert_eq!(
                dashboard_url(&config).unwrap().as_deref(),
                Some("https://[::1]:9443/")
            );
        }
        let mut config = json!({"experimental":{"clash_api":{"external_controller":"localhost:9999","external_ui":"different-directory","secret":"keep"}}});
        assert_eq!(
            dashboard_url(&config).unwrap().as_deref(),
            Some("http://127.0.0.1:9999/ui/")
        );
        let old_clash = config["experimental"].clone();
        let (address, secret) = prepare(&mut config).unwrap();
        assert!(address.ip().is_loopback());
        assert!(secret.is_some());
        assert_eq!(config["experimental"], old_clash);
        assert_eq!(prepare(&mut config).unwrap(), (address, secret));
        config["services"][0]["dashboard"] = json!(true);
        assert_eq!(
            dashboard_url(&config).unwrap(),
            Some(format!("http://{address}/"))
        );
        assert_eq!(dashboard_url(&json!({})).unwrap(), None);
        assert!(controller_address("127.0.0.1:0").is_err());
    }
}
