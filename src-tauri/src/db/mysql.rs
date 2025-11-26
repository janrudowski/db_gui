use super::traits::*;
use async_trait::async_trait;
use sqlx::mysql::{MySqlConnectOptions, MySqlPool, MySqlPoolOptions, MySqlRow};
use sqlx::{Column, Row};
use std::str::FromStr;
use std::time::{Duration, Instant};

pub struct MySqlConnection {
    pool: MySqlPool,
}

impl MySqlConnection {
    pub async fn new(connection_string: &str) -> DbResult<Self> {
        let options = MySqlConnectOptions::from_str(connection_string)
            .map_err(|e| DbError::Connection(e.to_string()))?;

        let pool = MySqlPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(10))
            .connect_with(options)
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;

        Ok(Self { pool })
    }

    fn extract_value(&self, row: &MySqlRow, col_name: &str, data_type: &str) -> serde_json::Value {
        let dt_lower = data_type.to_lowercase();
        if dt_lower.contains("int") {
            row.try_get::<i64, _>(col_name)
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null)
        } else if dt_lower.contains("float")
            || dt_lower.contains("double")
            || dt_lower.contains("decimal")
        {
            row.try_get::<f64, _>(col_name)
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null)
        } else if dt_lower.contains("bool") || dt_lower == "tinyint(1)" {
            row.try_get::<bool, _>(col_name)
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null)
        } else {
            row.try_get::<String, _>(col_name)
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null)
        }
    }

    fn build_where_clause(&self, filters: &Option<Vec<FilterCondition>>) -> String {
        let Some(filters) = filters else {
            return String::new();
        };
        if filters.is_empty() {
            return String::new();
        }

        let conditions: Vec<String> = filters
            .iter()
            .map(|f| match f.operator {
                FilterOperator::Equals => {
                    format!("`{}` = '{}'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::NotEquals => {
                    format!("`{}` != '{}'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::Contains => {
                    format!("`{}` LIKE '%{}%'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::StartsWith => {
                    format!("`{}` LIKE '{}%'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::EndsWith => {
                    format!("`{}` LIKE '%{}'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::GreaterThan => {
                    format!("`{}` > '{}'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::LessThan => {
                    format!("`{}` < '{}'", f.column, f.value.replace('\'', "''"))
                }
                FilterOperator::IsNull => format!("`{}` IS NULL", f.column),
                FilterOperator::IsNotNull => format!("`{}` IS NOT NULL", f.column),
                FilterOperator::Raw => format!("`{}` {}", f.column, f.value),
            })
            .collect();

        format!("WHERE {}", conditions.join(" AND "))
    }

    fn build_order_clause(&self, sort: &Option<Vec<SortColumn>>) -> String {
        let Some(sort) = sort else {
            return String::new();
        };
        if sort.is_empty() {
            return String::new();
        }

        let orders: Vec<String> = sort
            .iter()
            .map(|s| {
                let dir = match s.direction {
                    SortDirection::Asc => "ASC",
                    SortDirection::Desc => "DESC",
                };
                format!("`{}` {}", s.column, dir)
            })
            .collect();

        format!("ORDER BY {}", orders.join(", "))
    }
}

#[async_trait]
impl DbConnection for MySqlConnection {
    fn db_type(&self) -> DatabaseType {
        DatabaseType::MySQL
    }

    async fn test_connection(&self) -> DbResult<()> {
        sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;
        Ok(())
    }

    async fn get_schemas(&self) -> DbResult<Vec<SchemaInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT SCHEMA_NAME as schema_name
            FROM information_schema.SCHEMATA
            WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            ORDER BY SCHEMA_NAME
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| SchemaInfo {
                name: row.get("schema_name"),
            })
            .collect())
    }

    async fn get_tables(&self, schema: &str) -> DbResult<Vec<TableInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT TABLE_SCHEMA as table_schema, TABLE_NAME as table_name, TABLE_TYPE as table_type
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_TYPE, TABLE_NAME
            "#,
        )
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| TableInfo {
                schema: row.get("table_schema"),
                name: row.get("table_name"),
                table_type: row.get("table_type"),
            })
            .collect())
    }

    async fn get_columns(&self, schema: &str, table: &str) -> DbResult<Vec<ColumnInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_DEFAULT as column_default,
                COLUMN_KEY as column_key
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| {
                let nullable: String = row.get("is_nullable");
                let column_key: String = row.get("column_key");
                ColumnInfo {
                    name: row.get("column_name"),
                    data_type: row.get("data_type"),
                    is_nullable: nullable == "YES",
                    is_primary_key: column_key == "PRI",
                    default_value: row.get("column_default"),
                }
            })
            .collect())
    }

    async fn get_table_data(&self, params: FetchDataParams) -> DbResult<TableData> {
        let columns = self.get_columns(&params.schema, &params.table).await?;

        let where_clause = self.build_where_clause(&params.filters);
        let order_clause = self.build_order_clause(&params.sort);

        let count_query = format!(
            "SELECT COUNT(*) as count FROM `{}`.`{}` {}",
            params.schema, params.table, where_clause
        );
        let count_row = sqlx::query(&count_query)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;
        let total_count: i64 = count_row.get("count");

        let data_query = format!(
            "SELECT * FROM `{}`.`{}` {} {} LIMIT {} OFFSET {}",
            params.schema, params.table, where_clause, order_clause, params.limit, params.offset
        );
        let rows = sqlx::query(&data_query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;

        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
        for row in rows {
            let mut row_data: Vec<serde_json::Value> = Vec::new();
            for col in &columns {
                let value = self.extract_value(&row, &col.name, &col.data_type);
                row_data.push(value);
            }
            result_rows.push(row_data);
        }

        Ok(TableData {
            columns,
            rows: result_rows,
            total_count,
        })
    }

    async fn execute_query(&self, sql: &str) -> DbResult<QueryResult> {
        let start = Instant::now();
        let sql_lower = sql.trim().to_lowercase();
        let is_select = sql_lower.starts_with("select") || sql_lower.starts_with("with");

        if is_select {
            let rows = sqlx::query(sql)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| DbError::Query(e.to_string()))?;

            let execution_time_ms = start.elapsed().as_millis();

            if rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    rows_affected: 0,
                    execution_time_ms,
                });
            }

            let columns: Vec<String> = rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect();

            let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
            for row in &rows {
                let mut row_data: Vec<serde_json::Value> = Vec::new();
                for col in row.columns() {
                    let value: serde_json::Value = row
                        .try_get::<String, _>(col.name())
                        .map(serde_json::Value::from)
                        .or_else(|_| {
                            row.try_get::<i64, _>(col.name())
                                .map(serde_json::Value::from)
                        })
                        .or_else(|_| {
                            row.try_get::<f64, _>(col.name())
                                .map(serde_json::Value::from)
                        })
                        .unwrap_or(serde_json::Value::Null);
                    row_data.push(value);
                }
                result_rows.push(row_data);
            }

            let rows_affected = result_rows.len() as u64;
            Ok(QueryResult {
                columns,
                rows: result_rows,
                rows_affected,
                execution_time_ms,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(&self.pool)
                .await
                .map_err(|e| DbError::Query(e.to_string()))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: result.rows_affected(),
                execution_time_ms: start.elapsed().as_millis(),
            })
        }
    }

    async fn update_row(&self, update: RowUpdate) -> DbResult<u64> {
        let set_clauses: Vec<String> = update
            .updates
            .keys()
            .map(|col| format!("`{}` = ?", col))
            .collect();

        let sql = format!(
            "UPDATE `{}`.`{}` SET {} WHERE `{}` = ?",
            update.schema,
            update.table,
            set_clauses.join(", "),
            update.primary_key_column
        );

        let bind_values: Vec<String> = update
            .updates
            .values()
            .map(|v| v.to_string().trim_matches('"').to_string())
            .collect();
        let pk_value = update
            .primary_key_value
            .to_string()
            .trim_matches('"')
            .to_string();

        let mut query = sqlx::query(&sql);
        for value in &bind_values {
            query = query.bind(value);
        }
        query = query.bind(&pk_value);

        let result = query
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(result.rows_affected())
    }

    async fn insert_row(&self, insert: RowInsert) -> DbResult<serde_json::Value> {
        let columns: Vec<String> = insert.values.keys().map(|k| format!("`{}`", k)).collect();
        let placeholders: Vec<String> = insert.values.keys().map(|_| "?".to_string()).collect();

        let sql = format!(
            "INSERT INTO `{}`.`{}` ({}) VALUES ({})",
            insert.schema,
            insert.table,
            columns.join(", "),
            placeholders.join(", ")
        );

        let bind_values: Vec<String> = insert
            .values
            .values()
            .map(|v| v.to_string().trim_matches('"').to_string())
            .collect();

        let mut query = sqlx::query(&sql);
        for value in &bind_values {
            query = query.bind(value);
        }

        let result = query
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(serde_json::Value::from(result.last_insert_id()))
    }

    async fn delete_row(&self, delete: RowDelete) -> DbResult<u64> {
        let sql = format!(
            "DELETE FROM `{}`.`{}` WHERE `{}` = ?",
            delete.schema, delete.table, delete.primary_key_column
        );

        let pk_value = delete
            .primary_key_value
            .to_string()
            .trim_matches('"')
            .to_string();
        let result = sqlx::query(&sql)
            .bind(&pk_value)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;

        Ok(result.rows_affected())
    }

    async fn create_schema(&self, name: &str) -> DbResult<()> {
        let sql = format!("CREATE DATABASE `{}`", name);
        sqlx::query(&sql)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;
        Ok(())
    }

    async fn drop_schema(&self, name: &str, _cascade: bool) -> DbResult<()> {
        let sql = format!("DROP DATABASE `{}`", name);
        sqlx::query(&sql)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;
        Ok(())
    }

    async fn drop_table(&self, schema: &str, table: &str, _cascade: bool) -> DbResult<()> {
        let sql = format!("DROP TABLE `{}`.`{}`", schema, table);
        sqlx::query(&sql)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Query(e.to_string()))?;
        Ok(())
    }

    async fn alter_table(&self, params: AlterTableParams) -> DbResult<()> {
        let table_name = format!("`{}`.`{}`", params.schema, params.table);

        for change in params.changes {
            let sql = match change.action {
                ColumnChangeAction::Add => {
                    let data_type = change.data_type.unwrap_or_else(|| "TEXT".to_string());
                    let nullable = if change.is_nullable.unwrap_or(true) {
                        ""
                    } else {
                        " NOT NULL"
                    };
                    let default = change
                        .default_value
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();
                    format!(
                        "ALTER TABLE {} ADD COLUMN `{}` {}{}{}",
                        table_name, change.column, data_type, nullable, default
                    )
                }
                ColumnChangeAction::Drop => {
                    format!("ALTER TABLE {} DROP COLUMN `{}`", table_name, change.column)
                }
                ColumnChangeAction::Rename => {
                    let new_name = change.new_name.unwrap_or_else(|| change.column.clone());
                    format!(
                        "ALTER TABLE {} RENAME COLUMN `{}` TO `{}`",
                        table_name, change.column, new_name
                    )
                }
                ColumnChangeAction::Modify => {
                    let data_type = change.data_type.unwrap_or_else(|| "TEXT".to_string());
                    format!(
                        "ALTER TABLE {} MODIFY COLUMN `{}` {}",
                        table_name, change.column, data_type
                    )
                }
            };

            sqlx::query(&sql)
                .execute(&self.pool)
                .await
                .map_err(|e| DbError::Query(e.to_string()))?;
        }

        Ok(())
    }

    async fn close(&self) -> DbResult<()> {
        self.pool.close().await;
        Ok(())
    }
}
