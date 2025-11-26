export type DatabaseType = "postgres" | "mysql" | "sqlite"

function quoteIdentifier(name: string, dbType: DatabaseType): string {
  switch (dbType) {
    case "mysql":
      return `\`${name}\``
    case "postgres":
    case "sqlite":
    default:
      return `"${name}"`
  }
}

function qualifiedName(
  schema: string,
  table: string,
  dbType: DatabaseType
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  if (dbType === "mysql") {
    return q(table)
  }
  return `${q(schema)}.${q(table)}`
}

export interface ColumnInfo {
  name: string
  dataType?: string
  isNullable?: boolean
  defaultValue?: string | null
}

export function generateSelect(
  schema: string,
  table: string,
  columns: ColumnInfo[],
  dbType: DatabaseType = "postgres",
  limit = 100
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  const columnList =
    columns.length > 0 ? columns.map((c) => q(c.name)).join(",\n       ") : "*"

  return `SELECT ${columnList}
  FROM ${tableName}
 LIMIT ${limit};`
}

export function generateInsert(
  schema: string,
  table: string,
  columns: ColumnInfo[],
  dbType: DatabaseType = "postgres"
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  const columnNames = columns.map((c) => q(c.name)).join(", ")
  const placeholders = columns
    .map((c) => {
      if (c.defaultValue) return c.defaultValue
      if (c.dataType?.toLowerCase().includes("int")) return "0"
      if (c.dataType?.toLowerCase().includes("bool")) return "false"
      return "'value'"
    })
    .join(", ")

  return `INSERT INTO ${tableName} (${columnNames})
VALUES (${placeholders});`
}

export function generateUpdate(
  schema: string,
  table: string,
  columns: ColumnInfo[],
  dbType: DatabaseType = "postgres"
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  const setClauses = columns
    .map((c) => {
      const placeholder = c.dataType?.toLowerCase().includes("int")
        ? "0"
        : "'value'"
      return `${q(c.name)} = ${placeholder}`
    })
    .join(",\n       ")

  return `UPDATE ${tableName}
   SET ${setClauses}
 WHERE /* condition */;`
}

export function generateDelete(
  schema: string,
  table: string,
  dbType: DatabaseType = "postgres"
): string {
  const tableName = qualifiedName(schema, table, dbType)

  return `DELETE FROM ${tableName}
 WHERE /* condition */;`
}

export function generateCreateTable(
  schema: string,
  table: string,
  columns: ColumnInfo[],
  dbType: DatabaseType = "postgres"
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  const columnDefs = columns
    .map((c) => {
      let def = `  ${q(c.name)} ${c.dataType || "TEXT"}`
      if (c.isNullable === false) def += " NOT NULL"
      if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`
      return def
    })
    .join(",\n")

  return `CREATE TABLE ${tableName} (
${columnDefs}
);`
}

export function generateDropColumn(
  schema: string,
  table: string,
  column: string,
  dbType: DatabaseType = "postgres"
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  return `ALTER TABLE ${tableName} DROP COLUMN ${q(column)};`
}

export function rowToInsertSql(
  schema: string,
  table: string,
  row: Record<string, unknown>,
  columns: string[],
  dbType: DatabaseType = "postgres"
): string {
  const q = (name: string) => quoteIdentifier(name, dbType)
  const tableName = qualifiedName(schema, table, dbType)

  const columnNames = columns.map((c) => q(c)).join(", ")
  const values = columns
    .map((c) => {
      const val = row[c]
      if (val === null || val === undefined) return "NULL"
      if (typeof val === "number") return String(val)
      if (typeof val === "boolean") return val ? "true" : "false"
      if (typeof val === "object")
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`
      return `'${String(val).replace(/'/g, "''")}'`
    })
    .join(", ")

  return `INSERT INTO ${tableName} (${columnNames}) VALUES (${values});`
}

export function rowToCsv(
  row: Record<string, unknown>,
  columns: string[]
): string {
  return columns
    .map((c) => {
      const val = row[c]
      if (val === null || val === undefined) return ""
      const str = typeof val === "object" ? JSON.stringify(val) : String(val)
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    .join(",")
}

export function rowToJson(
  row: Record<string, unknown>,
  columns: string[]
): string {
  const obj: Record<string, unknown> = {}
  for (const c of columns) {
    obj[c] = row[c]
  }
  return JSON.stringify(obj, null, 2)
}
