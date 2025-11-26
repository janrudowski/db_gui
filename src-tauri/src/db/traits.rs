use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaInfo {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: u64,
    pub execution_time_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortColumn {
    pub column: String,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub column: String,
    pub operator: FilterOperator,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FilterOperator {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    IsNull,
    IsNotNull,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchDataParams {
    pub schema: String,
    pub table: String,
    pub limit: i64,
    pub offset: i64,
    pub sort: Option<Vec<SortColumn>>,
    pub filters: Option<Vec<FilterCondition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowUpdate {
    pub schema: String,
    pub table: String,
    pub primary_key_column: String,
    pub primary_key_value: serde_json::Value,
    pub updates: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowInsert {
    pub schema: String,
    pub table: String,
    pub values: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowDelete {
    pub schema: String,
    pub table: String,
    pub primary_key_column: String,
    pub primary_key_value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColumnChangeAction {
    Add,
    Modify,
    Drop,
    Rename,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnChange {
    pub action: ColumnChangeAction,
    pub column: String,
    pub new_name: Option<String>,
    pub data_type: Option<String>,
    pub is_nullable: Option<bool>,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlterTableParams {
    pub schema: String,
    pub table: String,
    pub changes: Vec<ColumnChange>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    PostgreSQL,
    MySQL,
    SQLite,
}

impl std::fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseType::PostgreSQL => write!(f, "PostgreSQL"),
            DatabaseType::MySQL => write!(f, "MySQL"),
            DatabaseType::SQLite => write!(f, "SQLite"),
        }
    }
}

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Query error: {0}")]
    Query(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
}

impl Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[async_trait]
pub trait DbConnection: Send + Sync {
    fn db_type(&self) -> DatabaseType;

    async fn test_connection(&self) -> DbResult<()>;

    async fn get_schemas(&self) -> DbResult<Vec<SchemaInfo>>;

    async fn get_tables(&self, schema: &str) -> DbResult<Vec<TableInfo>>;

    async fn get_columns(&self, schema: &str, table: &str) -> DbResult<Vec<ColumnInfo>>;

    async fn get_table_data(&self, params: FetchDataParams) -> DbResult<TableData>;

    async fn execute_query(&self, sql: &str) -> DbResult<QueryResult>;

    async fn update_row(&self, update: RowUpdate) -> DbResult<u64>;

    async fn insert_row(&self, insert: RowInsert) -> DbResult<serde_json::Value>;

    async fn delete_row(&self, delete: RowDelete) -> DbResult<u64>;

    async fn create_schema(&self, name: &str) -> DbResult<()>;

    async fn drop_schema(&self, name: &str, cascade: bool) -> DbResult<()>;

    async fn drop_table(&self, schema: &str, table: &str, cascade: bool) -> DbResult<()>;

    async fn alter_table(&self, params: AlterTableParams) -> DbResult<()>;

    async fn close(&self) -> DbResult<()>;
}
