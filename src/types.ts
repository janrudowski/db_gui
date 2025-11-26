export type DatabaseType = "postgresql" | "mysql" | "sqlite"

export interface ConnectionListItem {
  id: string
  name: string
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
}

export interface ConnectionInput {
  name: string
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface TestConnectionInput {
  db_type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface SchemaInfo {
  name: string
}

export interface TableInfo {
  schema: string
  name: string
  table_type: string
}

export interface ColumnInfo {
  name: string
  data_type: string
  is_nullable: boolean
  is_primary_key: boolean
  default_value: string | null
}

export interface TableData {
  columns: ColumnInfo[]
  rows: unknown[][]
  total_count: number
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rows_affected: number
  execution_time_ms: number
}

export interface SortColumn {
  column: string
  direction: "asc" | "desc"
}

export interface FilterCondition {
  column: string
  operator: FilterOperator
  value: string
}

export type FilterOperator =
  | "equals"
  | "notequals"
  | "contains"
  | "startswith"
  | "endswith"
  | "greaterthan"
  | "lessthan"
  | "isnull"
  | "isnotnull"
  | "raw"

export interface RawWhereClause {
  column: string
  fragment: string
}

export interface RowUpdate {
  schema: string
  table: string
  primary_key_column: string
  primary_key_value: unknown
  updates: Record<string, unknown>
}

export interface RowInsert {
  schema: string
  table: string
  values: Record<string, unknown>
}

export interface RowDelete {
  schema: string
  table: string
  primary_key_column: string
  primary_key_value: unknown
}

export type TabType = "table" | "query" | "schema"

export interface Tab {
  id: string
  type: TabType
  title: string
  connectionId: string
  schema?: string
  table?: string
  query?: string
}

export interface Pane {
  id: string
  tabs: Tab[]
  activeTabId: string | null
}
