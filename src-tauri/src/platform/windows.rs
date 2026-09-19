use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::ffi::{c_void, OsStr, OsString};
use std::fs::{self, OpenOptions};
use std::io::{self, Error, ErrorKind, Write};
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::os::windows::io::RawHandle;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

pub const AUTOSTART_TASK_NAME: &str = "WinBoxAutostart";
pub const AUTOSTART_DELAY: &str = "PT30S";
pub const CORE_EXECUTABLE_NAME: &str = "sing-box.exe";

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
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
        let detail = run_system_tool("reg.exe", [OsString::from("QUERY"), OsString::from(key)])?;
        if !detail.status.success() {
            continue;
        }
        let display_name = reg_value(&detail.stdout, "DisplayName").unwrap_or_default();
        if display_name.contains("ms-resource") || display_name.is_empty() {
            continue;
        }
        apps.push(UwpAppRecord {
            sid: sid.clone(),
            display_name,
            package_name: reg_value(&detail.stdout, "Moniker").unwrap_or_default(),
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

pub fn set_autostart(executable: &Path, enabled: bool) -> io::Result<()> {
    if enabled {
        let executable = existing_absolute_executable(executable)?;
        let xml_path = write_task_xml(&render_autostart_xml(&executable))?;
        let result = run_schtasks([
            OsString::from("/Create"),
            OsString::from("/TN"),
            OsString::from(AUTOSTART_TASK_NAME),
            OsString::from("/XML"),
            xml_path.clone().into_os_string(),
            OsString::from("/F"),
        ])
        .and_then(|output| ensure_schtasks_success("create autostart task", output));
        let cleanup = fs::remove_file(&xml_path);
        if let Err(error) = result {
            let _ = cleanup;
            return Err(error);
        }
        cleanup?;

        if !query_autostart()? {
            return Err(Error::other(
                "schtasks reported success but WinBoxAutostart was not found",
            ));
        }
        Ok(())
    } else {
        if !query_autostart()? {
            return Ok(());
        }

        let output = run_schtasks([
            OsString::from("/Delete"),
            OsString::from("/TN"),
            OsString::from(AUTOSTART_TASK_NAME),
            OsString::from("/F"),
        ])?;
        ensure_schtasks_success("delete autostart task", output)?;
        if query_autostart()? {
            return Err(Error::other(
                "schtasks reported success but WinBoxAutostart still exists",
            ));
        }
        Ok(())
    }
}

pub fn query_autostart() -> io::Result<bool> {
    let output = run_schtasks([
        OsString::from("/Query"),
        OsString::from("/TN"),
        OsString::from(AUTOSTART_TASK_NAME),
        OsString::from("/FO"),
        OsString::from("LIST"),
    ])?;
    if output.status.success() {
        return Ok(true);
    }
    if task_is_missing(&output) {
        return Ok(false);
    }
    Err(schtasks_error("query autostart task", &output))
}

pub fn render_autostart_xml(executable: &Path) -> String {
    let command = xml_escape(&task_path(executable));
    let working_directory = executable
        .parent()
        .map(task_path)
        .map(|path| xml_escape(&path))
        .unwrap_or_default();

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>{AUTOSTART_DELAY}</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{command}</Command>
      <Arguments>-minimized</Arguments>
      <WorkingDirectory>{working_directory}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"#
    )
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

fn write_task_xml(xml: &str) -> io::Result<PathBuf> {
    let temp_dir = std::env::temp_dir();
    for attempt in 0..100u32 {
        let path = temp_dir.join(format!(
            "WinBoxAutostart-{}-{attempt}.xml",
            std::process::id()
        ));
        let file = OpenOptions::new().write(true).create_new(true).open(&path);
        let mut file = match file {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        };
        if let Err(error) = file.write_all(xml.as_bytes()).and_then(|()| file.flush()) {
            let _ = fs::remove_file(&path);
            return Err(error);
        }
        return Ok(path);
    }
    Err(Error::new(
        ErrorKind::AlreadyExists,
        "could not allocate a temporary task XML path",
    ))
}

fn run_schtasks<I, S>(args: I) -> io::Result<Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    run_system_tool("schtasks.exe", args)
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

fn reg_value(bytes: &[u8], name: &str) -> Option<String> {
    let text = String::from_utf8_lossy(bytes);
    text.lines().find_map(|line| {
        let trimmed = line.trim();
        let rest = trimmed.strip_prefix(name)?;
        let rest = rest.trim_start();
        let rest = rest.strip_prefix("REG_SZ")?.trim_start();
        Some(rest.to_owned())
    })
}

fn ensure_schtasks_success(action: &str, output: Output) -> io::Result<()> {
    if output.status.success() {
        Ok(())
    } else {
        Err(schtasks_error(action, &output))
    }
}

fn schtasks_error(action: &str, output: &Output) -> io::Error {
    Error::other(format!("{action} failed: {}", output_text(output)))
}

fn task_is_missing(output: &Output) -> bool {
    let text = output_text(output).to_ascii_lowercase();
    text.contains("cannot find the path specified")
        || text.contains("cannot find the file specified")
        || text.contains("not found")
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

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    task_path(left)
        .replace('/', "\\")
        .eq_ignore_ascii_case(&task_path(right).replace('/', "\\"))
}

#[cfg(test)]
mod tests {
    use super::{render_autostart_xml, validate_core_executable, AUTOSTART_DELAY};
    use std::fs;
    use std::path::Path;

    #[test]
    fn task_xml_preserves_startup_contract_and_escapes_path() {
        let xml = render_autostart_xml(Path::new(r"C:\Users\A & B\WinBox.exe"));

        assert!(xml.contains(&format!("<Delay>{AUTOSTART_DELAY}</Delay>")));
        assert!(xml.contains("<RunLevel>HighestAvailable</RunLevel>"));
        assert!(xml.contains("<Arguments>-minimized</Arguments>"));
        assert!(xml.contains("C:\\Users\\A &amp; B\\WinBox.exe"));
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
