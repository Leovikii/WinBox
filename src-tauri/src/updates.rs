use sha2::{Digest, Sha256};
use std::ffi::{OsStr, OsString};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use zip::ZipArchive;

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;
// ponytail: keep extraction bounded while covering the current x64 sing-box binary.
const MAX_EXTRACTED_BYTES: u64 = 128 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TargetArchitecture {
    X64,
}

impl TargetArchitecture {
    pub fn current() -> Result<Self, UpdateError> {
        Self::from_rust_arch(std::env::consts::ARCH)
    }

    pub fn from_rust_arch(arch: &str) -> Result<Self, UpdateError> {
        match arch {
            "x86_64" => Ok(Self::X64),
            other => Err(UpdateError::UnsupportedArchitecture(other.to_owned())),
        }
    }

    fn asset_suffix(self) -> &'static str {
        "windows-amd64"
    }
}

#[derive(Debug)]
pub enum UpdateError {
    Io { path: PathBuf, source: io::Error },
    Zip(zip::result::ZipError),
    UnsupportedArchitecture(String),
    InvalidVersion(String),
    InvalidAssetName { expected: String, actual: String },
    InvalidPortableEntry(String),
    InvalidDigest(String),
    DigestMismatch { expected: String, actual: String },
    UnsafeArchiveEntry(String),
    ArchiveTooLarge,
    ExtractedContentTooLarge,
    TooManyArchiveEntries,
    EmptyExecutable,
    DuplicateExecutable,
    MissingExecutable,
    StagingDirectoryExists(PathBuf),
}

impl std::fmt::Display for UpdateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io { path, source } => write!(f, "I/O failed for {}: {source}", path.display()),
            Self::Zip(source) => write!(f, "invalid ZIP archive: {source}"),
            Self::UnsupportedArchitecture(arch) => {
                write!(f, "unsupported target architecture: {arch}")
            }
            Self::InvalidVersion(version) => write!(f, "invalid release version: {version}"),
            Self::InvalidAssetName { expected, actual } => {
                write!(f, "unexpected asset name {actual}; expected {expected}")
            }
            Self::InvalidPortableEntry(entry) => {
                write!(f, "portable ZIP must contain WinBox.exe, got {entry}")
            }
            Self::InvalidDigest(digest) => write!(f, "invalid SHA-256 digest: {digest}"),
            Self::DigestMismatch { expected, actual } => {
                write!(f, "SHA-256 mismatch; expected {expected}, got {actual}")
            }
            Self::UnsafeArchiveEntry(entry) => {
                write!(f, "unsafe ZIP entry path: {entry}")
            }
            Self::ArchiveTooLarge => write!(f, "ZIP archive exceeds the size limit"),
            Self::ExtractedContentTooLarge => {
                write!(f, "extracted ZIP contents exceed the size limit")
            }
            Self::TooManyArchiveEntries => write!(f, "ZIP archive has too many entries"),
            Self::EmptyExecutable => write!(f, "sing-box.exe is empty"),
            Self::DuplicateExecutable => write!(f, "ZIP contains multiple sing-box.exe entries"),
            Self::MissingExecutable => write!(f, "ZIP does not contain sing-box.exe"),
            Self::StagingDirectoryExists(path) => {
                write!(f, "staging directory already exists: {}", path.display())
            }
        }
    }
}

impl std::error::Error for UpdateError {}

impl From<zip::result::ZipError> for UpdateError {
    fn from(source: zip::result::ZipError) -> Self {
        Self::Zip(source)
    }
}

pub fn expected_sing_box_asset_name(
    version: &str,
    architecture: TargetArchitecture,
) -> Result<String, UpdateError> {
    validate_version(version)?;
    Ok(format!(
        "sing-box-{version}-{}.zip",
        architecture.asset_suffix()
    ))
}

pub fn validate_sing_box_asset_name(
    asset_name: &str,
    version: &str,
    architecture: TargetArchitecture,
) -> Result<(), UpdateError> {
    let expected = expected_sing_box_asset_name(version, architecture)?;
    if asset_name == expected {
        Ok(())
    } else {
        Err(UpdateError::InvalidAssetName {
            expected,
            actual: asset_name.to_owned(),
        })
    }
}

pub fn expected_portable_asset_name(
    version: &str,
    architecture: TargetArchitecture,
) -> Result<String, UpdateError> {
    validate_version(version)?;
    Ok(format!(
        "WinBox-v{version}-{}.zip",
        architecture.asset_suffix()
    ))
}

