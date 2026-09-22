use crate::core::CoreProcess;
use crate::paths::AppPaths;
use crate::platform::windows::{read_system_proxy, restore_system_proxy, SystemProxySettings};
use chrono::Local;
use futures_util::StreamExt;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::VecDeque;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::task::JoinHandle;
use tokio::time::{sleep, timeout, Duration};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::{
    client::IntoClientRequest,
    http::{header::HeaderValue, Request},
    Message,
};

const MAX_KERNEL_LOG_LINES: usize = 5_000;
const MAX_APP_LOG_BYTES: u64 = 10 * 1024 * 1024;
const MAX_APP_LOG_ARCHIVES: usize = 5;
const TRAFFIC_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const TRAFFIC_RETRY_DELAY: Duration = Duration::from_secs(1);

struct RuntimeInner {
    paths: AppPaths,
    core: Mutex<Option<Arc<Mutex<CoreProcess>>>>,
    operation: Mutex<()>,
    stopping: AtomicBool,
    busy: AtomicBool,
    app_log_lock: Mutex<()>,
    kernel_log: Mutex<VecDeque<String>>,
    traffic_cancel: Mutex<Option<oneshot::Sender<()>>>,
    traffic_task: Mutex<Option<JoinHandle<()>>>,
    proxy_restore: Mutex<Option<SystemProxySettings>>,
    proxy_owned: Mutex<Option<SystemProxySettings>>,
}

#[derive(Clone)]
pub struct RuntimeState {
    inner: Arc<RuntimeInner>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
struct PersistedProxyState {
    restore: SystemProxySettings,
    owned: SystemProxySettings,
}

pub struct CoreOperation<'a> {
    _lock: tokio::sync::MutexGuard<'a, ()>,
    busy: &'a AtomicBool,
    app: AppHandle,
}

impl Drop for CoreOperation<'_> {
    fn drop(&mut self) {
        self.busy.store(false, Ordering::Release);
        let _ = self.app.emit("core-busy", false);
    }
}

impl RuntimeState {
    pub fn new(paths: AppPaths) -> Self {
        let persisted_proxy = load_proxy_state(&paths);
        Self {
            inner: Arc::new(RuntimeInner {
                paths,
                core: Mutex::new(None),
                operation: Mutex::new(()),
                stopping: AtomicBool::new(false),
                busy: AtomicBool::new(false),
                app_log_lock: Mutex::new(()),
                kernel_log: Mutex::new(VecDeque::with_capacity(MAX_KERNEL_LOG_LINES)),
                traffic_cancel: Mutex::new(None),
                traffic_task: Mutex::new(None),
                proxy_restore: Mutex::new(
                    persisted_proxy.as_ref().map(|state| state.restore.clone()),
                ),
                proxy_owned: Mutex::new(persisted_proxy.map(|state| state.owned)),
            }),
        }
    }

    pub fn paths(&self) -> &AppPaths {
        &self.inner.paths
    }

    pub async fn operation(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.inner.operation.lock().await
    }

