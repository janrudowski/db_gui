use super::mysql::MySqlConnection;
use super::postgres::PostgresConnection;
use super::sqlite::SqliteConnection;
use super::traits::{DatabaseType, DbConnection, DbResult};
use std::sync::Arc;

pub struct ConnectionFactory;

impl ConnectionFactory {
    pub async fn create(
        db_type: DatabaseType,
        connection_string: &str,
    ) -> DbResult<Arc<dyn DbConnection>> {
        match db_type {
            DatabaseType::PostgreSQL => {
                let conn = PostgresConnection::new(connection_string).await?;
                Ok(Arc::new(conn))
            }
            DatabaseType::MySQL => {
                let conn = MySqlConnection::new(connection_string).await?;
                Ok(Arc::new(conn))
            }
            DatabaseType::SQLite => {
                let conn = SqliteConnection::new(connection_string).await?;
                Ok(Arc::new(conn))
            }
        }
    }

    pub fn build_connection_string(
        db_type: DatabaseType,
        host: &str,
        port: u16,
        database: &str,
        username: &str,
        password: &str,
    ) -> String {
        match db_type {
            DatabaseType::PostgreSQL => {
                format!(
                    "postgres://{}:{}@{}:{}/{}",
                    username, password, host, port, database
                )
            }
            DatabaseType::MySQL => {
                format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username, password, host, port, database
                )
            }
            DatabaseType::SQLite => {
                format!("sqlite:{}", database)
            }
        }
    }
}
