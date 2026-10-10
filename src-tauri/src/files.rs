use std::path::Path;

/// 读取本地文件为原始字节（由 Tauri 负责本地文件读取）。
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("读取文件失败 {path}: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// 读取文本文件（UTF-8）。
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败 {path}: {e}"))
}

/// 写入文本文件（UTF-8）。
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
        }
    }
    std::fs::write(&path, contents).map_err(|e| format!("写入文件失败 {path}: {e}"))
}
