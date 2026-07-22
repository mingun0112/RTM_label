use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "webp"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoveOutcome {
    pub original_name: String,
    pub moved_to: Option<String>,
    pub renamed: bool,
    pub error: Option<String>,
}

fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[tauri::command]
pub fn list_images(app: AppHandle, folder: String, limit: usize) -> Result<Vec<ImageEntry>, String> {
    let dir = PathBuf::from(&folder);
    if !dir.is_dir() {
        return Err(format!("'{folder}' is not a valid directory"));
    }

    let mut entries: Vec<(String, PathBuf)> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {e}"))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && is_image_file(path))
        .filter_map(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| (name.to_string(), path.clone()))
        })
        .collect();

    entries.sort_by(|a, b| a.0.cmp(&b.0));
    entries.truncate(limit);

    // The user picks folders at runtime via a dialog, so the asset protocol
    // has no static scope for them; grant access to this folder on every list.
    app.asset_protocol_scope()
        .allow_directory(&dir, false)
        .map_err(|e| format!("Failed to grant asset access: {e}"))?;

    Ok(entries
        .into_iter()
        .map(|(name, path)| ImageEntry {
            path: path.to_string_lossy().to_string(),
            name,
        })
        .collect())
}

/// Finds an available path in `target_dir` for `file_name`, appending
/// " (n)" before the extension when a file with that name already exists.
fn unique_dest_path(target_dir: &Path, file_name: &str) -> (PathBuf, bool) {
    let candidate = target_dir.join(file_name);
    if !candidate.exists() {
        return (candidate, false);
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(file_name);
    let ext = Path::new(file_name).extension().and_then(|e| e.to_str());

    let mut counter = 1u32;
    loop {
        let candidate_name = match ext {
            Some(ext) => format!("{stem} ({counter}).{ext}"),
            None => format!("{stem} ({counter})"),
        };
        let candidate = target_dir.join(&candidate_name);
        if !candidate.exists() {
            return (candidate, true);
        }
        counter += 1;
    }
}

fn move_file(source: &Path, dest: &Path) -> std::io::Result<()> {
    // rename() fails across filesystem boundaries (e.g. different drives on
    // Windows), so fall back to copy + delete in that case.
    if fs::rename(source, dest).is_ok() {
        return Ok(());
    }
    fs::copy(source, dest)?;
    fs::remove_file(source)?;
    Ok(())
}

#[tauri::command]
pub fn move_images(paths: Vec<String>, target_dir: String) -> Result<Vec<MoveOutcome>, String> {
    let target = PathBuf::from(&target_dir);
    if !target.is_dir() {
        return Err(format!("'{target_dir}' is not a valid directory"));
    }

    let outcomes = paths
        .into_iter()
        .map(|path_str| {
            let source = PathBuf::from(&path_str);
            let file_name = match source.file_name().and_then(|n| n.to_str()) {
                Some(name) => name.to_string(),
                None => {
                    return MoveOutcome {
                        original_name: path_str,
                        moved_to: None,
                        renamed: false,
                        error: Some("Invalid file path".to_string()),
                    }
                }
            };

            let (dest, renamed) = unique_dest_path(&target, &file_name);

            match move_file(&source, &dest) {
                Ok(()) => MoveOutcome {
                    original_name: file_name,
                    moved_to: Some(dest.to_string_lossy().to_string()),
                    renamed,
                    error: None,
                },
                Err(e) => MoveOutcome {
                    original_name: file_name,
                    moved_to: None,
                    renamed: false,
                    error: Some(e.to_string()),
                },
            }
        })
        .collect();

    Ok(outcomes)
}
