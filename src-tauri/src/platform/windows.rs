use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::ffi::{c_void, OsStr, OsString};
use std::fs;
use std::io::{self, Error, ErrorKind};
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::os::windows::io::RawHandle;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

pub const CORE_EXECUTABLE_NAME: &str = "sing-box.exe";

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[link(name = "iphlpapi")]
unsafe extern "system" {
    fn GetExtendedTcpTable(
        table: *mut c_void,
        size: *mut u32,
        order: i32,
        family: u32,
        class: u32,
        reserved: u32,
    ) -> u32;
}

/// Check the endpoint's owner, so an unrelated HTTP server cannot signal readiness.
pub fn owns_tcp_listener(pid: u32, address: std::net::SocketAddr) -> io::Result<bool> {
    let family = if address.is_ipv4() { 2 } else { 23 };
    let mut size = 0;
    let mut table = Vec::<u32>::new();
    loop {
        // OWNER_PID_LISTENER = 3. u32 storage provides the table's required alignment.
        let result = unsafe {
            GetExtendedTcpTable(
                if table.is_empty() {
                    std::ptr::null_mut()
                } else {
                    table.as_mut_ptr().cast()
                },
                &mut size,
                0,
                family,
                3,
                0,
            )
        };
        if result == 122 {
            table.resize((size as usize).div_ceil(4), 0);
            continue;
        }
        if result != 0 {
            return Err(Error::from_raw_os_error(result as i32));
        }
        break;
    }
    let width = if address.is_ipv4() { 6 } else { 14 };
    let count = table.first().copied().unwrap_or(0) as usize;
    for row in table
        .get(1..)
        .unwrap_or_default()
        .chunks_exact(width)
        .take(count)
    {
        let (port, owner, local_matches) = match address.ip() {
            std::net::IpAddr::V4(ip) => (
                row[2],
                row[5],
                row[1] == 0 || row[1].to_ne_bytes() == ip.octets(),
            ),
            std::net::IpAddr::V6(ip) => {
                let bytes: Vec<u8> = row[..4]
                    .iter()
                    .flat_map(|word| word.to_ne_bytes())
                    .collect();
                (
                    row[5],
                    row[13],
                    bytes.iter().all(|byte| *byte == 0) || bytes == ip.octets(),
                )
            }
        };
        if owner == pid && u16::from_be(port as u16) == address.port() && local_matches {
            return Ok(true);
        }
    }
    Ok(false)
}
const ERROR_INVALID_HANDLE: i32 = 6;
const ERROR_ACCESS_DENIED: i32 = 5;
const ERROR_SHARING_VIOLATION: i32 = 32;
const ERROR_LOCK_VIOLATION: i32 = 33;
const CTRL_BREAK_EVENT: u32 = 1;
const ATTACH_PARENT_PROCESS: u32 = u32::MAX;
const REPLACEFILE_WRITE_THROUGH: u32 = 1;
const MOVEFILE_WRITE_THROUGH: u32 = 8;
const FILE_REPLACE_ATTEMPTS: usize = 15;

#[allow(non_snake_case)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn AttachConsole(process_id: u32) -> i32;
    fn FreeConsole() -> i32;
    fn GenerateConsoleCtrlEvent(event: u32, process_group_id: u32) -> i32;
    fn GetSystemDirectoryW(buffer: *mut u16, size: u32) -> u32;
    fn QueryFullProcessImageNameW(
        process: RawHandle,
        flags: u32,
        buffer: *mut u16,
        size: *mut u32,
    ) -> i32;
    fn SetConsoleCtrlHandler(handler: *const c_void, add: i32) -> i32;
    fn ReplaceFileW(
        replaced_file_name: *const u16,
        replacement_file_name: *const u16,
        backup_file_name: *const u16,
        replace_flags: u32,
        exclude: *mut c_void,
        reserved: *mut c_void,
    ) -> i32;
    fn MoveFileExW(existing_file_name: *const u16, new_file_name: *const u16, flags: u32) -> i32;
}

#[allow(non_snake_case)]
#[link(name = "advapi32")]
unsafe extern "system" {
    fn RegOpenKeyExW(
        hkey: isize,
        sub_key: *const u16,
        options: u32,
        access: u32,
        result: *mut isize,
    ) -> i32;
    fn RegQueryValueExW(
        hkey: isize,
        value_name: *const u16,
        reserved: *mut u32,
        value_type: *mut u32,
        data: *mut u8,
        data_size: *mut u32,
    ) -> i32;
    fn RegCloseKey(hkey: isize) -> i32;
}

