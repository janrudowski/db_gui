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

export interface IndexInfo {
  name: string
  columns: string[]
  is_unique: boolean
  is_primary: boolean
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

export type TabType =
  | "data-grid"
  | "sql-editor"
  | "table-creator"
  | "table-designer"
  | "schema-creator"

export interface TabIcon {
  icon: string
  color?: string
}

export const TAB_ICONS: Record<TabType, TabIcon> = {
  "data-grid": { icon: "pi pi-table", color: "var(--amber-500)" },
  "sql-editor": { icon: "pi pi-code", color: "var(--amber-400)" },
  "table-creator": { icon: "pi pi-plus-circle", color: "var(--amber-500)" },
  "table-designer": { icon: "pi pi-pencil", color: "var(--amber-400)" },
  "schema-creator": { icon: "pi pi-database", color: "var(--amber-500)" },
}

export interface Tab {
  id: string
  type: TabType
  title: string
  connectionId: string
  schema?: string
  table?: string
  query?: string
  isDirty?: boolean
  metadata?: Record<string, unknown>
}

export interface Pane {
  id: string
  tabs: Tab[]
  activeTabId: string | null
}

export interface ColumnChange {
  action: "add" | "modify" | "drop" | "rename"
  column: string
  newName?: string
  dataType?: string
  isNullable?: boolean
  defaultValue?: string | null
}

export interface AlterTableParams {
  schema: string
  table: string
  changes: ColumnChange[]
}
