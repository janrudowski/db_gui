use crate::connection::{ConnectionStore, SavedConnection};
use crate::db::{
    AlterTableParams, ColumnInfo, ConnectionFactory, DatabaseType, DbConnection, FetchDataParams,
    FilterCondition, QueryResult, RowDelete, RowInsert, RowUpdate, SchemaInfo, SortColumn,
    TableData, TableInfo,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub struct AppState {
    pub connection_store: RwLock<ConnectionStore>,
    pub active_connections: RwLock<HashMap<String, Arc<dyn DbConnection>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connection_store: RwLock::new(ConnectionStore::load()),
            active_connections: RwLock::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionInput {
    pub name: String,
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct ConnectionListItem {
    pub id: String,
    pub name: String,
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
}

#[tauri::command]
pub async fn get_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionListItem>, String> {
    let store = state.connection_store.read().await;
    Ok(store
        .connections
        .iter()
        .map(|c| ConnectionListItem {
            id: c.id.clone(),
            name: c.name.clone(),
            db_type: c.db_type,
            host: c.host.clone(),
            port: c.port,
            database: c.database.clone(),
            username: c.username.clone(),
        })
        .collect())
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, AppState>,
    input: ConnectionInput,
) -> Result<String, String> {
    let conn = SavedConnection::new(
        input.name,
        input.db_type,
        input.host,
        input.port,
        input.database,
        input.username,
        input.password,
    );
    let id = conn.id.clone();

    let mut store = state.connection_store.write().await;
    store.add(conn);
    store.save().map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn delete_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut store = state.connection_store.write().await;
    store.remove(&id);
    store.save().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionInput {
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[tauri::command]
pub async fn test_connection(input: TestConnectionInput) -> Result<bool, String> {
    let conn_str = ConnectionFactory::build_connection_string(
        input.db_type,
        &input.host,
        input.port,
        &input.database,
        &input.username,
        &input.password,
    );

    let conn = ConnectionFactory::create(input.db_type, &conn_str)
        .await
        .map_err(|e| e.to_string())?;

    conn.test_connection().await.map_err(|e| e.to_string())?;
    conn.close().await.map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn connect_to_database(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let store = state.connection_store.read().await;
    let saved = store.get(&id).ok_or("Connection not found")?.clone();
    drop(store);

    let conn_str = saved.connection_string();
    let db_conn = ConnectionFactory::create(saved.db_type, &conn_str)
        .await
        .map_err(|e| e.to_string())?;

    let mut active = state.active_connections.write().await;
    active.insert(id, db_conn);

    Ok(())
}

#[tauri::command]
pub async fn disconnect_from_database(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut active = state.active_connections.write().await;
    if let Some(conn) = active.remove(&id) {
        let _ = conn.close().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_schemas(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<Vec<SchemaInfo>, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.get_schemas().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tables(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
) -> Result<Vec<TableInfo>, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.get_tables(&schema).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.get_columns(&schema, &table)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_data(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    limit: i64,
    offset: i64,
    sort: Option<Vec<SortColumn>>,
    filters: Option<Vec<FilterCondition>>,
) -> Result<TableData, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;

    let params = FetchDataParams {
        schema,
        table,
        limit,
        offset,
        sort,
        filters,
    };

    conn.get_table_data(params).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
) -> Result<QueryResult, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.execute_query(&sql).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_row(
    state: State<'_, AppState>,
    connection_id: String,
    update: RowUpdate,
) -> Result<u64, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.update_row(update).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn insert_row(
    state: State<'_, AppState>,
    connection_id: String,
    insert: RowInsert,
) -> Result<serde_json::Value, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.insert_row(insert).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_row(
    state: State<'_, AppState>,
    connection_id: String,
    delete: RowDelete,
) -> Result<u64, String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.delete_row(delete).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_schema(
    state: State<'_, AppState>,
    connection_id: String,
    name: String,
) -> Result<(), String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.create_schema(&name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn drop_schema(
    state: State<'_, AppState>,
    connection_id: String,
    name: String,
    cascade: bool,
) -> Result<(), String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.drop_schema(&name, cascade)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn drop_table(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    cascade: bool,
) -> Result<(), String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.drop_table(&schema, &table, cascade)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn alter_table(
    state: State<'_, AppState>,
    connection_id: String,
    params: AlterTableParams,
) -> Result<(), String> {
    let active = state.active_connections.read().await;
    let conn = active.get(&connection_id).ok_or("No active connection")?;
    conn.alter_table(params).await.map_err(|e| e.to_string())
}