const HKEY_CURRENT_USER: isize = -2147483647isize;
const KEY_QUERY_VALUE: u32 = 0x0001;
const ERROR_SUCCESS_CODE: i32 = 0;
const REG_SZ: u32 = 1;
const REG_EXPAND_SZ: u32 = 2;

#[allow(non_snake_case)]
#[link(name = "wininet")]
unsafe extern "system" {
    fn InternetSetOptionW(
        internet: *mut c_void,
        option: u32,
        buffer: *mut c_void,
        length: u32,
    ) -> i32;
}

const INTERNET_OPTION_SETTINGS_CHANGED: u32 = 39;
const INTERNET_OPTION_REFRESH: u32 = 37;
const INTERNET_SETTINGS_KEY: &str =
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UwpAppRecord {
    pub sid: String,
    pub display_name: String,
    pub package_name: String,
    pub is_exempt: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct SystemProxySettings {
    pub enabled: Option<bool>,
    pub server: Option<String>,
    pub override_list: Option<String>,
}

pub fn configure_hidden_command(command: &mut Command) {
    command.creation_flags(CREATE_NO_WINDOW);
}

pub fn replace_file_with_backup(staged: &Path, target: &Path, backup: &Path) -> io::Result<bool> {
    let staged = wide_path(staged)?;
    let target = wide_path(target)?;
    let backup = wide_path(backup)?;
    let target_metadata = match fs::symlink_metadata(target_path(&target)) {
        Ok(metadata) => Some(metadata),
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(error) => return Err(error),
    };
    if let Some(metadata) = &target_metadata {
        if !metadata.is_file() {
            return Err(Error::new(
                ErrorKind::InvalidInput,
                "core replacement target is not a regular file",
            ));
        }
    }
    let staged_metadata = fs::symlink_metadata(target_path(&staged))?;
    if !staged_metadata.is_file() {
        return Err(Error::new(
            ErrorKind::InvalidInput,
            "staged core executable is not a regular file",
        ));
    }
    if fs::symlink_metadata(target_path(&backup)).is_ok() {
        return Err(Error::new(
            ErrorKind::AlreadyExists,
            "core replacement backup already exists",
        ));
    }

    let had_target = target_metadata.is_some();
    retry_file_operation(|| {
        let result = unsafe {
            if had_target {
                ReplaceFileW(
                    target.as_ptr(),
                    staged.as_ptr(),
                    backup.as_ptr(),
                    REPLACEFILE_WRITE_THROUGH,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            } else {
                MoveFileExW(staged.as_ptr(), target.as_ptr(), MOVEFILE_WRITE_THROUGH)
            }
        };
        if result == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    })?;
    Ok(had_target)
}

fn retry_file_operation<F>(mut operation: F) -> io::Result<()>
where
    F: FnMut() -> io::Result<()>,
{
    for attempt in 0..FILE_REPLACE_ATTEMPTS {
        match operation() {
            Ok(()) => return Ok(()),
            Err(error)
                if attempt + 1 < FILE_REPLACE_ATTEMPTS
                    && matches!(
                        error.raw_os_error(),
                        Some(code)
                            if matches!(
                                code,
                                ERROR_ACCESS_DENIED
                                    | ERROR_SHARING_VIOLATION
                                    | ERROR_LOCK_VIOLATION
                            )
                    ) =>
            {
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("file replacement loop always returns")
}

fn wide_path(path: &Path) -> io::Result<Vec<u16>> {
    if path
        .as_os_str()
        .encode_wide()
        .any(|character| character == 0)
    {
        return Err(Error::new(
            ErrorKind::InvalidInput,
            "core replacement path contains a NUL",
        ));
    }
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    Ok(wide)
}

fn target_path(wide: &[u16]) -> PathBuf {
    PathBuf::from(OsString::from_wide(&wide[..wide.len() - 1]))
}

pub fn read_system_proxy() -> io::Result<SystemProxySettings> {
    let output = run_system_tool(
        "reg.exe",
        [
            OsString::from("QUERY"),
            OsString::from(INTERNET_SETTINGS_KEY),
        ],
    )?;
    ensure_system_tool_success("read system proxy", output.clone())?;
    let text = output_text(&output);
    let enabled = registry_value(&text, "ProxyEnable", "REG_DWORD").and_then(parse_dword);
    let server = registry_value(&text, "ProxyServer", "REG_SZ");
    let override_list = registry_value(&text, "ProxyOverride", "REG_SZ");
    Ok(SystemProxySettings {
        enabled,
        server,
        override_list,
    })
}

pub fn restore_system_proxy(settings: &SystemProxySettings) -> io::Result<()> {
    let current = read_system_proxy()?;
    match settings.enabled {
        Some(enabled) => {
            set_registry_value("ProxyEnable", "REG_DWORD", if enabled { "1" } else { "0" })?
        }
        None if current.enabled.is_some() => delete_registry_value("ProxyEnable")?,
        None => {}
    }
    match settings.server.as_deref() {
        Some(server) => set_registry_value("ProxyServer", "REG_SZ", server)?,
        None if current.server.is_some() => delete_registry_value("ProxyServer")?,
        None => {}
    }
    match settings.override_list.as_deref() {
        Some(override_list) => set_registry_value("ProxyOverride", "REG_SZ", override_list)?,
        None if current.override_list.is_some() => delete_registry_value("ProxyOverride")?,
        None => {}
    }

    unsafe {
        if InternetSetOptionW(
            std::ptr::null_mut(),
            INTERNET_OPTION_SETTINGS_CHANGED,
            std::ptr::null_mut(),
            0,
        ) == 0
            || InternetSetOptionW(
                std::ptr::null_mut(),
                INTERNET_OPTION_REFRESH,
                std::ptr::null_mut(),
                0,
            ) == 0
        {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

fn set_registry_value(name: &str, kind: &str, value: &str) -> io::Result<()> {
    let output = run_system_tool(
        "reg.exe",
        [
            OsString::from("ADD"),
            OsString::from(INTERNET_SETTINGS_KEY),
            OsString::from("/v"),
            OsString::from(name),
            OsString::from("/t"),
            OsString::from(kind),
            OsString::from("/d"),
            OsString::from(value),
            OsString::from("/f"),
        ],
    )?;
    ensure_system_tool_success("write system proxy", output)
}

fn delete_registry_value(name: &str) -> io::Result<()> {
    let output = run_system_tool(
        "reg.exe",
        [
            OsString::from("DELETE"),
            OsString::from(INTERNET_SETTINGS_KEY),
            OsString::from("/v"),
            OsString::from(name),
            OsString::from("/f"),
        ],
    )?;
    if output.status.success()
        || output_text(&output)
            .to_ascii_lowercase()
            .contains("unable to find")
    {
        Ok(())
    } else {
        Err(Error::other(format!(
            "delete system proxy value failed: {}",
            output_text(&output)
        )))
    }
}

pub fn get_uwp_apps() -> io::Result<Vec<UwpAppRecord>> {
    let root = r"HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings";
    let output = run_system_tool(
        "reg.exe",
        [
            OsString::from("QUERY"),
            OsString::from(root),
            OsString::from("/s"),
        ],
    )?;
    ensure_system_tool_success("read UWP mappings", output.clone())?;

    let mut sids = BTreeSet::new();
    for line in output_text(&output).lines() {
        if let Some(sid) = line.trim().rsplit('\\').next() {
            if is_uwp_sid(sid) {
                sids.insert(sid.to_owned());
            }
        }
    }

    let exempt = get_loopback_exemptions()?;
    let mut apps = Vec::new();
    for sid in sids {
        let key = format!(r"{root}\{sid}");
        let display_name = registry_value_utf16(&key, "DisplayName").unwrap_or_default();
        let package_name = registry_value_utf16(&key, "Moniker").unwrap_or_default();
        let display_name = if display_name.contains("ms-resource") || display_name.is_empty() {
            if package_name.is_empty() {
                sid.clone()
            } else {
                package_name.clone()
            }
        } else {
            display_name
        };
        apps.push(UwpAppRecord {
            sid: sid.clone(),
            display_name,
            package_name,
            is_exempt: exempt.contains(&sid),
        });
    }
    Ok(apps)
}

pub fn set_loopback_exemptions(add: &[String], remove: &[String]) -> io::Result<()> {
    for sid in add {
        validate_uwp_sid(sid)?;
        let output = run_system_tool(
            "CheckNetIsolation.exe",
            [
                OsString::from("LoopbackExempt"),
                OsString::from("-a"),
                OsString::from(format!("-p={sid}")),
            ],
        )?;
        ensure_system_tool_success("add UWP loopback exemption", output)?;
    }
    for sid in remove {
        validate_uwp_sid(sid)?;
        let output = run_system_tool(
            "CheckNetIsolation.exe",
            [
                OsString::from("LoopbackExempt"),
                OsString::from("-d"),
                OsString::from(format!("-p={sid}")),
            ],
        )?;
        ensure_system_tool_success("remove UWP loopback exemption", output)?;
    }
    Ok(())
}

const AUTOSTART_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

pub fn set_autostart(executable: &Path, enabled: bool) -> io::Result<bool> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::*;
    let path = existing_absolute_executable(executable)?;
    let key_name = wide(AUTOSTART_KEY);
    let value_name = wide("WinBox");
    let mut key = HKEY::default();
    unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(key_name.as_ptr()),
            None,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        )
        .ok()
        .map_err(Error::other)?;
        let result = if enabled {
            let command = wide(&format!("\"{}\" -minimized -autostart", task_path(&path)));
            let bytes =
                std::slice::from_raw_parts(command.as_ptr().cast::<u8>(), command.len() * 2);
            RegSetValueExW(key, PCWSTR(value_name.as_ptr()), None, REG_SZ, Some(bytes)).ok()
        } else {
            let result = RegDeleteValueW(key, PCWSTR(value_name.as_ptr()));
            if result.0 == 2 {
                Ok(())
            } else {
                result.ok()
            }
        };
        let _ = RegCloseKey(key);
        result.map_err(Error::other)?;
    }
    let actual = query_autostart(&path)?;
    if actual != enabled {
        return Err(Error::other("Autostart verification failed"));
    }
    Ok(actual)
}

pub fn query_autostart(executable: &Path) -> io::Result<bool> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::*;
    let executable = existing_absolute_executable(executable)?;
    let key = wide(AUTOSTART_KEY);
    let name = wide("WinBox");
    let mut data = vec![0u16; 32768];
    let mut bytes = (data.len() * 2) as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(key.as_ptr()),
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(data.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if result.0 == 2 {
        return Ok(false);
    }
    result.ok().map_err(Error::other)?;
    let length = data.iter().position(|ch| *ch == 0).unwrap_or(data.len());
    let expected = format!("\"{}\" -minimized -autostart", task_path(&executable));
    if !String::from_utf16_lossy(&data[..length]).eq_ignore_ascii_case(&expected) {
        return Ok(false);
    }
    // Respect a user disabling this entry in Windows Startup apps; do not overwrite that choice.
    let approved_key =
        wide(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run");
    let mut approval = [0u8; 12];
    let mut approval_size = approval.len() as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(approved_key.as_ptr()),
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_BINARY,
            None,
            Some(approval.as_mut_ptr().cast()),
            Some(&mut approval_size),
        )
    };
    if status.0 != 2 {
        status.ok().map_err(Error::other)?;
        if approval_size < 4 {
            return Err(Error::other("Windows startup approval state is invalid"));
        }
        let state = u32::from_le_bytes(approval[..4].try_into().unwrap());
        match state {
            2 | 6 => {},
            3 | 7 => return Err(Error::other("WinBox is disabled in Windows Startup apps. Enable it there, or remove its startup entry there.")),
            _ => return Err(Error::other("Windows startup approval state is unknown; check Windows Startup apps")),
        }
    }
    Ok(true)
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

pub fn validate_core_executable(executable: &Path, core_dir: &Path) -> io::Result<PathBuf> {
    let core_dir = fs::canonicalize(core_dir)?;
    let executable = fs::canonicalize(executable)?;
    let is_expected_name = executable
        .file_name()
        .and_then(OsStr::to_str)
        .is_some_and(|name| name.eq_ignore_ascii_case(CORE_EXECUTABLE_NAME));
    let is_direct_child = executable
        .parent()
        .is_some_and(|parent| paths_equal(parent, &core_dir));

    if !executable.is_file() || !is_expected_name || !is_direct_child {
        return Err(Error::new(
            ErrorKind::PermissionDenied,
            "sing-box executable is outside the application core directory",
        ));
    }
    Ok(executable)
}

pub fn request_graceful_exit(process_id: u32) -> io::Result<()> {
    send_ctrl_break(process_id)
}

pub(crate) fn process_image_matches(
    process: RawHandle,
    expected_executable: &Path,
) -> io::Result<bool> {
    if process.is_null() {
        return Err(Error::new(
            ErrorKind::InvalidInput,
            "process handle is null",
        ));
    }

    let mut buffer = vec![0u16; 32_768];
    let mut size = buffer.len() as u32;
    let result = unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size) };
    if result == 0 {
        return Err(io::Error::last_os_error());
    }

    buffer.truncate(size as usize);
    let actual = PathBuf::from(OsString::from_wide(&buffer));
    Ok(paths_equal(&actual, expected_executable))
}

fn send_ctrl_break(process_id: u32) -> io::Result<()> {
    let had_console = unsafe { FreeConsole() != 0 };
    if !had_console {
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(ERROR_INVALID_HANDLE) {
            return Err(error);
        }
    }

    if unsafe { AttachConsole(process_id) } == 0 {
        let error = io::Error::last_os_error();
        restore_console(had_console);
        return Err(error);
    }

    let result = (|| {
        if unsafe { SetConsoleCtrlHandler(std::ptr::null(), 1) } == 0 {
            return Err(io::Error::last_os_error());
        }
        if unsafe { GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, process_id) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    })();

    unsafe {
        SetConsoleCtrlHandler(std::ptr::null(), 0);
    }
    restore_console(had_console);
    result
}

fn restore_console(had_console: bool) {
    unsafe {
        FreeConsole();
        if had_console {
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
    }
}

fn existing_absolute_executable(executable: &Path) -> io::Result<PathBuf> {
    if !executable.is_absolute() {
        return Err(Error::new(
            ErrorKind::InvalidInput,
            "autostart executable must be an absolute path",
        ));
    }
    let executable = fs::canonicalize(executable)?;
    if !executable.is_file() {
        return Err(Error::new(
            ErrorKind::NotFound,
            "autostart executable does not exist",
        ));
    }
    Ok(executable)
}

fn run_system_tool<I, S>(name: &str, args: I) -> io::Result<Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let tool = system_tool(name)?;
    let mut command = Command::new(tool);
    command.creation_flags(CREATE_NO_WINDOW);
    command.args(args).output()
}

fn system_tool(name: &str) -> io::Result<PathBuf> {
    let mut system_directory = vec![0u16; 260];
    let length = unsafe {
        GetSystemDirectoryW(system_directory.as_mut_ptr(), system_directory.len() as u32)
    };
    if length == 0 {
        return Err(io::Error::last_os_error());
    }
    if length as usize >= system_directory.len() {
        system_directory.resize(length as usize + 1, 0);
        let retry = unsafe {
            GetSystemDirectoryW(system_directory.as_mut_ptr(), system_directory.len() as u32)
        };
        if retry == 0 || retry as usize >= system_directory.len() {
            return Err(Error::new(
                ErrorKind::InvalidData,
                "GetSystemDirectoryW returned an invalid path length",
            ));
        }
        system_directory.truncate(retry as usize);
    } else {
        system_directory.truncate(length as usize);
    }
    Ok(PathBuf::from(OsString::from_wide(&system_directory)).join(name))
}

fn ensure_system_tool_success(action: &str, output: Output) -> io::Result<()> {
    if output.status.success() {
        Ok(())
    } else {
        Err(Error::other(format!(
            "{action} failed: {}",
            output_text(&output)
        )))
    }
}

fn get_loopback_exemptions() -> io::Result<BTreeSet<String>> {
    let output = run_system_tool(
        "CheckNetIsolation.exe",
        [OsString::from("LoopbackExempt"), OsString::from("-s")],
    )?;
    ensure_system_tool_success("read UWP loopback exemptions", output.clone())?;
    Ok(extract_uwp_sids(&output_text(&output)))
}

fn extract_uwp_sids(text: &str) -> BTreeSet<String> {
    let mut result = BTreeSet::new();
    for token in text.split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '-') {
        if is_uwp_sid(token) {
            result.insert(token.to_owned());
        }
    }
    result
}

fn is_uwp_sid(value: &str) -> bool {
    value.starts_with("S-1-15-2-")
        && value.strip_prefix("S-1-15-2-").is_some_and(|tail| {
            !tail.is_empty()
                && tail
                    .split('-')
                    .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
        })
}

fn registry_value(text: &str, name: &str, kind: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let mut fields = line.split_whitespace();
        let actual_name = fields.next()?;
        let actual_kind = fields.next()?;
        if !actual_name.eq_ignore_ascii_case(name) || !actual_kind.eq_ignore_ascii_case(kind) {
            return None;
        }
        let prefix = line.find(actual_kind)? + actual_kind.len();
        Some(line[prefix..].trim().to_owned())
    })
}

