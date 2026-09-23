//! Windows process tokens and same-account privilege changes. No arbitrary executable API.
use std::os::windows::ffi::OsStrExt;
use std::{io, mem::size_of, path::PathBuf};
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::{
    Foundation::*,
    Security::*,
    System::Threading::*,
    UI::{Shell::*, WindowsAndMessaging::*},
};

struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
fn err(e: windows::core::Error) -> io::Error {
    io::Error::other(e)
}
fn wide(s: &std::ffi::OsStr) -> Vec<u16> {
    s.encode_wide().chain(Some(0)).collect()
}
fn process(pid: u32) -> io::Result<Handle> {
    unsafe {
        OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
            false,
            pid,
        )
        .map(Handle)
        .map_err(err)
    }
}
fn token(process: HANDLE, rights: TOKEN_ACCESS_MASK) -> io::Result<Handle> {
    let mut h = HANDLE::default();
    unsafe {
        OpenProcessToken(process, rights, &mut h).map_err(err)?;
    }
    Ok(Handle(h))
}
fn information(token: HANDLE, class: TOKEN_INFORMATION_CLASS) -> io::Result<Vec<usize>> {
    let mut bytes = 0;
    unsafe {
        let _ = GetTokenInformation(token, class, None, 0, &mut bytes);
    }
    if bytes == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut buffer = vec![0usize; (bytes as usize).div_ceil(size_of::<usize>())];
    unsafe {
        GetTokenInformation(
            token,
            class,
            Some(buffer.as_mut_ptr().cast()),
            bytes,
            &mut bytes,
        )
        .map_err(err)?;
    }
    Ok(buffer)
}
fn elevated(token: HANDLE) -> io::Result<bool> {
    let data = information(token, TokenElevation)?;
    Ok(unsafe { (*(data.as_ptr().cast::<TOKEN_ELEVATION>())).TokenIsElevated != 0 })
}
pub fn is_elevated() -> io::Result<bool> {
    elevated(token(unsafe { GetCurrentProcess() }, TOKEN_QUERY)?.0)
}
fn same_user(other: HANDLE) -> io::Result<()> {
    let current = token(unsafe { GetCurrentProcess() }, TOKEN_QUERY)?;
    let a = information(current.0, TokenUser)?;
    let b = information(other, TokenUser)?;
    unsafe {
        EqualSid((*(a.as_ptr().cast::<TOKEN_USER>())).User.Sid, (*(b.as_ptr().cast::<TOKEN_USER>())).User.Sid)
        .map_err(|_| io::Error::other("Switching Windows accounts is not supported. Use the same account for authorization."))?;
    }
    let a = information(current.0, TokenSessionId)?;
    let b = information(other, TokenSessionId)?;
    if a != b {
        return Err(io::Error::other(
            "The process belongs to another Windows session",
        ));
    }
    Ok(())
}
pub fn verify_peer(pid: u32, expected_elevated: bool) -> io::Result<()> {
    let peer = process(pid)?;
    let t = token(peer.0, TOKEN_QUERY)?;
    same_user(t.0)?;
    if elevated(t.0)? != expected_elevated {
        return Err(io::Error::other("Unexpected process privilege level"));
    }
    let mut data = vec![0u16; 32768];
    let mut length = data.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            peer.0,
            PROCESS_NAME_WIN32,
            PWSTR(data.as_mut_ptr()),
            &mut length,
        )
        .map_err(err)?;
    }
    use std::os::windows::ffi::OsStringExt;
    let peer_path = PathBuf::from(std::ffi::OsString::from_wide(&data[..length as usize]));
    if std::fs::canonicalize(peer_path)? != std::fs::canonicalize(std::env::current_exe()?)? {
        return Err(io::Error::other(
            "Privilege handoff must use this WinBox executable",
        ));
    }
    Ok(())
}
pub struct ParentProcess(Handle);
impl ParentProcess {
    pub fn open(pid: u32) -> io::Result<Self> {
        process(pid).map(Self)
    }
    pub fn wait(self) -> io::Result<()> {
        if unsafe { WaitForSingleObject(self.0 .0, 30000) } != WAIT_OBJECT_0 {
            return Err(io::Error::other(
                "The previous WinBox instance did not exit",
            ));
        }
        Ok(())
    }
}

