mod files;
mod models;
mod sqlserver;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            sqlserver::test_sqlserver_connection,
            sqlserver::execute_sql_query,
            files::read_file_bytes,
            files::read_text_file,
            files::write_text_file,
        ])
        .setup(|app| {
            // macOS 菜单栏：文件菜单，向前端派发菜单动作事件
            let file_menu = SubmenuBuilder::new(app, "文件")
                .item(&MenuItemBuilder::with_id("import_file", "导入数据文件…").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("open_project", "打开项目…").build(app)?)
                .item(&MenuItemBuilder::with_id("save_project", "保存项目…").build(app)?)
                .build()?;

            let menu = MenuBuilder::new(app).item(&file_menu).build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.clone();
            let _ = app.emit("menu-action", id);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
