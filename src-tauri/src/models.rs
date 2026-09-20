use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const DEFAULT_TUN_CONFIG: &str = r#"{
  "type": "tun",
  "tag": "tun-in",
  "address": [
    "172.19.0.1/30",
    "fdfe:dcba:9876::1/126"
  ],
  "mtu": 9000,
  "auto_route": true,
  "strict_route": true
}"#;

pub const DEFAULT_MIXED_CONFIG: &str = r#"{
  "type": "mixed",
  "tag": "mixed-in",
  "listen": "0.0.0.0",
  "listen_port": 7893,
  "set_system_proxy": true
}"#;

fn default_mirror() -> String {
    "https://gh-proxy.com/".to_owned()
}

fn default_mirror_enabled() -> bool {
    true
}

fn default_auto_connect_state() -> String {
    "smart".to_owned()
}

fn default_close_behavior() -> String {
    "ask".to_owned()
}

fn default_theme_mode() -> String {
    "system".to_owned()
}

fn default_accent_color() -> String {
    "#0090FF".to_owned()
}

fn default_ipv6_enabled() -> bool {
    true
}

fn default_log_to_file() -> bool {
    true
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Profile {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub updated: String,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GlobalSettings {
    #[serde(default = "default_mirror")]
    pub mirror: String,
    #[serde(default = "default_mirror_enabled")]
    pub mirror_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_connect: Option<bool>,
    #[serde(default = "default_auto_connect_state")]
    pub auto_connect_state: String,
    #[serde(default)]
    pub start_on_boot: bool,
    #[serde(default = "default_close_behavior")]
    pub close_behavior: String,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(default = "default_accent_color")]
    pub accent_color: String,
    #[serde(default = "default_ipv6_enabled")]
    pub ipv6_enabled: bool,
    #[serde(default)]
    pub log_level: String,
    #[serde(default = "default_log_to_file")]
    pub log_to_file: bool,
    #[serde(default)]
    pub pre_release: bool,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            mirror: default_mirror(),
            mirror_enabled: default_mirror_enabled(),
            auto_connect: None,
            auto_connect_state: default_auto_connect_state(),
            start_on_boot: false,
            close_behavior: default_close_behavior(),
            theme_mode: default_theme_mode(),
            accent_color: default_accent_color(),
            ipv6_enabled: default_ipv6_enabled(),
            log_level: String::new(),
            log_to_file: default_log_to_file(),
            pre_release: false,
            extra: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct AppState {
    #[serde(default)]
    pub active_id: String,
    #[serde(default)]
    pub tun_mode: bool,
    #[serde(default)]
    pub sys_proxy: bool,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DataSnapshot {
    pub settings: GlobalSettings,
    pub state: AppState,
    pub profiles: Vec<Profile>,
    pub tun_config: String,
    pub mixed_config: String,
}

impl Default for DataSnapshot {
    fn default() -> Self {
        Self {
            settings: GlobalSettings::default(),
            state: AppState::default(),
            profiles: Vec::new(),
            tun_config: DEFAULT_TUN_CONFIG.to_owned(),
            mixed_config: DEFAULT_MIXED_CONFIG.to_owned(),
        }
    }
}
