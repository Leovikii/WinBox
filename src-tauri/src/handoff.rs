//! One-shot, loopback-only handoff between two copies of this executable.
//! No files, persistent jobs, arbitrary commands, or background helper survive it.
use crate::platform::{privileges, windows::owns_tcp_listener};
use serde::{Deserialize, Serialize};
use std::{
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Action {
    Connect {
        tun_mode: bool,
        sys_proxy: bool,
    },
    Uwp {
        selected: Vec<String>,
        resume: Option<(bool, bool)>,
    },
    Update {
        version: String,
        mirror: String,
    },
}
impl Action {
    pub fn elevated(&self) -> bool {
        !matches!(self, Self::Update { .. })
    }
}
#[derive(Default)]
pub struct HandoffState {
    pub busy: std::sync::atomic::AtomicBool,
    pub initial: Mutex<Option<Action>>,
    pub pending_mode: Mutex<Option<(bool, bool)>>,
}
fn write_message(stream: &mut TcpStream, value: &impl Serialize) -> io::Result<()> {
    let data = serde_json::to_vec(value)?;
    if data.len() > 128 * 1024 {
        return Err(io::Error::other("Handoff payload is too large"));
    }
    stream.write_all(&(data.len() as u32).to_le_bytes())?;
    stream.write_all(&data)
}
fn read_message<T: serde::de::DeserializeOwned>(stream: &mut TcpStream) -> io::Result<T> {
    let mut length = [0; 4];
    stream.read_exact(&mut length)?;
    let length = u32::from_le_bytes(length) as usize;
    if length > 128 * 1024 {
        return Err(io::Error::other("Handoff payload is too large"));
    }
    let mut data = vec![0; length];
    stream.read_exact(&mut data)?;
    Ok(serde_json::from_slice(&data)?)
}
fn timeouts(stream: &TcpStream) -> io::Result<()> {
    // Windows accept inherits the listener's nonblocking mode. Only accept is
    // polled; the framed read/write protocol must wait for the peer's messages.
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))
}

pub fn receive() -> io::Result<Option<Action>> {
    let args: Vec<String> = std::env::args().collect();
    let Some(index) = args.iter().position(|arg| arg == "--handoff") else {
        return Ok(None);
    };
    let parse = || -> Option<(u16, u32, &str)> {
        Some((
            args.get(index + 1)?.parse().ok()?,
            args.get(index + 2)?.parse().ok()?,
            args.get(index + 3)?,
        ))
    };
    let (port, parent, secret) =
        parse().ok_or_else(|| io::Error::other("Invalid handoff arguments"))?;
    uuid::Uuid::parse_str(secret).map_err(io::Error::other)?;
    let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let elevated = privileges::is_elevated()?;
    privileges::verify_peer(parent, !elevated)?;
    if !owns_tcp_listener(parent, address)? {
        return Err(io::Error::other("Invalid handoff listener"));
    }
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(5))?;
    timeouts(&stream)?;
    write_message(&mut stream, &(std::process::id(), secret))?;
    let action: Action = read_message(&mut stream)?;
    if action.elevated() != elevated {
        return Err(io::Error::other("Incorrect handoff privileges"));
    }
    let parent_process = privileges::ParentProcess::open(parent)?;
    write_message(&mut stream, &true)?;
    let committed: bool = read_message(&mut stream)?;
    if !committed {
        return Err(io::Error::other("Handoff cancelled"));
    }
    // ponytail: readiness covers identity/IPC, not WebView creation. If startup recovery
    // becomes required, build the replacement window before committing this handoff.
    parent_process.wait()?;
    Ok(Some(action))
}

pub async fn begin(app: AppHandle, action: Action) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    let state = app.state::<HandoffState>();
    if state.busy.swap(true, Ordering::AcqRel) {
        return Err("A privilege change is already in progress".into());
    }
    let runtime = app.state::<crate::runtime::RuntimeState>();
    let operation = runtime.operation().await;
    let worker = tauri::async_runtime::spawn_blocking(move || -> io::Result<TcpStream> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        listener.set_nonblocking(true)?;
        let secret = uuid::Uuid::new_v4().to_string();
        let args = format!(
            "--handoff {} {} {}",
            listener.local_addr()?.port(),
            std::process::id(),
            secret
        );
        let child = privileges::launch_self(&args, action.elevated())?;
        privileges::verify_peer(child, action.elevated())?;
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    timeouts(&stream)?;
                    let (pid, proof): (u32, String) = read_message(&mut stream)?;
                    if pid != child || proof != secret {
                        return Err(io::Error::other("Invalid handoff response"));
                    }
                    write_message(&mut stream, &action)?;
                    if !read_message::<bool>(&mut stream)? {
                        return Err(io::Error::other("New instance is not ready"));
                    }
                    return Ok(stream);
                }
                Err(error)
                    if error.kind() == io::ErrorKind::WouldBlock && Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(50))
                }
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => return Err(io::Error::new(io::ErrorKind::TimedOut, "The new WinBox instance did not become ready; the original instance is still available")),
                Err(error) => return Err(error),
            }
        }
    })
    .await;
    drop(operation);
    let result = match worker {
        Ok(Ok(mut stream)) => {
            let runtime = app.state::<crate::runtime::RuntimeState>();
            if let Err(error) = crate::commands::prepare_handoff(&app, &runtime).await {
                state.busy.store(false, Ordering::Release);
                return Err(error);
            }
            match write_message(&mut stream, &true) {
                Ok(()) => {
                    app.exit(0);
                    Ok(())
                }
                Err(error) => Err(error.to_string()),
            }
        }
        Ok(Err(error)) => Err(error.to_string()),
        Err(error) => Err(error.to_string()),
    };
    if let Err(error) = &result {
        state.busy.store(false, Ordering::Release);
        let _ = runtime
            .append_app_log(&app, "ERROR", &format!("Privilege handoff failed: {error}"))
            .await;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepted_handoff_stream_waits_for_delayed_peer() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut server, _) = listener.accept().unwrap();
        timeouts(&server).unwrap();
        let writer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            write_message(&mut client, &true).unwrap();
        });
        let result = read_message::<bool>(&mut server);
        writer.join().unwrap();
        assert!(result.unwrap());
    }

    #[test]
    fn rejects_oversized_and_unknown_actions() {
        assert!(
            serde_json::from_str::<Action>(r#"{"kind":"shell","command":"anything"}"#).is_err()
        );
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut server, _) = listener.accept().unwrap();
        client.write_all(&u32::MAX.to_le_bytes()).unwrap();
        assert!(read_message::<Action>(&mut server).is_err());
    }
}
