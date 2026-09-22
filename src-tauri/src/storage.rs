use crate::models::{
    AppState, DataSnapshot, GlobalSettings, Profile, DEFAULT_MIXED_CONFIG, DEFAULT_TUN_CONFIG,
};
use crate::paths::AppPaths;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub enum StorageError {
    Io {
        path: PathBuf,
        source: io::Error,
    },
    Json {
        path: PathBuf,
        source: serde_json::Error,
    },
    InvalidOverride {
        kind: String,
        source: serde_json::Error,
    },
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { path, source } => write!(f, "I/O failed for {}: {source}", path.display()),
            Self::Json { path, source } => {
                write!(f, "invalid JSON in {}: {source}", path.display())
            }
            Self::InvalidOverride { kind, source } => {
                write!(f, "invalid {kind} override JSON: {source}")
            }
        }
    }
}

impl std::error::Error for StorageError {}

#[derive(Clone)]
pub struct Storage {
    inner: Arc<StorageInner>,
}

struct StorageInner {
    paths: AppPaths,
    lock: Mutex<()>,
}

impl Storage {
    pub fn new(paths: AppPaths) -> Self {
        Self {
            inner: Arc::new(StorageInner {
                paths,
                lock: Mutex::new(()),
            }),
        }
    }

    pub fn paths(&self) -> &AppPaths {
        &self.inner.paths
    }

    pub fn load(&self) -> Result<DataSnapshot, StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        let settings =
            read_json_or_default(&self.inner.paths.settings_file(), GlobalSettings::default())?;
        let state = read_json_or_default(&self.inner.paths.state_file(), AppState::default())?;
        let profiles =
            read_json_or_default(&self.inner.paths.profiles_file(), Vec::<Profile>::new())?;
        let tun_config = read_override(
            self.inner
                .paths
                .override_file("tun")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?,
            DEFAULT_TUN_CONFIG,
        )?;
        let mixed_config = read_override(
            self.inner
                .paths
                .override_file("mixed")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?,
            DEFAULT_MIXED_CONFIG,
        )?;

        Ok(DataSnapshot {
            settings,
            state,
            profiles,
            tun_config,
            mixed_config,
        })
    }

    pub fn save(&self, snapshot: &DataSnapshot) -> Result<(), StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        let settings =
            serde_json::to_vec_pretty(&snapshot.settings).expect("settings are serializable");
        let state = serde_json::to_vec_pretty(&snapshot.state).expect("state is serializable");
        let profiles =
            serde_json::to_vec_pretty(&snapshot.profiles).expect("profiles are serializable");

        // Validate all user-controlled JSON before changing any file.
        validate_override("tun", &snapshot.tun_config)?;
        validate_override("mixed", &snapshot.mixed_config)?;

        atomic_write(&self.inner.paths.settings_file(), &settings)?;
        atomic_write(&self.inner.paths.state_file(), &state)?;
        atomic_write(&self.inner.paths.profiles_file(), &profiles)?;
        let tun_path =
            self.inner
                .paths
                .override_file("tun")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?;
        atomic_write(&tun_path, snapshot.tun_config.as_bytes())?;
        let mixed_path =
            self.inner
                .paths
                .override_file("mixed")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?;
        atomic_write(&mixed_path, snapshot.mixed_config.as_bytes())?;
        Ok(())
    }

    pub fn save_override(&self, kind: &str, content: &str) -> Result<(), StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        self.save_override_unlocked(kind, content)
    }

    fn save_override_unlocked(&self, kind: &str, content: &str) -> Result<(), StorageError> {
        validate_override(kind, content)?;
        let path = self
            .inner
            .paths
            .override_file(kind)
            .map_err(|source| StorageError::Io {
                path: self.inner.paths.overrides_dir.clone(),
                source,
            })?;
        atomic_write(&path, content.as_bytes())
    }
}

fn validate_override(kind: &str, content: &str) -> Result<(), StorageError> {
    serde_json::from_str::<Value>(content).map_err(|source| StorageError::InvalidOverride {
        kind: kind.to_owned(),
        source,
    })?;
    Ok(())
}

fn read_json_or_default<T>(path: &Path, default: T) -> Result<T, StorageError>
where
    T: DeserializeOwned,
{
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|source| StorageError::Json {
            path: path.to_path_buf(),
            source,
        }),
        Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(default),
        Err(source) => Err(StorageError::Io {
            path: path.to_path_buf(),
            source,
        }),
    }
}

