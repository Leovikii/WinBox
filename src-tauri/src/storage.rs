use crate::models::{
    AppState, DataSnapshot, GlobalSettings, Profile, DEFAULT_MIXED_CONFIG, DEFAULT_TUN_CONFIG,
};
use crate::paths::AppPaths;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::fmt;
use std::fs;
use std::io::{self, Write};
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
        self.load_unlocked()
    }

    fn load_unlocked(&self) -> Result<DataSnapshot, StorageError> {
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

    pub fn update<T, E: From<StorageError>>(
        &self,
        change: impl FnOnce(&mut DataSnapshot) -> Result<T, E>,
    ) -> Result<T, E> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        let previous = self.load_unlocked()?;
        let mut next = previous.clone();
        let result = change(&mut next)?;
        self.save_changed(&next, Some(&previous))?;
        Ok(result)
    }

    #[cfg(test)]
    pub fn save(&self, snapshot: &DataSnapshot) -> Result<(), StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        self.save_changed(snapshot, None)
    }

    fn save_changed(
        &self,
        snapshot: &DataSnapshot,
        previous: Option<&DataSnapshot>,
    ) -> Result<(), StorageError> {
        let settings =
            serde_json::to_vec_pretty(&snapshot.settings).expect("settings are serializable");
        let state = serde_json::to_vec_pretty(&snapshot.state).expect("state is serializable");
        let profiles =
            serde_json::to_vec_pretty(&snapshot.profiles).expect("profiles are serializable");

        // Validate all user-controlled JSON before changing any file.
        validate_override("tun", &snapshot.tun_config)?;
        validate_override("mixed", &snapshot.mixed_config)?;

        if previous.is_none_or(|old| old.settings != snapshot.settings) {
            atomic_write(&self.inner.paths.settings_file(), &settings)?;
        }
        if previous.is_none_or(|old| old.state != snapshot.state) {
            atomic_write(&self.inner.paths.state_file(), &state)?;
        }
        if previous.is_none_or(|old| old.profiles != snapshot.profiles) {
            atomic_write(&self.inner.paths.profiles_file(), &profiles)?;
        }
        let tun_path =
            self.inner
                .paths
                .override_file("tun")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?;
        if previous.is_none_or(|old| old.tun_config != snapshot.tun_config) {
            atomic_write(&tun_path, snapshot.tun_config.as_bytes())?;
        }
        let mixed_path =
            self.inner
                .paths
                .override_file("mixed")
                .map_err(|source| StorageError::Io {
                    path: self.inner.paths.overrides_dir.clone(),
                    source,
                })?;
        if previous.is_none_or(|old| old.mixed_config != snapshot.mixed_config) {
            atomic_write(&mixed_path, snapshot.mixed_config.as_bytes())?;
        }
        Ok(())
    }

    pub fn save_mode(&self, tun_mode: bool, sys_proxy: bool) -> Result<(), StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
        let path = self.inner.paths.state_file();
        let mut state = read_json_or_default(&path, AppState::default())?;
        state.tun_mode = tun_mode;
        state.sys_proxy = sys_proxy;
        atomic_write(
            &path,
            &serde_json::to_vec_pretty(&state).expect("state is serializable"),
        )
    }

    pub fn save_override(&self, kind: &str, content: &str) -> Result<(), StorageError> {
        let _guard = self.inner.lock.lock().expect("storage lock");
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

    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|source| StorageError::Io {
            path: temp_path.clone(),
            source,
        })?;
    let write_result = (|| {
        file.write_all(data)?;
        file.sync_all()
    })();
    drop(file);
    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result.map_err(|source| StorageError::Io {
        path: temp_path.clone(),
        source,
    })?;

    if let Err(source) =
        crate::platform::windows::replace_file_with_backup(&temp_path, path, &backup_path)
    {
        let _ = fs::remove_file(&temp_path);
        return Err(StorageError::Io {
            path: path.to_path_buf(),
            source,
        });
    }

    // The target is committed. Cleanup failure must not report the save as failed;
    // leave the backup in place rather than rolling back an acknowledged write.
    let _ = fs::remove_file(&backup_path);
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

    #[test]
    fn atomic_replace_preserves_old_file_when_windows_denies_replacement() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = temp_dir("atomic-replace");
        let path = root.join("state.json");
        super::atomic_write(&path, b"old").unwrap();
        let held = fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&path)
            .unwrap();
        assert!(super::atomic_write(&path, b"new").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"old");
        drop(held);
        super::atomic_write(&path, b"new").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn concurrent_updates_merge_current_fields_and_preserve_unrelated_file_bytes() {
        let root = temp_dir("concurrent-commit");
        let storage = Storage::new(AppPaths::from_data_dir(&root));
        storage.save(&DataSnapshot::default()).unwrap();
        fs::write(
            storage.paths().override_file("tun").unwrap(),
            "{  \"type\": \"tun\"  }",
        )
        .unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(3));
        let threads: Vec<_> = (0..2)
            .map(|index| {
                let storage = storage.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    let _stale_download_snapshot = storage.load().unwrap();
                    barrier.wait();
                    storage
                        .update(|latest| {
                            latest.profiles.push(Profile {
                                id: format!("profile-{index}"),
                                ..Profile::default()
                            });
                            Ok::<_, StorageError>(())
                        })
                        .unwrap();
                })
            })
            .collect();
        storage
            .update(|latest| {
                latest.settings.theme_mode = "dark".into();
                Ok::<_, StorageError>(())
            })
            .unwrap();
        storage.save_mode(true, false).unwrap();
        barrier.wait();
        for thread in threads {
            thread.join().unwrap();
        }
        let saved = storage.load().unwrap();
        assert_eq!(saved.profiles.len(), 2);
        assert_eq!(saved.settings.theme_mode, "dark");
        assert!(saved.state.tun_mode);
        assert_eq!(saved.tun_config, "{  \"type\": \"tun\"  }");
        fs::remove_dir_all(root).unwrap();
    }

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

    #[test]
    fn mode_save_only_updates_state_and_preserves_invalid_data() {
        let root = temp_dir("mode");
        let storage = Storage::new(AppPaths::from_data_dir(&root));
        let mut snapshot = DataSnapshot::default();
        snapshot.state.active_id = "keep-profile".to_owned();
        storage.save(&snapshot).unwrap();
        let settings = fs::read(storage.paths().settings_file()).unwrap();
        // Mode persistence must not read/rewrite unrelated files, even invalid overrides.
        let override_path = storage.paths().override_file("tun").unwrap();
        fs::write(&override_path, "invalid-but-unrelated").unwrap();
        storage.save_mode(true, false).unwrap();
        let state: crate::models::AppState =
            serde_json::from_slice(&fs::read(storage.paths().state_file()).unwrap()).unwrap();
        assert!(state.tun_mode && !state.sys_proxy);
        assert_eq!(state.active_id, "keep-profile");
        assert_eq!(fs::read(storage.paths().settings_file()).unwrap(), settings);
        assert_eq!(
            fs::read_to_string(override_path).unwrap(),
            "invalid-but-unrelated"
        );
        fs::write(storage.paths().state_file(), "invalid-state").unwrap();
        assert!(storage.save_mode(false, true).is_err());
        assert_eq!(
            fs::read_to_string(storage.paths().state_file()).unwrap(),
            "invalid-state"
        );
        let _ = fs::remove_dir_all(root);
    }
}
