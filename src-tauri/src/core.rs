use std::io::{self, Error, ErrorKind};
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::time::timeout;

use crate::platform::windows::{
    process_image_matches, request_graceful_exit, validate_core_executable,
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
