import * as monaco from "monaco-editor"
import type { SchemaInfo, TableInfo, ColumnInfo } from "../types"

export interface SchemaMetadata {
  schemas: SchemaInfo[]
  tables: Map<string, TableInfo[]>
  columns: Map<string, ColumnInfo[]>
}

interface TableReference {
  schema?: string
  table: string
  alias?: string
}

function extractTableReferences(sql: string): TableReference[] {
  const refs: TableReference[] = []
  const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase()

  const fromMatch = normalizedSql.match(
    /from\s+([\w.]+)(?:\s+(?:as\s+)?(\w+))?/gi
  )
  if (fromMatch) {
    fromMatch.forEach((match) => {
      const parts = match
        .replace(/from\s+/i, "")
        .trim()
        .split(/\s+(?:as\s+)?/i)
      const tablePart = parts[0]
      const alias = parts[1]

      if (tablePart.includes(".")) {
        const [schema, table] = tablePart.split(".")
        refs.push({ schema, table, alias })
      } else {
        refs.push({ table: tablePart, alias })
      }
    })
  }

  const joinMatches = normalizedSql.matchAll(
    /join\s+([\w.]+)(?:\s+(?:as\s+)?(\w+))?/gi
  )
  for (const match of joinMatches) {
    const tablePart = match[1]
    const alias = match[2]

    if (tablePart.includes(".")) {
      const [schema, table] = tablePart.split(".")
      refs.push({ schema, table, alias })
    } else {
      refs.push({ table: tablePart, alias })
    }
  }

  return refs
}