fn parse_dword(value: String) -> Option<bool> {
    let value = value.trim();
    let number = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .and_then(|hex| u32::from_str_radix(hex, 16).ok())
        .or_else(|| value.parse::<u32>().ok())?;
    Some(number != 0)
}

fn validate_uwp_sid(value: &str) -> io::Result<()> {
    if is_uwp_sid(value) {
        Ok(())
    } else {
        Err(Error::new(
            ErrorKind::InvalidInput,
            "invalid UWP application SID",
        ))
    }
}

fn registry_value_utf16(key: &str, name: &str) -> Option<String> {
    let key = key.strip_prefix(r"HKCU\").unwrap_or(key);
    let key_w: Vec<u16> = OsStr::new(key)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let name_w: Vec<u16> = OsStr::new(name)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut handle = 0isize;
    let result = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            key_w.as_ptr(),
            0,
            KEY_QUERY_VALUE,
            &mut handle,
        )
    };
    if result != ERROR_SUCCESS_CODE {
        return None;
    }
    let mut value_type = 0u32;
    let mut size = 0u32;
    let query = unsafe {
        RegQueryValueExW(
            handle,
            name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut size,
        )
    };
    if query != ERROR_SUCCESS_CODE
        || (value_type != REG_SZ && value_type != REG_EXPAND_SZ)
        || size < 2
    {
        unsafe {
            RegCloseKey(handle);
        }
        return None;
    }
    let mut bytes = vec![0u8; size as usize];
    let query = unsafe {
        RegQueryValueExW(
            handle,
            name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            bytes.as_mut_ptr(),
            &mut size,
        )
    };
    unsafe {
        RegCloseKey(handle);
    }
    if query != ERROR_SUCCESS_CODE {
        return None;
    }
    let words = bytes[..size as usize]
        .chunks_exact(2)
        .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
        .take_while(|word| *word != 0)
        .collect::<Vec<_>>();
    Some(String::from_utf16_lossy(&words))
}

