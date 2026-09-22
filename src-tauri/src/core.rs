use std::io::{self, Error, ErrorKind};
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::time::timeout;

use crate::platform::windows::{
    owns_tcp_listener, process_image_matches, request_graceful_exit, validate_core_executable,
};

pub const CORE_STOP_TIMEOUT: Duration = Duration::from_secs(2);

const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct CoreProcess {
    child: Child,
    executable: PathBuf,
    output: Option<mpsc::UnboundedReceiver<String>>,
}

impl CoreProcess {
    pub async fn start(core_dir: &Path) -> io::Result<Self> {
        let core_dir = std::fs::canonicalize(core_dir)?;
        let executable = validate_core_executable(&core_dir.join("sing-box.exe"), &core_dir)?;
        let config = core_dir.join("config.json");
        if !config.is_file() {
            return Err(Error::new(
                ErrorKind::NotFound,
                "sing-box config.json is missing",
            ));
        }

        let mut command = Command::new(&executable);
        command
            .current_dir(&core_dir)
            .args(["run", "-c", "config.json"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            // ponytail: CREATE_NO_WINDOW keeps the backend invisible. If a
            // later sing-box version requires console delivery for graceful
            // stop, replace this with a hidden STARTUPINFOW spawn.
            .creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW);

        let mut child = command.spawn()?;
        let (output_sender, output) = mpsc::unbounded_channel();
        if let Some(stdout) = child.stdout.take() {
            let sender = output_sender.clone();
            std::mem::drop(tokio::spawn(drain_output(stdout, sender)));
        }
        if let Some(stderr) = child.stderr.take() {
            let sender = output_sender.clone();
            std::mem::drop(tokio::spawn(drain_output(stderr, sender)));
        }
        drop(output_sender);

        Ok(Self {
            child,
            executable,
            output: Some(output),
        })
    }

    pub fn id(&self) -> Option<u32> {
        self.child.id()
    }

    pub fn executable(&self) -> &Path {
        &self.executable
    }

    pub async fn wait(&mut self) -> io::Result<ExitStatus> {
        self.child.wait().await
    }

    pub fn try_wait(&mut self) -> io::Result<Option<ExitStatus>> {
        self.child.try_wait()
    }

    pub fn take_output(&mut self) -> Option<mpsc::UnboundedReceiver<String>> {
        self.output.take()
    }

    pub async fn wait_ready(
        &mut self,
        address: std::net::SocketAddr,
        secret: Option<&str>,
        deadline: Duration,
    ) -> io::Result<()> {
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_millis(500))
            .build()
            .map_err(Error::other)?;
        let url = format!("http://{address}/version");
        let ready = async {
            loop {
                if let Some(status) = self.try_wait()? {
                    return Err(Error::other(format!(
                        "sing-box exited before readiness: {status}"
                    )));
                }
                let pid = self
                    .id()
                    .ok_or_else(|| Error::other("sing-box has no process ID"))?;
                if owns_tcp_listener(pid, address)? {
                    let mut request = client.get(&url);
                    if let Some(secret) = secret {
                        request = request.bearer_auth(secret);
                    }
                    if let Ok(response) = request.send().await {
                        if response.status().is_success() {
                            if let Ok(body) = response.json::<serde_json::Value>().await {
                                if body.get("version").and_then(|v| v.as_str()).is_some()
                                    && self.try_wait()?.is_none()
                                    && owns_tcp_listener(pid, address)?
                                {
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        };
        timeout(deadline, ready).await.map_err(|_| {
            Error::new(
                ErrorKind::TimedOut,
                "Timed out waiting for sing-box control API readiness",
            )
        })?
    }

    pub async fn stop(&mut self) -> io::Result<ExitStatus> {
        if let Some(status) = self.child.try_wait()? {
            return Ok(status);
        }

        let process_id = self
            .child
            .id()
            .ok_or_else(|| Error::new(ErrorKind::NotFound, "sing-box process is not running"))?;
        let process = self
            .child
            .raw_handle()
            .ok_or_else(|| Error::new(ErrorKind::NotFound, "sing-box process handle is closed"))?;

        if !process_image_matches(process, &self.executable)? {
            return Err(Error::new(
                ErrorKind::PermissionDenied,
                "refusing to stop a process whose executable path changed",
            ));
        }

        match request_graceful_exit(process_id) {
            Ok(()) => match timeout(CORE_STOP_TIMEOUT, self.child.wait()).await {
                Ok(status) => status,
                Err(_) => self.force_stop().await,
            },
            Err(_) => self.force_stop().await,
        }
    }

    async fn force_stop(&mut self) -> io::Result<ExitStatus> {
        self.child.start_kill()?;
        self.child.wait().await
    }
}

async fn drain_output<R>(reader: R, sender: mpsc::UnboundedSender<String>) -> io::Result<()>
where
    R: AsyncRead + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    while reader.read_line(&mut line).await? != 0 {
        let text = line.trim_end_matches(['\r', '\n']).to_owned();
        if sender.send(text).is_err() {
            break;
        }
        line.clear();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpListener};

    // The test executable is also a controlled child process. No sing-box, system
    // proxy or administrator access is needed for these failure injections.
    #[test]
    fn readiness_child() {
        let Ok(address) = std::env::var("WINBOX_READY_TEST_ADDRESS") else {
            return;
        };
        let mode = std::env::var("WINBOX_READY_TEST_MODE").unwrap();
        if mode == "exit" {
            return;
        }
        if mode == "idle" {
            std::thread::sleep(Duration::from_secs(20));
            return;
        }
        std::thread::sleep(Duration::from_millis(350));
        let listener = TcpListener::bind(address).unwrap();
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let mut request = [0; 4096];
            let length = stream.read(&mut request).unwrap();
            let authenticated = String::from_utf8_lossy(&request[..length])
                .to_ascii_lowercase()
                .contains("authorization: bearer fixture-secret");
            let (status, body) = if authenticated {
                ("200 OK", r#"{"version":"fixture"}"#)
            } else {
                ("401 Unauthorized", "{}")
            };
            let _ = write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    }

    #[tokio::test]
    #[ignore = "requires WINBOX_TEST_CORE pointing to a real Windows x64 sing-box executable"]
    async fn real_core_start_stop_restart_without_system_proxy() {
        let executable = std::env::var_os("WINBOX_TEST_CORE").expect("WINBOX_TEST_CORE");
        let directory =
            std::env::temp_dir().join(format!("winbox-readiness-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::copy(executable, directory.join("sing-box.exe")).unwrap();
        for log in [
            serde_json::json!({"disabled":true}),
            serde_json::json!({"level":"warn"}),
            serde_json::json!({"output":"box.log"}),
        ] {
            let socket = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = socket.local_addr().unwrap();
            drop(socket);
            let controller = if log.get("level").is_some() {
                format!("0.0.0.0:{}", address.port())
            } else if log.get("output").is_some() {
                format!("[::]:{}", address.port())
            } else {
                address.to_string()
            };
            let address = if log.get("output").is_some() {
                SocketAddr::new(std::net::Ipv6Addr::LOCALHOST.into(), address.port())
            } else {
                address
            };
            let config = serde_json::json!({"log":log, "experimental":{"clash_api":{"external_controller":controller,"secret":"fixture-secret"}}});
            std::fs::write(directory.join("config.json"), config.to_string()).unwrap();
            let start = std::time::Instant::now();
            let mut core = CoreProcess::start(&directory).await.unwrap();
            core.wait_ready(address, Some("fixture-secret"), Duration::from_secs(10))
                .await
                .unwrap();
            println!("Real core ready in {:?}; logging={log}", start.elapsed());
            let pid = core.id().unwrap();
            assert!(owns_tcp_listener(pid, address).unwrap());
            core.stop().await.unwrap();
            assert!(core.try_wait().unwrap().is_some());
            assert!(!owns_tcp_listener(pid, address).unwrap());
        }
        std::fs::remove_dir_all(directory).unwrap();
    }

    fn child(address: SocketAddr, mode: &str) -> CoreProcess {
        let executable = std::env::current_exe().unwrap();
        let child = Command::new(&executable)
            .args(["--exact", "core::tests::readiness_child", "--nocapture"])
            .env("WINBOX_READY_TEST_ADDRESS", address.to_string())
            .env("WINBOX_READY_TEST_MODE", mode)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .unwrap();
        CoreProcess {
            child,
            executable,
            output: None,
        }
    }

    #[tokio::test]
    async fn readiness_waits_for_owned_authenticated_api_and_rejects_failures() {
        let reservation = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = reservation.local_addr().unwrap();
        drop(reservation);
        let mut process = child(address, "serve");
        let started = std::time::Instant::now();
        process
            .wait_ready(address, Some("fixture-secret"), Duration::from_secs(5))
            .await
            .unwrap();
        assert!(started.elapsed() >= Duration::from_millis(350));
        assert!(process.try_wait().unwrap().is_none());
        let error = process
            .wait_ready(address, Some("wrong-secret"), Duration::from_millis(300))
            .await
            .unwrap_err();
        assert_eq!(error.kind(), ErrorKind::TimedOut);
        process.stop().await.unwrap();
        assert!(process.try_wait().unwrap().is_some());
        assert!(!owns_tcp_listener(process.id().unwrap_or(0), address).unwrap());

        let mut exited = child(address, "exit");
        let error = exited
            .wait_ready(address, None, Duration::from_secs(5))
            .await
            .unwrap_err();
        assert!(error.to_string().contains("exited before readiness"));

        // A listener owned by this test, not the child, must never satisfy readiness.
        let unrelated = TcpListener::bind(address).unwrap();
        let mut idle = child(address, "idle");
        assert!(owns_tcp_listener(std::process::id(), address).unwrap());
        let error = idle
            .wait_ready(address, None, Duration::from_millis(300))
            .await
            .unwrap_err();
        assert_eq!(error.kind(), ErrorKind::TimedOut);
        idle.stop().await.unwrap();
        drop(unrelated);
    }
}
