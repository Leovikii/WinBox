use std::io;
use std::path::PathBuf;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub config_dir: PathBuf,
    pub core_dir: PathBuf,
    pub profiles_dir: PathBuf,
    pub overrides_dir: PathBuf,
    pub app_log: PathBuf,
    pub kernel_log: PathBuf,
}

impl AppPaths {
    pub fn from_data_dir(data_dir: impl Into<PathBuf>) -> Self {
        let data_dir = data_dir.into();
        let config_dir = data_dir.join("config");
        Self {
            data_dir: data_dir.clone(),
            config_dir: config_dir.clone(),
            core_dir: data_dir.join("core"),
            profiles_dir: data_dir.join("profiles"),
            overrides_dir: config_dir.join("overrides"),
            app_log: data_dir.join("app.log"),
            kernel_log: data_dir.join("core").join("box.log"),
        }
    }

    pub fn settings_file(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }

    pub fn state_file(&self) -> PathBuf {
        self.config_dir.join("state.json")
    }

    pub fn system_proxy_file(&self) -> PathBuf {
        self.data_dir.join("system-proxy.json")
    }

    pub fn profiles_file(&self) -> PathBuf {
        self.config_dir.join("profiles.json")
    }

    pub fn override_file(&self, kind: &str) -> io::Result<PathBuf> {
        if !matches!(kind, "tun" | "mixed") {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "override kind must be tun or mixed",
            ));
        }
        Ok(self.overrides_dir.join(format!("{kind}.json")))
    }

    pub fn profile_file(&self, id: &str) -> io::Result<PathBuf> {
        if id.is_empty()
            || id == "."
            || id == ".."
            || !id
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "profile id contains unsupported path characters",
            ));
        }
        Ok(self.profiles_dir.join(format!("{id}.json")))
    }
}

#[cfg(test)]
mod tests {
    use super::AppPaths;
    use std::path::PathBuf;

    #[test]
    fn app_data_paths_keep_runtime_data_under_the_selected_root() {
        let paths = AppPaths::from_data_dir(r"C:\Users\Vki\AppData\Local\com.leovikii.winbox");
        assert_eq!(
            paths.data_dir,
            PathBuf::from(r"C:\Users\Vki\AppData\Local\com.leovikii.winbox")
        );
        assert_eq!(
            paths.settings_file(),
            PathBuf::from(r"C:\Users\Vki\AppData\Local\com.leovikii.winbox\config\settings.json")
        );
        assert_eq!(
            paths.kernel_log,
            PathBuf::from(r"C:\Users\Vki\AppData\Local\com.leovikii.winbox\core\box.log")
        );
    }

    #[test]
    fn controlled_ids_cannot_escape_data_root() {
        let paths = AppPaths::from_data_dir(r"C:\WinBox\data");
        assert!(paths.profile_file("../outside").is_err());
        assert!(paths.override_file("../../outside").is_err());
        assert_eq!(
            paths.profile_file("profile-1").expect("profile path"),
            PathBuf::from(r"C:\WinBox\data\profiles\profile-1.json")
        );
    }
}