    pub async fn core_operation(&self, app: &AppHandle) -> CoreOperation<'_> {
        let lock = self.inner.operation.lock().await;
        self.inner.busy.store(true, Ordering::Release);
        let _ = app.emit("core-busy", true);
        CoreOperation {
            _lock: lock,
            busy: &self.inner.busy,
            app: app.clone(),
        }
    }

    pub fn core_busy(&self) -> bool {
        self.inner.busy.load(Ordering::Acquire)
    }

    pub async fn core(&self) -> Option<Arc<Mutex<CoreProcess>>> {
        self.inner.core.lock().await.clone()
    }

    pub async fn set_core(&self, core: Arc<Mutex<CoreProcess>>) {
        *self.inner.core.lock().await = Some(core);
    }

    pub async fn clear_core(&self) -> Option<Arc<Mutex<CoreProcess>>> {
        self.inner.core.lock().await.take()
    }

    pub async fn clear_core_if(&self, expected: &Arc<Mutex<CoreProcess>>) -> bool {
        let mut current = self.inner.core.lock().await;
        if current
            .as_ref()
            .is_some_and(|candidate| Arc::ptr_eq(candidate, expected))
        {
            current.take();
            true
        } else {
            false
        }
    }

    pub async fn remember_proxy_state(
        &self,
        restore: SystemProxySettings,
        owned: SystemProxySettings,
    ) -> io::Result<()> {
        let persisted = PersistedProxyState {
            restore: restore.clone(),
            owned: owned.clone(),
        };
        persist_proxy_state(&self.inner.paths, &persisted)?;
        *self.inner.proxy_restore.lock().await = Some(restore);
        *self.inner.proxy_owned.lock().await = Some(owned);
        Ok(())
    }

    async fn clear_proxy_state(&self) -> io::Result<()> {
        *self.inner.proxy_restore.lock().await = None;
        *self.inner.proxy_owned.lock().await = None;
        match fs::remove_file(self.inner.paths.system_proxy_file()) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        }
    }

    pub async fn restore_proxy_if_owned(&self) -> io::Result<()> {
        let restore = self.inner.proxy_restore.lock().await.clone();
        let owned = self.inner.proxy_owned.lock().await.clone();
        let result = match (restore, owned) {
            (Some(restore), Some(owned)) => match read_system_proxy()? {
                current if current == owned => restore_system_proxy(&restore),
                _ => Ok(()),
            },
            _ => Ok(()),
        };
        result?;
        self.clear_proxy_state().await
    }

    pub fn request_stop(&self, requested: bool) {
        self.inner.stopping.store(requested, Ordering::Release);
    }

    pub fn stop_requested(&self) -> bool {
        self.inner.stopping.load(Ordering::Acquire)
    }

    pub async fn append_app_log(
        &self,
        app: &AppHandle,
        level: &str,
        message: &str,
    ) -> io::Result<()> {
        let _guard = self.inner.app_log_lock.lock().await;
        if let Some(parent) = self.inner.paths.app_log.parent() {
            fs::create_dir_all(parent)?;
        }
        rotate_app_log(&self.inner.paths.app_log)?;
        let entry = format!("[{}] [{level}] {message}\n", local_time_string(true));
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.inner.paths.app_log)?;
        file.write_all(entry.as_bytes())?;
        let _ = app.emit("onAppLog", entry);
        Ok(())
    }

    pub async fn clear_app_log(&self) -> io::Result<()> {
        let _guard = self.inner.app_log_lock.lock().await;
        if let Some(parent) = self.inner.paths.app_log.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.inner.paths.app_log, [])
    }

    pub async fn clear_session_logs(&self) -> io::Result<()> {
        let _guard = self.inner.app_log_lock.lock().await;
        for path in [&self.inner.paths.app_log, &self.inner.paths.kernel_log] {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(path, [])?;
        }
        self.inner.kernel_log.lock().await.clear();
        Ok(())
    }

    pub async fn append_kernel_log(&self, line: String) {
        let mut logs = self.inner.kernel_log.lock().await;
        if logs.len() == MAX_KERNEL_LOG_LINES {
            logs.pop_front();
        }
        logs.push_back(line);
    }

    pub async fn kernel_log(&self) -> String {
        self.inner
            .kernel_log
            .lock()
            .await
            .iter()
            .cloned()
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub async fn clear_kernel_log(&self) {
        self.inner.kernel_log.lock().await.clear();
    }

    pub async fn start_traffic(&self, app: &AppHandle, api_url: String, secret: Option<String>) {
        self.stop_traffic().await;
        let (cancel, mut cancelled) = oneshot::channel();
        *self.inner.traffic_cancel.lock().await = Some(cancel);

        let state = self.clone();
        let app = app.clone();
        let task = tokio::spawn(async move {
            let ws_url = traffic_url(&api_url);
            let mut failed_attempts = 0_u32;
            loop {
                let request = match traffic_request(&ws_url, secret.as_deref()) {
                    Ok(request) => request,
                    Err(error) => {
                        let _ = state
                            .append_app_log(
                                &app,
                                "ERROR",
                                &format!("Traffic WebSocket request is invalid: {error}"),
                            )
                            .await;
                        return;
                    }
                };
                let connection = tokio::select! {
                    _ = &mut cancelled => return,
                    result = timeout(TRAFFIC_CONNECT_TIMEOUT, connect_async(request)) => result,
                };
                let mut socket = match connection {
                    Ok(Ok((socket, _))) => {
                        if failed_attempts > 0 {
                            let _ = state
                                .append_app_log(
                                    &app,
                                    "INFO",
                                    "Traffic WebSocket connected after retry",
                                )
                                .await;
                        }
                        failed_attempts = 0;
                        socket
                    }
                    Ok(Err(error)) => {
                        failed_attempts = failed_attempts.saturating_add(1);
                        if failed_attempts == 1 || failed_attempts.is_multiple_of(10) {
                            let _ = state
                                .append_app_log(
                                    &app,
                                    "WARN",
                                    &format!(
                                        "Traffic WebSocket connection failed (attempt {failed_attempts}): {error}"
                                    ),
                                )
                                .await;
                        }
                        tokio::select! {
                            _ = &mut cancelled => return,
                            _ = sleep(TRAFFIC_RETRY_DELAY) => continue,
                        }
                    }
                    Err(_) => {
                        failed_attempts = failed_attempts.saturating_add(1);
                        if failed_attempts == 1 || failed_attempts.is_multiple_of(10) {
                            let _ = state
                                .append_app_log(
                                    &app,
                                    "WARN",
                                    &format!(
                                        "Traffic WebSocket connection timed out (attempt {failed_attempts})"
                                    ),
                                )
                                .await;
                        }
                        tokio::select! {
                            _ = &mut cancelled => return,
                            _ = sleep(TRAFFIC_RETRY_DELAY) => continue,
                        }
                    }
                };

                let mut invalid_payload_reported = false;
                loop {
                    tokio::select! {
                        _ = &mut cancelled => {
                            let _ = socket.close(None).await;
                            return;
                        }
                        message = socket.next() => match message {
                            Some(Ok(Message::Text(text))) => {
                                if let Some(payload) = traffic_payload(text.as_ref()) {
                                    let _ = app.emit("traffic-update", payload);
                                } else if !invalid_payload_reported {
                                    invalid_payload_reported = true;
                                    let _ = state
                                        .append_app_log(
                                            &app,
                                            "WARN",
                                            "Traffic WebSocket returned an invalid payload",
                                        )
                                        .await;
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => break,
                            Some(Ok(_)) => {}
                            Some(Err(error)) => {
                                let _ = state
                                    .append_app_log(
                                        &app,
                                        "WARN",
                                        &format!("Traffic WebSocket disconnected: {error}"),
                                    )
                                    .await;
                                break;
                            }
                        }
                    }
                }

                let _ = app.emit(
                    "traffic-update",
                    TrafficUpdate {
                        upload: 0,
                        download: 0,
                    },
                );
                if state.stop_requested() {
                    return;
                }
            }
        });
        *self.inner.traffic_task.lock().await = Some(task);
    }

    pub async fn stop_traffic(&self) {
        if let Some(cancel) = self.inner.traffic_cancel.lock().await.take() {
            let _ = cancel.send(());
        }
        if let Some(task) = self.inner.traffic_task.lock().await.take() {
            task.abort();
            let _ = task.await;
        }
    }

    pub fn spawn_core_monitor(
        &self,
        app: &AppHandle,
        core: Arc<Mutex<CoreProcess>>,
        mut output: mpsc::UnboundedReceiver<String>,
    ) {
        let state = self.clone();
        let app = app.clone();
        tokio::spawn(async move {
            let mut output_open = true;
            loop {
                tokio::select! {
                    line = output.recv(), if output_open => {
                        match line {
                            Some(line) => state.append_kernel_log(line).await,
                            None => output_open = false,
                        }
                    }
                    _ = sleep(Duration::from_millis(200)) => {
                        let exited = {
                            let mut process = core.lock().await;
                            process.try_wait().unwrap_or(None).is_some()
                        };
                        if exited {
                            break;
                        }
                    }
                }
            }

            let _operation = state.operation().await;
            if state.clear_core_if(&core).await {
                state.stop_traffic().await;
                let _ = state.restore_proxy_if_owned().await;
                if !state.stop_requested() {
                    let _ = state
                        .append_app_log(&app, "WARN", "Core process stopped unexpectedly")
                        .await;
                    let _ = app.emit("log", "Error: Core crashed unexpectedly");
                }
                let _ = app.emit("status", false);
            }
        });
    }
}

fn load_proxy_state(paths: &AppPaths) -> Option<PersistedProxyState> {
    let bytes = fs::read(paths.system_proxy_file()).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn persist_proxy_state(paths: &AppPaths, state: &PersistedProxyState) -> io::Result<()> {
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|_| io::Error::other("system proxy state could not be serialized"))?;
    crate::storage::atomic_write(&paths.system_proxy_file(), &bytes)
        .map_err(|_| io::Error::other("system proxy state could not be written"))
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficUpdate {
    pub upload: i64,
    pub download: i64,
}

fn traffic_url(api_url: &str) -> String {
    let api_url = api_url.trim_end_matches('/');
    let api_url = api_url
        .strip_prefix("http://0.0.0.0")
        .map(|rest| format!("http://127.0.0.1{rest}"))
        .or_else(|| {
            api_url
                .strip_prefix("https://0.0.0.0")
                .map(|rest| format!("https://127.0.0.1{rest}"))
        })
        .unwrap_or_else(|| api_url.to_owned());
    let mut url = api_url;
    if let Some(rest) = url.strip_prefix("http://") {
        url = format!("ws://{rest}");
    } else if let Some(rest) = url.strip_prefix("https://") {
        url = format!("wss://{rest}");
    }
    format!("{url}/traffic")
}

fn traffic_request(url: &str, secret: Option<&str>) -> Result<Request<()>, String> {
    let mut request = url
        .to_owned()
        .into_client_request()
        .map_err(|error| error.to_string())?;
    if let Some(secret) = secret {
        let value =
            HeaderValue::try_from(format!("Bearer {secret}")).map_err(|error| error.to_string())?;
        request.headers_mut().insert("Authorization", value);
    }
    Ok(request)
}

fn traffic_payload(text: &str) -> Option<TrafficUpdate> {
    let value: Value = serde_json::from_str(text).ok()?;
    Some(TrafficUpdate {
        upload: value.get("up")?.as_i64()?,
        download: value.get("down")?.as_i64()?,
    })
}

fn rotate_app_log(path: &Path) -> io::Result<()> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    if metadata.len() < MAX_APP_LOG_BYTES {
        return Ok(());
    }

    for index in (1..MAX_APP_LOG_ARCHIVES).rev() {
        let source = app_log_archive_path(path, index);
        let destination = app_log_archive_path(path, index + 1);
        if destination.exists() {
            fs::remove_file(&destination)?;
        }
        match fs::rename(source, destination) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
    }

    let first_archive = app_log_archive_path(path, 1);
    if first_archive.exists() {
        fs::remove_file(&first_archive)?;
    }
    fs::rename(path, first_archive)
}

fn app_log_archive_path(path: &Path, index: usize) -> PathBuf {
    let mut archive = path.as_os_str().to_os_string();
    archive.push(format!(".{index}"));
    archive.into()
}

pub(crate) fn local_time_string(with_seconds: bool) -> String {
    if with_seconds {
        Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
    } else {
        Local::now().format("%Y-%m-%d %H:%M").to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{
        app_log_archive_path, load_proxy_state, local_time_string, persist_proxy_state,
        rotate_app_log, traffic_payload, traffic_request, traffic_url, AppPaths,
        PersistedProxyState, RuntimeState, MAX_APP_LOG_BYTES,
    };
    use crate::platform::windows::SystemProxySettings;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn persisted_proxy_marker_round_trips_atomically() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("winbox-proxy-marker-{nonce}"));
        let paths = AppPaths::from_data_dir(&root);
        let state = PersistedProxyState {
            restore: SystemProxySettings {
                enabled: Some(false),
                server: Some("proxy.example:8080".to_owned()),
                override_list: None,
            },
            owned: SystemProxySettings {
                enabled: Some(true),
                server: Some("127.0.0.1:7893".to_owned()),
                override_list: Some("<local>".to_owned()),
            },
        };

        persist_proxy_state(&paths, &state).expect("persist marker");
        assert_eq!(load_proxy_state(&paths), Some(state));

        fs::remove_dir_all(root).expect("test cleanup");
    }

    #[tokio::test]
    async fn session_log_reset_clears_app_and_kernel_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("winbox-session-logs-{nonce}"));
        let paths = AppPaths::from_data_dir(&root);
        fs::create_dir_all(&paths.core_dir).expect("core directory");
        fs::write(&paths.app_log, b"old app log").expect("app log");
        fs::write(&paths.kernel_log, b"old kernel log").expect("kernel log");

        RuntimeState::new(paths.clone())
            .clear_session_logs()
            .await
            .expect("clear session logs");

        assert_eq!(fs::read(&paths.app_log).expect("app log"), b"");
        assert_eq!(fs::read(&paths.kernel_log).expect("kernel log"), b"");
        fs::remove_dir_all(root).expect("test cleanup");
    }

    #[test]
    fn app_log_rotation_keeps_five_archives() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("winbox-log-rotation-{nonce}"));
        let paths = AppPaths::from_data_dir(&root);
        fs::create_dir_all(&root).expect("data directory");
        fs::write(&paths.app_log, vec![b'x'; MAX_APP_LOG_BYTES as usize]).expect("current app log");
        for index in 1..=5 {
            fs::write(
                app_log_archive_path(&paths.app_log, index),
                format!("archive-{index}"),
            )
            .expect("archive");
        }

        rotate_app_log(&paths.app_log).expect("rotate app log");

        assert!(!paths.app_log.exists());
        assert_eq!(
            fs::read_to_string(app_log_archive_path(&paths.app_log, 1))
                .expect("archive 1")
                .len(),
            MAX_APP_LOG_BYTES as usize
        );
        assert_eq!(
            fs::read_to_string(app_log_archive_path(&paths.app_log, 2)).expect("archive 2"),
            "archive-1"
        );
        assert_eq!(
            fs::read_to_string(app_log_archive_path(&paths.app_log, 5)).expect("archive 5"),
            "archive-4"
        );
        assert!(!app_log_archive_path(&paths.app_log, 6).exists());
        fs::remove_dir_all(root).expect("test cleanup");
    }

    #[test]
    fn local_time_uses_legacy_log_shape() {
        let value = local_time_string(true);
        assert_eq!(value.len(), 19);
        for (index, byte) in value.bytes().enumerate() {
            match index {
                4 | 7 => assert_eq!(byte, b'-'),
                10 => assert_eq!(byte, b' '),
                13 | 16 => assert_eq!(byte, b':'),
                _ => assert!(byte.is_ascii_digit()),
            }
        }
    }

    #[test]
    fn traffic_url_maps_wildcard_controller_to_loopback() {
        assert_eq!(
            traffic_url("http://0.0.0.0:9090"),
            "ws://127.0.0.1:9090/traffic"
        );
        assert_eq!(
            traffic_url("https://0.0.0.0:9090/"),
            "wss://127.0.0.1:9090/traffic"
        );
    }

    #[test]
    fn traffic_payload_and_auth_request_keep_contract() {
        assert_eq!(
            traffic_payload(r#"{"up":123,"down":456}"#)
                .expect("traffic payload")
                .upload,
            123
        );
        assert!(traffic_payload(r#"{"up":"123","down":456}"#).is_none());

        let request = traffic_request("ws://127.0.0.1:9090/traffic", Some("test-secret"))
            .expect("traffic request");
        assert!(request.headers().contains_key("sec-websocket-key"));
        assert_eq!(
            request
                .headers()
                .get("authorization")
                .expect("authorization")
                .to_str()
                .expect("header text"),
            "Bearer test-secret"
        );
    }
}
