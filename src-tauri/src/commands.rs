use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "webp"];
const FINISHED_DIR_NAME: &str = "finished";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageListing {
    pub images: Vec<ImageEntry>,
    /// Total number of qualifying images left in the folder, before `limit` is applied.
    pub total_remaining: usize,
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

/// Walks `dir` and its subfolders, appending every qualifying image path found.
fn collect_images(dir: &Path, results: &mut Vec<PathBuf>) {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };
    for entry in read_dir.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if path.is_dir() {
            collect_images(&path, results);
        } else if path.is_file() && is_image_file(&path) {
            results.push(path);
        }
    }
}

#[tauri::command]
pub fn list_images(app: AppHandle, folder: String, limit: usize) -> Result<ImageListing, String> {
    let dir = PathBuf::from(&folder);
    if !dir.is_dir() {
        return Err(format!("'{folder}' is not a valid directory"));
    }

    let mut paths = Vec::new();
    collect_images(&dir, &mut paths);
    paths.sort();

    let total_remaining = paths.len();
    paths.truncate(limit);

    // The user picks folders at runtime via a dialog, so the asset protocol
    // has no static scope for them; grant access (including subfolders,
    // since images can come from anywhere under this folder) on every list.
    app.asset_protocol_scope()
        .allow_directory(&dir, true)
        .map_err(|e| format!("Failed to grant asset access: {e}"))?;

    Ok(ImageListing {
        images: paths
            .into_iter()
            .filter_map(|path| {
                let name = path.file_name()?.to_str()?.to_string();
                Some(ImageEntry {
                    path: path.to_string_lossy().to_string(),
                    name,
                })
            })
            .collect(),
        total_remaining,
    })
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

fn move_files_to(paths: Vec<String>, target: &Path) -> Vec<MoveOutcome> {
    paths
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

            let (dest, renamed) = unique_dest_path(target, &file_name);

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
        .collect()
}

#[tauri::command]
pub fn move_images(paths: Vec<String>, target_dir: String) -> Result<Vec<MoveOutcome>, String> {
    let target = PathBuf::from(&target_dir);
    if !target.is_dir() {
        return Err(format!("'{target_dir}' is not a valid directory"));
    }
    Ok(move_files_to(paths, &target))
}

/// The "finished" folder sits next to the running executable, so images
/// reviewed but not transferred are physically moved out of the source
/// folder and won't reappear as duplicates the next time the app starts.
#[tauri::command]
pub fn move_to_finished(paths: Vec<String>) -> Result<Vec<MoveOutcome>, String> {
    let exe = std::env::current_exe().map_err(|e| format!("Failed to resolve executable path: {e}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "Failed to resolve executable directory".to_string())?;
    let finished_dir = exe_dir.join(FINISHED_DIR_NAME);
    fs::create_dir_all(&finished_dir)
        .map_err(|e| format!("Failed to create finished folder: {e}"))?;

    Ok(move_files_to(paths, &finished_dir))
}