pub fn validate_portable_asset_name(
    asset_name: &str,
    version: &str,
    architecture: TargetArchitecture,
) -> Result<(), UpdateError> {
    let expected = expected_portable_asset_name(version, architecture)?;
    if asset_name == expected {
        Ok(())
    } else {
        Err(UpdateError::InvalidAssetName {
            expected,
            actual: asset_name.to_owned(),
        })
    }
}

pub fn validate_portable_entry_name(entry_name: &str) -> Result<(), UpdateError> {
    if entry_name == "WinBox.exe" {
        Ok(())
    } else {
        Err(UpdateError::InvalidPortableEntry(entry_name.to_owned()))
    }
}

pub fn stage_portable_archive(
    archive_path: &Path,
    asset_name: &str,
    expected_digest: &str,
    staging_dir: &Path,
    version: &str,
    architecture: TargetArchitecture,
) -> Result<PathBuf, UpdateError> {
    validate_portable_asset_name(asset_name, version, architecture)?;
    let metadata =
        fs::symlink_metadata(archive_path).map_err(|source| io_error(archive_path, source))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(UpdateError::Io {
            path: archive_path.to_path_buf(),
            source: io::Error::new(io::ErrorKind::InvalidInput, "archive is not a regular file"),
        });
    }
    if metadata.len() > MAX_ARCHIVE_BYTES {
        return Err(UpdateError::ArchiveTooLarge);
    }
    let expected_digest = normalize_digest(expected_digest)?;
    let mut archive_file =
        File::open(archive_path).map_err(|source| io_error(archive_path, source))?;
    verify_reader_sha256(&mut archive_file, archive_path, expected_digest)?;
    archive_file
        .seek(SeekFrom::Start(0))
        .map_err(|source| io_error(archive_path, source))?;
    if staging_dir.exists() {
        return Err(UpdateError::StagingDirectoryExists(
            staging_dir.to_path_buf(),
        ));
    }
    if let Some(parent) = staging_dir
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|source| io_error(parent, source))?;
    }
    fs::create_dir(staging_dir).map_err(|source| io_error(staging_dir, source))?;

    let result = stage_portable_contents(archive_file, staging_dir);
    if result.is_err() {
        let _ = fs::remove_dir_all(staging_dir);
    }
    result
}

fn stage_portable_contents(file: File, staging_dir: &Path) -> Result<PathBuf, UpdateError> {
    let mut archive = ZipArchive::new(file)?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(UpdateError::TooManyArchiveEntries);
    }

    let mut executable_path = None;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let components = validate_archive_entry_path(entry.name())?;
        if entry.is_symlink() {
            return Err(UpdateError::UnsafeArchiveEntry(entry.name().to_owned()));
        }
        if entry.is_dir() {
            continue;
        }
        if components
            .last()
            .is_none_or(|part| part != OsStr::new("WinBox.exe"))
        {
            continue;
        }
        if executable_path.is_some() {
            return Err(UpdateError::DuplicateExecutable);
        }
        if entry.size() == 0 {
            return Err(UpdateError::EmptyExecutable);
        }
        if entry.size() > MAX_EXTRACTED_BYTES {
            return Err(UpdateError::ExtractedContentTooLarge);
        }
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|source| io_error(Path::new(entry.name()), source))?;
        let target = staging_dir.join("WinBox.exe");
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|source| io_error(&target, source))?;
        output
            .write_all(&bytes)
            .map_err(|source| io_error(&target, source))?;
        output
            .sync_all()
            .map_err(|source| io_error(&target, source))?;
        executable_path = Some(target);
    }

    executable_path.ok_or(UpdateError::MissingExecutable)
}

pub fn sha256_file(path: &Path) -> Result<String, UpdateError> {
    let mut file = File::open(path).map_err(|source| io_error(path, source))?;
    sha256_reader(&mut file).map_err(|source| io_error(path, source))
}

pub fn verify_sha256(path: &Path, expected: &str) -> Result<(), UpdateError> {
    let expected = normalize_digest(expected)?;
    let mut file = File::open(path).map_err(|source| io_error(path, source))?;
    verify_reader_sha256(&mut file, path, expected)
}

