use std::ffi::{OsStr, OsString};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub const DELAY_START: Duration = Duration::from_millis(1_500);

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct StartupOptions {
    pub minimized: bool,
    pub delay_start: bool,
}

impl StartupOptions {
    pub fn from_args<I, S>(args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut options = Self::default();
        for arg in args {
            match arg.as_ref().to_str() {
                Some("-minimized") => options.minimized = true,
                Some("-delay-start") => options.delay_start = true,
                _ => {}
            }
        }
        options
    }

    pub fn from_environment() -> Self {
        Self::from_args(std::env::args_os())
    }
}

pub fn try_apply_update() -> bool {
    apply_update_from_args(std::env::args_os())
}

pub fn apply_update_from_args<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let mut args = args.into_iter().map(Into::into);
    let _ = args.next();
    if args.next().as_deref() != Some(OsStr::new("--apply-update")) {
        return false;
    }
    let Some(staged) = args.next().map(PathBuf::from) else {
        return true;
    };
    let Some(target) = args.next().map(PathBuf::from) else {
        return true;
    };
    if !valid_update_paths(&staged, &target) {
        return true;
    }

    let staged_parent = staged.parent().map(Path::to_path_buf);
    let backup = target.with_extension("old.exe");
    let mut replaced = false;
    for _ in 0..50 {
        let _ = fs::remove_file(&backup);
        if fs::rename(&target, &backup).is_ok() {
            if fs::rename(&staged, &target).is_ok() {
                replaced = true;
                break;
            }
            let _ = fs::rename(&backup, &target);
        }
        thread::sleep(Duration::from_millis(200));
    }

    if !replaced {
        cleanup_update_stage(staged_parent.as_deref(), &target);
        return true;
    }
    let mut command = Command::new(&target);
    command.arg("-delay-start");
    if let Some(parent) = target.parent() {
        command.current_dir(parent);
    }
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    if command.spawn().is_err() {
        let _ = fs::remove_file(&target);
        let _ = fs::rename(&backup, &target);
        cleanup_update_stage(staged_parent.as_deref(), &target);
        return true;
    }
    let _ = fs::remove_file(&backup);
    cleanup_update_stage(staged_parent.as_deref(), &target);
    true
}

fn valid_update_paths(staged: &Path, target: &Path) -> bool {
    if !staged.is_absolute() || !target.is_absolute() || !staged.is_file() {
        return false;
    }
    let Some(staged_parent) = staged.parent() else {
        return false;
    };
    let Some(target_parent) = target.parent() else {
        return false;
    };
    let Ok(staged_parent) = fs::canonicalize(staged_parent) else {
        return false;
    };
    let Ok(target_parent) = fs::canonicalize(target_parent) else {
        return false;
    };
    if paths_equal(&staged_parent, &target_parent) || !staged_parent.starts_with(&target_parent) {
        return false;
    }
    target
        .file_name()
        .and_then(OsStr::to_str)
        .is_some_and(|name| name.eq_ignore_ascii_case("WinBox.exe"))
}

fn cleanup_update_stage(staged_parent: Option<&Path>, target: &Path) {
    let Some(staged_parent) = staged_parent else {
        return;
    };
    let Some(target_parent) = target.parent() else {
        return;
    };
    let (Ok(staged_parent), Ok(target_parent)) = (
        fs::canonicalize(staged_parent),
        fs::canonicalize(target_parent),
    ) else {
        return;
    };
    if staged_parent != target_parent && staged_parent.starts_with(&target_parent) {
        let _ = fs::remove_dir_all(&staged_parent);
        let archive = staged_parent.with_extension("zip");
        let _ = fs::remove_file(archive);
    }
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    left.to_string_lossy()
        .replace('/', "\\")
        .eq_ignore_ascii_case(&right.to_string_lossy().replace('/', "\\"))
}

#[cfg(test)]
mod tests {
    use super::{cleanup_update_stage, valid_update_paths, StartupOptions};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn recognizes_legacy_startup_flags_and_ignores_unknown_args() {
        let options =
            StartupOptions::from_args(["WinBox.exe", "-minimized", "-unknown", "-delay-start"]);

        assert_eq!(
            options,
            StartupOptions {
                minimized: true,
                delay_start: true,
            }
        );
    }

    #[test]
    fn missing_flags_keep_normal_startup() {
        assert_eq!(
            StartupOptions::from_args(["WinBox.exe"]),
            StartupOptions::default()
        );
    }

    #[test]
    fn update_stage_must_be_a_child_of_the_application_directory() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("winbox-startup-{nonce}"));
        let staged_dir = root.join("updates").join("stage");
        fs::create_dir_all(&staged_dir).expect("stage directory");
        let staged = staged_dir.join("WinBox.exe");
        let target = root.join("WinBox.exe");
        fs::write(&staged, b"new").expect("staged executable");

        assert!(valid_update_paths(&staged, &target));
        assert!(!valid_update_paths(&root.join("WinBox.exe"), &target));

        fs::write(staged_dir.with_extension("zip"), b"archive").expect("archive");
        cleanup_update_stage(staged.parent(), &target);
        assert!(!staged_dir.exists());
        assert!(!staged_dir.with_extension("zip").exists());
        let _ = fs::remove_dir_all(root);
    }
}