pub fn launch_self(arguments: &str, as_admin: bool) -> io::Result<u32> {
    let exe = std::env::current_exe()?;
    let executable = wide(exe.as_os_str());
    let directory = wide(
        exe.parent()
            .ok_or_else(|| io::Error::other("Missing application directory"))?
            .as_os_str(),
    );
    if as_admin {
        let verb = wide(std::ffi::OsStr::new("runas"));
        let args = wide(std::ffi::OsStr::new(arguments));
        let mut info = SHELLEXECUTEINFOW {
            cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS,
            lpVerb: PCWSTR(verb.as_ptr()),
            lpFile: PCWSTR(executable.as_ptr()),
            lpParameters: PCWSTR(args.as_ptr()),
            lpDirectory: PCWSTR(directory.as_ptr()),
            nShow: SW_SHOWNORMAL.0,
            ..Default::default()
        };
        unsafe {
            ShellExecuteExW(&mut info).map_err(|e| {
                if e.code().0 as u32 == 0x800704c7 {
                    io::Error::new(io::ErrorKind::Interrupted, "Authorization cancelled")
                } else {
                    err(e)
                }
            })?;
        }
        let child = Handle(info.hProcess);
        let pid = unsafe { GetProcessId(child.0) };
        if pid == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(pid)
    } else {
        // Use the current desktop shell's ordinary token, never an inherited admin token.
        let mut shell_pid = 0;
        unsafe {
            GetWindowThreadProcessId(GetShellWindow(), Some(&mut shell_pid));
        }
        let shell = process(shell_pid)?;
        let shell_token = token(shell.0, TOKEN_QUERY | TOKEN_DUPLICATE)?;
        same_user(shell_token.0)?;
        if elevated(shell_token.0)? {
            return Err(io::Error::other(
                "The Windows desktop shell is elevated; restart WinBox normally to update",
            ));
        }
        let mut primary = HANDLE::default();
        unsafe {
            DuplicateTokenEx(
                shell_token.0,
                TOKEN_ALL_ACCESS,
                None,
                SecurityImpersonation,
                TokenPrimary,
                &mut primary,
            )
            .map_err(err)?;
        }
        let primary = Handle(primary);
        let mut environment = std::ptr::null_mut();
        unsafe {
            windows::Win32::System::Environment::CreateEnvironmentBlock(
                &mut environment,
                Some(primary.0),
                false,
            )
            .map_err(err)?;
        }
        let mut command = wide(std::ffi::OsStr::new(&format!(
            "\"{}\" {arguments}",
            exe.display()
        )));
        let startup = STARTUPINFOW {
            cb: size_of::<STARTUPINFOW>() as u32,
            ..Default::default()
        };
        let mut child = PROCESS_INFORMATION::default();
        let result = unsafe {
            CreateProcessWithTokenW(
                primary.0,
                CREATE_PROCESS_LOGON_FLAGS(0),
                PCWSTR(executable.as_ptr()),
                Some(PWSTR(command.as_mut_ptr())),
                CREATE_UNICODE_ENVIRONMENT,
                Some(environment),
                PCWSTR(directory.as_ptr()),
                &startup,
                &mut child,
            )
        };
        unsafe {
            let _ = windows::Win32::System::Environment::DestroyEnvironmentBlock(environment);
        }
        result.map_err(err)?;
        let _process = Handle(child.hProcess);
        let _thread = Handle(child.hThread);
        Ok(child.dwProcessId)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn verifies_current_process_and_rejects_wrong_privilege() {
        let elevated = super::is_elevated().unwrap();
        super::verify_peer(std::process::id(), elevated).unwrap();
        assert!(super::verify_peer(std::process::id(), !elevated).is_err());
    }
}