function getColumnsForTables(
  tableRefs: TableReference[],
  metadata: SchemaMetadata
): monaco.languages.CompletionItem[] {
  const suggestions: monaco.languages.CompletionItem[] = []
  const addedColumns = new Set<string>()

  for (const ref of tableRefs) {
    for (const [key, columns] of metadata.columns.entries()) {
      const [schema, tableName] = key.split(":")
      const tableMatches =
        tableName?.toLowerCase() === ref.table.toLowerCase() &&
        (!ref.schema || schema?.toLowerCase() === ref.schema.toLowerCase())

      if (tableMatches) {
        columns.forEach((col) => {
          const prefix = ref.alias || ref.table
          const qualifiedName = `${prefix}.${col.name}`

          if (!addedColumns.has(col.name)) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${col.data_type}${
                col.is_nullable ? " (nullable)" : ""
              } - ${tableName}`,
              sortText: "0" + col.name,
              range: undefined as any,
            })
            addedColumns.add(col.name)
          }

          if (!addedColumns.has(qualifiedName)) {
            suggestions.push({
              label: qualifiedName,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: qualifiedName,
              detail: `${col.data_type}${col.is_nullable ? " (nullable)" : ""}`,
              sortText: "1" + qualifiedName,
              range: undefined as any,
            })
            addedColumns.add(qualifiedName)
          }
        })
      }
    }
  }

  return suggestions
}

function isInSelectClause(sql: string, cursorOffset: number): boolean {
  const beforeCursor = sql.substring(0, cursorOffset).toLowerCase()
  const lastSelect = beforeCursor.lastIndexOf("select")
  const lastFrom = beforeCursor.lastIndexOf("from")
  return lastSelect !== -1 && (lastFrom === -1 || lastSelect > lastFrom)
}

function isInWhereClause(sql: string, cursorOffset: number): boolean {
  const beforeCursor = sql.substring(0, cursorOffset).toLowerCase()
  return (
    beforeCursor.includes("where") &&
    !beforeCursor.match(/where[^)]*$.*\bselect\b/i)
  )
}

function isInOnClause(sql: string, cursorOffset: number): boolean {
  const beforeCursor = sql.substring(0, cursorOffset).toLowerCase()
  const lastOn = beforeCursor.lastIndexOf(" on ")
  const lastJoin = beforeCursor.lastIndexOf("join")
  return lastOn !== -1 && lastOn > lastJoin
}

export function registerSqlCompletionProvider(
  metadata: SchemaMetadata
): monaco.IDisposable {
  console.log("[Monaco] Registering SQL completion provider with metadata:", {
    schemas: metadata.schemas.length,
    tables: metadata.tables.size,
    columns: metadata.columns.size,
  })

  return monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " ", "(", ","],
    provideCompletionItems: (model, position) => {
      console.log("[Monaco] provideCompletionItems called")

      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const fullText = model.getValue()
      const cursorOffset = model.getOffsetAt(position)
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1)

      console.log("[Monaco] Context:", { lineContent, textBeforeCursor, word })

      const suggestions: monaco.languages.CompletionItem[] = []

      const dotMatch = textBeforeCursor.match(/(\w+)\.$/)
      if (dotMatch) {
        const prefix = dotMatch[1].toLowerCase()

        const schemaMatch = metadata.schemas.find(
          (s) => s.name.toLowerCase() === prefix
        )
        if (schemaMatch) {
          const tables = metadata.tables.get(schemaMatch.name) || []
          tables.forEach((table) => {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              range,
              detail: `Table in ${schemaMatch.name}`,
            })
          })
        }

        const tableRefs = extractTableReferences(fullText)
        const matchingRef = tableRefs.find(
          (ref) =>
            ref.table.toLowerCase() === prefix ||
            ref.alias?.toLowerCase() === prefix
        )

        if (matchingRef) {
          for (const [key, columns] of metadata.columns.entries()) {
            const [schema, tableName] = key.split(":")
            if (
              tableName?.toLowerCase() === matchingRef.table.toLowerCase() &&
              (!matchingRef.schema ||
                schema?.toLowerCase() === matchingRef.schema.toLowerCase())
            ) {
              columns.forEach((col) => {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  range,
                  detail: `${col.data_type}${
                    col.is_nullable ? " (nullable)" : ""
                  }`,
                })
              })
            }
          }
        }

        for (const [key, columns] of metadata.columns.entries()) {
          const [_schema, tableName] = key.split(":")
          if (tableName?.toLowerCase() === prefix) {
            columns.forEach((col) => {
              if (!suggestions.find((s) => s.label === col.name)) {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  range,
                  detail: `${col.data_type}${
                    col.is_nullable ? " (nullable)" : ""
                  }`,
                })
              }
            })
          }
        }

        if (suggestions.length > 0) {
          return { suggestions }
        }
      }

      const tableRefs = extractTableReferences(fullText)
      const needsColumnSuggestions =
        tableRefs.length > 0 &&
        (isInSelectClause(fullText, cursorOffset) ||
          isInWhereClause(fullText, cursorOffset) ||
          isInOnClause(fullText, cursorOffset))

      if (needsColumnSuggestions) {
        const columnSuggestions = getColumnsForTables(tableRefs, metadata)
        columnSuggestions.forEach((suggestion) => {
          suggestion.range = range
          suggestions.push(suggestion)
        })
      }

      const keywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "AND",
        "OR",
        "NOT",
        "IN",
        "LIKE",
        "BETWEEN",
        "IS",
        "NULL",
        "TRUE",
        "FALSE",
        "ORDER",
        "BY",
        "ASC",
        "DESC",
        "LIMIT",
        "OFFSET",
        "GROUP",
        "HAVING",
        "JOIN",
        "INNER",
        "LEFT",
        "RIGHT",
        "OUTER",
        "ON",
        "AS",
        "DISTINCT",
        "COUNT",
        "SUM",
        "AVG",
        "MIN",
        "MAX",
        "INSERT",
        "INTO",
        "VALUES",
        "UPDATE",
        "SET",
        "DELETE",
        "CREATE",
        "TABLE",
        "DROP",
        "ALTER",
        "ADD",
        "COLUMN",
        "INDEX",
        "PRIMARY",
        "KEY",
        "FOREIGN",
        "REFERENCES",
        "CONSTRAINT",
        "UNIQUE",
        "DEFAULT",
        "CASCADE",
        "TRUNCATE",
      ]

      keywords.forEach((kw) => {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: "9" + kw,
        })
      })

      metadata.schemas.forEach((schema) => {
        suggestions.push({
          label: schema.name,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: schema.name,
          range,
          detail: "Schema",
          sortText: "2" + schema.name,
        })
      })

      for (const [schemaName, tables] of metadata.tables.entries()) {
        tables.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            range,
            detail: `Table in ${schemaName}`,
            sortText: "3" + table.name,
          })

          suggestions.push({
            label: `${schemaName}.${table.name}`,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `${schemaName}.${table.name}`,
            range,
            detail: "Fully qualified table",
            sortText: "4" + `${schemaName}.${table.name}`,
          })
        })
      }

      console.log("[Monaco] Returning", suggestions.length, "suggestions")
      return { suggestions }
    },
  })
}

export function configureMonacoDefaults(): void {
  monaco.editor.defineTheme("db-gui-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "F59E0B", fontStyle: "bold" },
      { token: "string", foreground: "22D3EE" },
      { token: "number", foreground: "10B981" },
      { token: "comment", foreground: "6B6B7A", fontStyle: "italic" },
      { token: "identifier", foreground: "E8E8ED" },
      { token: "operator", foreground: "F59E0B" },
      { token: "delimiter", foreground: "9090A0" },
      { token: "type", foreground: "FBBF24" },
    ],
    colors: {
      "editor.background": "#0a0a0c",
      "editor.foreground": "#e8e8ed",
      "editorLineNumber.foreground": "#4a4a56",
      "editorLineNumber.activeForeground": "#9090a0",
      "editor.selectionBackground": "#f59e0b33",
      "editor.lineHighlightBackground": "#141418",
      "editor.lineHighlightBorder": "#1c1c21",
      "editorCursor.foreground": "#f59e0b",
      "editorWhitespace.foreground": "#26262d",
      "editorIndentGuide.background": "#1c1c21",
      "editorIndentGuide.activeBackground": "#32323b",
      "editor.selectionHighlightBackground": "#f59e0b22",
      "editorBracketMatch.background": "#f59e0b33",
      "editorBracketMatch.border": "#f59e0b",
      "scrollbarSlider.background": "#32323b80",
      "scrollbarSlider.hoverBackground": "#4a4a56",
      "scrollbarSlider.activeBackground": "#6b6b7a",
      "minimap.background": "#0a0a0c",
      "minimap.selectionHighlight": "#f59e0b44",
    },
  })
}

export function getEditorOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    language: "sql",
    theme: "db-gui-dark",
    automaticLayout: true,
    minimap: {
      enabled: true,
      scale: 1,
      maxColumn: 80,
    },
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    tabSize: 2,
    insertSpaces: true,
    folding: true,
    renderLineHighlight: "all",
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    parameterHints: { enabled: true },
    formatOnPaste: false,
    formatOnType: false,
  }
}
