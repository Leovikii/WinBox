use std::ffi::OsStr;
use std::time::Duration;

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

#[cfg(test)]
mod tests {
    use super::StartupOptions;

    #[test]
    fn recognizes_startup_flags_and_ignores_unknown_args() {
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
}