fn output_text(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    format!("{}{}", stdout.trim(), stderr.trim())
}

fn task_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(text.as_ref())
        .to_string()
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    task_path(left)
        .replace('/', "\\")
        .eq_ignore_ascii_case(&task_path(right).replace('/', "\\"))
}

#[cfg(test)]
mod tests {
    use super::validate_core_executable;
    use std::fs;

    #[test]
    fn tcp_listener_owner_matches_ipv4_and_ipv6() {
        for host in ["127.0.0.1:0", "[::1]:0"] {
            let listener = std::net::TcpListener::bind(host).unwrap();
            let address = listener.local_addr().unwrap();
            assert!(super::owns_tcp_listener(std::process::id(), address).unwrap());
            assert!(!super::owns_tcp_listener(0, address).unwrap());
        }
    }

    #[test]
    #[ignore = "reads the current Windows user's AppContainer registry; run explicitly on the desktop"]
    fn installed_uwp_apps_are_detected() {
        let apps = super::get_uwp_apps().expect("enumerate UWP mappings");
        assert!(
            !apps.is_empty(),
            "this desktop must have installed UWP applications"
        );
        assert!(apps.iter().all(|app| !app.display_name.is_empty()));
        assert!(
            apps.iter().any(|app| !app.package_name.is_empty()),
            "registry values must be read successfully"
        );
        println!(
            "Detected {} UWP applications with readable names",
            apps.len()
        );
    }

    #[test]
    fn core_path_validation_rejects_a_sibling_executable() {
        let root = std::env::temp_dir().join(format!(
            "winbox-core-path-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        let core_dir = root.join("core");
        let other_dir = root.join("other");
        fs::create_dir_all(&core_dir).expect("core directory");
        fs::create_dir_all(&other_dir).expect("other directory");
        let core_executable = core_dir.join("sing-box.exe");
        let other_executable = other_dir.join("sing-box.exe");
        fs::write(&core_executable, b"fixture").expect("core fixture");
        fs::write(&other_executable, b"fixture").expect("other fixture");

        assert!(validate_core_executable(&core_executable, &core_dir).is_ok());
        assert!(validate_core_executable(&other_executable, &core_dir).is_err());

        fs::remove_dir_all(root).expect("test cleanup");
    }
}