pub fn stage_sing_box_archive(
    archive_path: &Path,
    asset_name: &str,
    expected_digest: &str,
    staging_dir: &Path,
    version: &str,
    architecture: TargetArchitecture,
) -> Result<PathBuf, UpdateError> {
    validate_sing_box_asset_name(asset_name, version, architecture)?;

    let metadata =
        fs::symlink_metadata(archive_path).map_err(|source| io_error(archive_path, source))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(UpdateError::Io {
            path: archive_path.to_path_buf(),
            source: io::Error::new(io::ErrorKind::InvalidInput, "archive is not a regular file"),
        });
    }
    if metadata.len() > MAX_ARCHIVE_BYTES {
        return Err(UpdateError::ArchiveTooLarge);
    }
    let expected_digest = normalize_digest(expected_digest)?;
    let mut archive_file =
        File::open(archive_path).map_err(|source| io_error(archive_path, source))?;
    verify_reader_sha256(&mut archive_file, archive_path, expected_digest)?;
    archive_file
        .seek(SeekFrom::Start(0))
        .map_err(|source| io_error(archive_path, source))?;
    if staging_dir.exists() {
        return Err(UpdateError::StagingDirectoryExists(
            staging_dir.to_path_buf(),
        ));
    }
    if let Some(parent) = staging_dir
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|source| io_error(parent, source))?;
    }
    fs::create_dir(staging_dir).map_err(|source| io_error(staging_dir, source))?;

    let result = stage_archive_contents(archive_file, staging_dir);
    if result.is_err() {
        let _ = fs::remove_dir_all(staging_dir);
    }
    result
}

fn stage_archive_contents(file: File, staging_dir: &Path) -> Result<PathBuf, UpdateError> {
    let mut archive = ZipArchive::new(file)?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(UpdateError::TooManyArchiveEntries);
    }

    let mut total_size = 0_u64;
    let mut executable_path = None;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let components = validate_archive_entry_path(entry.name())?;
        total_size = total_size
            .checked_add(entry.size())
            .ok_or(UpdateError::ArchiveTooLarge)?;
        if total_size > MAX_EXTRACTED_BYTES {
            return Err(UpdateError::ExtractedContentTooLarge);
        }
        if entry.is_symlink() {
            return Err(UpdateError::UnsafeArchiveEntry(entry.name().to_owned()));
        }
        if entry.is_dir() {
            continue;
        }
        if !components
            .last()
            .is_some_and(|part| part == OsStr::new("sing-box.exe"))
        {
            continue;
        }
        if executable_path.is_some() {
            return Err(UpdateError::DuplicateExecutable);
        }
        if entry.size() == 0 {
            return Err(UpdateError::EmptyExecutable);
        }
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|source| io_error(Path::new(entry.name()), source))?;
        let target = staging_dir.join("sing-box.exe");
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|source| io_error(&target, source))?;
        output
            .write_all(&bytes)
            .map_err(|source| io_error(&target, source))?;
        output
            .sync_all()
            .map_err(|source| io_error(&target, source))?;
        executable_path = Some(target);
    }

    executable_path.ok_or(UpdateError::MissingExecutable)
}

fn validate_archive_entry_path(name: &str) -> Result<Vec<OsString>, UpdateError> {
    if name.is_empty() || name.contains('\0') || name.contains('\\') {
        return Err(UpdateError::UnsafeArchiveEntry(name.to_owned()));
    }
    let mut components = Vec::new();
    for component in Path::new(name).components() {
        match component {
            Component::Normal(part)
                if !part.is_empty() && !part.to_string_lossy().contains(':') =>
            {
                components.push(part.to_os_string());
            }
            _ => return Err(UpdateError::UnsafeArchiveEntry(name.to_owned())),
        }
    }
    if components.is_empty() {
        return Err(UpdateError::UnsafeArchiveEntry(name.to_owned()));
    }
    Ok(components)
}

fn validate_version(version: &str) -> Result<(), UpdateError> {
    if version.is_empty()
        || !version
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-'))
    {
        return Err(UpdateError::InvalidVersion(version.to_owned()));
    }
    Ok(())
}

fn normalize_digest(digest: &str) -> Result<String, UpdateError> {
    let value = digest.strip_prefix("sha256:").unwrap_or(digest);
    if value.len() != 64 || !value.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err(UpdateError::InvalidDigest(digest.to_owned()));
    }
    Ok(value.to_ascii_lowercase())
}