fn read_override(path: PathBuf, default: &str) -> Result<String, StorageError> {
    match fs::read_to_string(&path) {
        Ok(content) => {
            serde_json::from_str::<Value>(&content)
                .map_err(|source| StorageError::Json { path, source })?;
            Ok(content)
        }
        Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(default.to_owned()),
        Err(source) => Err(StorageError::Io { path, source }),
    }
}

// ponytail: files are committed sequentially; add a manifest/journal when cross-file crash recovery is required.
pub(crate) fn atomic_write(path: &Path, data: &[u8]) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| StorageError::Io {
            path: parent.to_path_buf(),
            source,
        })?;
    }

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp_path = path.with_extension(format!("tmp-{}-{nonce}", std::process::id()));
    let backup_path = path.with_extension(format!("bak-{}-{nonce}", std::process::id()));

    fs::write(&temp_path, data).map_err(|source| StorageError::Io {
        path: temp_path.clone(),
        source,
    })?;

    let had_original = path.exists();
    if had_original {
        fs::rename(path, &backup_path).map_err(|source| StorageError::Io {
            path: path.to_path_buf(),
            source,
        })?;
    }

    if let Err(source) = fs::rename(&temp_path, path) {
        if had_original {
            let _ = fs::rename(&backup_path, path);
        }
        let _ = fs::remove_file(&temp_path);
        return Err(StorageError::Io {
            path: path.to_path_buf(),
            source,
        });
    }

    if had_original {
        fs::remove_file(&backup_path).map_err(|source| StorageError::Io {
            path: backup_path,
            source,
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Storage, StorageError};
    use crate::models::{DataSnapshot, Profile};
    use crate::paths::AppPaths;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("winbox-{label}-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&dir).expect("temporary directory");
        dir
    }

    #[test]
    fn missing_files_use_product_defaults_without_writing() {
        let root = temp_dir("defaults");
        let storage = Storage::new(AppPaths::from_data_dir(&root));
        let snapshot = storage.load().expect("load defaults");

        assert_eq!(snapshot.settings.auto_connect_state, "smart");
        assert!(snapshot.settings.ipv6_enabled);
        assert_eq!(snapshot.profiles, Vec::<Profile>::new());
        assert!(!storage.paths().settings_file().exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn load_preserves_legacy_and_unknown_settings_fields() {
        let root = temp_dir("legacy");
        let paths = AppPaths::from_data_dir(&root);
        fs::create_dir_all(&paths.config_dir).expect("config directory");
        fs::write(
            paths.settings_file(),
            br#"{
              "auto_connect": true,
              "theme_mode": "dark",
              "future_setting": "keep-me"
            }"#,
        )
        .expect("legacy settings");

        let storage = Storage::new(paths.clone());
        let snapshot = storage.load().expect("load legacy settings");
        assert_eq!(snapshot.settings.auto_connect, Some(true));
        assert_eq!(snapshot.settings.theme_mode, "dark");
        assert_eq!(snapshot.settings.extra["future_setting"], "keep-me");

        storage.save(&snapshot).expect("save legacy settings");
        let saved = fs::read_to_string(paths.settings_file()).expect("read settings");
        assert!(saved.contains("future_setting"));
        assert!(saved.contains("auto_connect"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn invalid_override_is_rejected_without_replacing_existing_file() {
        let root = temp_dir("override");
        let paths = AppPaths::from_data_dir(&root);
        let storage = Storage::new(paths.clone());
        storage
            .save_override("tun", r#"{"mtu": 9000}"#)
            .expect("valid override");
        let error = storage
            .save_override("tun", "not-json")
            .expect_err("invalid override must fail");
        assert!(matches!(error, StorageError::InvalidOverride { .. }));
        assert_eq!(
            fs::read_to_string(paths.override_file("tun").expect("tun path")).expect("override"),
            r#"{"mtu": 9000}"#
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn save_and_reload_round_trips_data() {
        let root = temp_dir("roundtrip");
        let storage = Storage::new(AppPaths::from_data_dir(&root));
        let mut snapshot = DataSnapshot::default();
        snapshot.state.active_id = "profile-1".to_owned();
        snapshot.profiles.push(Profile {
            id: "profile-1".to_owned(),
            name: "测试配置".to_owned(),
            url: "https://example.invalid/sub".to_owned(),
            ..Profile::default()
        });
        snapshot.tun_config = r#"{"type":"tun","mtu":1500}"#.to_owned();
        storage.save(&snapshot).expect("save snapshot");
        assert_eq!(storage.load().expect("reload"), snapshot);
        let _ = fs::remove_dir_all(root);
    }
}
