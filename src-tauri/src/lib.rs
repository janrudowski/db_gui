mod commands;
mod connection;
mod db;

use commands::{
    alter_table, begin_transaction, commit_transaction, connect_to_database, create_schema,
    delete_connection, delete_row, disconnect_from_database, drop_schema, drop_table,
    execute_query, export_data, get_columns, get_connections, get_distinct_values, get_schemas,
    get_table_data, get_tables, get_transaction_status, insert_row, rollback_transaction,
    save_connection, test_connection, update_row, AppState,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path");

            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");

            let salt_path = app_data_dir.join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_connections,
            save_connection,
            delete_connection,
            test_connection,
            connect_to_database,
            disconnect_from_database,
            get_schemas,
            get_tables,
            get_columns,
            get_table_data,
            get_distinct_values,
            execute_query,
            update_row,
            insert_row,
            delete_row,
            create_schema,
            drop_schema,
            drop_table,
            alter_table,
            export_data,
            begin_transaction,
            commit_transaction,
            rollback_transaction,
            get_transaction_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
