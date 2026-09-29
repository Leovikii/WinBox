use std::ffi::OsStr;
use std::time::Duration;

pub const DELAY_START: Duration = Duration::from_millis(1_500);

/// One-shot gate shared by startup, explicit Show requests and the failure watchdog.
pub struct StartupWindow {
    pub frontend_ready: bool,
    configured: bool,
    released: bool,
    requested: bool,
}

impl StartupWindow {
    pub fn new(visible: bool) -> Self {
        Self {
            frontend_ready: false,
            configured: false,
            released: false,
            requested: visible,
        }
    }

    pub fn request_show(&mut self) -> bool {
        if self.released {
            return true;
        }
        self.requested = true;
        false
    }

    pub fn release(&mut self, frontend_ready: bool) -> bool {
        self.frontend_ready |= frontend_ready;
        if !self.configured {
            return false;
        }
        if self.released {
            return false;
        }
        self.released = true;
        std::mem::take(&mut self.requested)
    }

    pub fn configure(&mut self) -> bool {
        self.configured = true;
        self.frontend_ready && self.release(true)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct StartupOptions {
    pub minimized: bool,
    pub delay_start: bool,
    pub autostart: bool,
    pub notification: bool,
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
                Some("-autostart") => options.autostart = true,
                Some(value)
                    if value.split_once(':').is_some_and(|(scheme, _)| {
                        scheme.eq_ignore_ascii_case("winbox-notification")
                    }) =>
                {
                    options.notification = true
                }
                _ => {}
            }
        }
        options
    }

    pub fn from_environment() -> Self {
        Self::from_args(std::env::args_os())
    }
}

#[cfg(test)]
mod tests {
    use super::StartupOptions;

    #[test]
    fn window_waits_for_commit_and_releases_only_once() {
        let mut normal = super::StartupWindow::new(true);
        assert!(!normal.configure());
        assert!(!normal.request_show());
        assert!(normal.release(true));
        assert!(!normal.release(true));
        assert!(!normal.release(false));
        assert!(normal.request_show());
        assert!(normal.frontend_ready);

        let mut minimized = super::StartupWindow::new(false);
        assert!(!minimized.configure());
        assert!(!minimized.release(true));
        assert!(minimized.request_show());

        let mut early_show = super::StartupWindow::new(false);
        assert!(!early_show.configure());
        assert!(!early_show.request_show());
        assert!(early_show.release(true));

        let mut failed = super::StartupWindow::new(true);
        assert!(!failed.configure());
        assert!(failed.release(false));
        assert!(!failed.frontend_ready);
        assert!(!failed.release(true));
        assert!(failed.frontend_ready);

        let mut hidden_failure = super::StartupWindow::new(false);
        assert!(!hidden_failure.configure());
        assert!(!hidden_failure.release(false));
        assert!(hidden_failure.request_show());

        let mut early_commit = super::StartupWindow::new(true);
        assert!(!early_commit.release(true));
        assert!(early_commit.configure());
        assert!(!early_commit.configure());
    }

    #[test]
    fn recognizes_startup_flags_and_ignores_unknown_args() {
        let options = StartupOptions::from_args([
            "WinBox.exe",
            "-minimized",
            "-unknown",
            "-delay-start",
            "-autostart",
        ]);

        assert_eq!(
            options,
            StartupOptions {
                minimized: true,
                delay_start: true,
                autostart: true,
                notification: false,
            }
        );
    }

    #[test]
    fn notification_uris_only_request_a_visible_launch() {
        for uri in [
            "winbox-notification://open",
            "WINBOX-NOTIFICATION://open",
            "winbox-notification://unknown?command=connect",
        ] {
            let options = StartupOptions::from_args(["WinBox.exe", uri]);
            assert!(options.notification);
            assert!(!options.autostart && !options.minimized && !options.delay_start);
        }
    }

    #[test]
    fn missing_flags_keep_normal_startup() {
        assert_eq!(
            StartupOptions::from_args(["WinBox.exe"]),
            StartupOptions::default()
        );
    }
}