fn sha256_reader<R: Read>(reader: &mut R) -> io::Result<String> {
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_reader_sha256<R: Read>(
    reader: &mut R,
    path: &Path,
    expected: String,
) -> Result<(), UpdateError> {
    let actual = sha256_reader(reader).map_err(|source| io_error(path, source))?;
    if actual == expected {
        Ok(())
    } else {
        Err(UpdateError::DigestMismatch { expected, actual })
    }
}

fn io_error(path: &Path, source: io::Error) -> UpdateError {
    UpdateError::Io {
        path: path.to_path_buf(),
        source,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("winbox-updates-{label}-{nonce}"));
        fs::create_dir_all(&path).expect("temporary directory");
        path
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).expect("archive");
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        for (name, content) in entries {
            writer.start_file(*name, options).expect("entry");
            writer.write_all(content).expect("entry content");
        }
        writer.finish().expect("finish archive");
    }

    #[test]
    fn asset_names_follow_target_architecture() {
        assert_eq!(
            TargetArchitecture::from_rust_arch("x86_64").expect("x64"),
            TargetArchitecture::X64
        );
        assert_eq!(
            TargetArchitecture::from_rust_arch("aarch64")
                .expect_err("ARM64 is outside the supported release scope")
                .to_string(),
            "unsupported target architecture: aarch64"
        );
        assert!(TargetArchitecture::from_rust_arch("x86").is_err());
        assert_eq!(
            expected_sing_box_asset_name("1.14.1", TargetArchitecture::X64).expect("asset"),
            "sing-box-1.14.1-windows-amd64.zip"
        );
        assert!(validate_sing_box_asset_name(
            "sing-box-1.14.1-windows-arm64.zip",
            "1.14.1",
            TargetArchitecture::X64
        )
        .is_err());
        assert!(validate_portable_asset_name(
            "WinBox-v2.8.0-windows-amd64.zip",
            "2.8.0",
            TargetArchitecture::X64
        )
        .is_ok());
        assert!(validate_portable_entry_name("WinBox.exe").is_ok());
        assert!(validate_portable_entry_name("winbox.exe").is_err());
    }

    #[test]
    fn extraction_budget_covers_current_x64_core_size() {
        const {
            assert!(MAX_EXTRACTED_BYTES >= 82 * 1024 * 1024);
        }
    }

    #[test]
    fn digest_accepts_github_prefix_and_rejects_mismatch() {
        let root = temp_dir("digest");
        let path = root.join("asset.zip");
        fs::write(&path, b"hello").expect("asset");
        verify_sha256(
            &path,
            "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        )
        .expect("digest");
        assert!(verify_sha256(&path, "00").is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn archive_stages_only_the_expected_executable_without_overwriting_core() {
        let root = temp_dir("stage");
        let archive = root.join("download.part");
        write_zip(
            &archive,
            &[
                ("sing-box-1.14.1/sing-box.exe", b"new core"),
                ("README", b"info"),
            ],
        );
        let core_dir = root.join("core");
        fs::create_dir_all(&core_dir).expect("core directory");
        let existing = core_dir.join("sing-box.exe");
        fs::write(&existing, b"old core").expect("existing core");
        let digest = sha256_file(&archive).expect("archive digest");
        let staged = stage_sing_box_archive(
            &archive,
            "sing-box-1.14.1-windows-amd64.zip",
            &digest,
            &core_dir.join(".update-1"),
            "1.14.1",
            TargetArchitecture::X64,
        )
        .expect("stage archive");
        assert_eq!(fs::read(&staged).expect("staged core"), b"new core");
        assert_eq!(fs::read(&existing).expect("existing core"), b"old core");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn digest_mismatch_does_not_create_staging_directory() {
        let root = temp_dir("digest-stage");
        let archive = root.join("download.zip");
        write_zip(&archive, &[("sing-box.exe", b"core")]);
        let staging = root.join("stage");
        let error = stage_sing_box_archive(
            &archive,
            "sing-box-1.14.1-windows-amd64.zip",
            "0000000000000000000000000000000000000000000000000000000000000000",
            &staging,
            "1.14.1",
            TargetArchitecture::X64,
        )
        .expect_err("wrong digest must fail before staging");
        assert!(matches!(error, UpdateError::DigestMismatch { .. }));
        assert!(!staging.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn archive_rejects_parent_and_absolute_paths() {
        for entry in ["../sing-box.exe", "/sing-box.exe"] {
            let root = temp_dir("unsafe");
            let archive = root.join("download.zip");
            write_zip(&archive, &[(entry, b"core")]);
            let digest = sha256_file(&archive).expect("archive digest");
            let error = stage_sing_box_archive(
                &archive,
                "sing-box-1.14.1-windows-amd64.zip",
                &digest,
                &root.join("stage"),
                "1.14.1",
                TargetArchitecture::X64,
            )
            .expect_err("unsafe path must fail");
            assert!(matches!(error, UpdateError::UnsafeArchiveEntry(_)));
            let _ = fs::remove_dir_all(root);
        }
    }
}
