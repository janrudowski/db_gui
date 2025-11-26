import * as monaco from "monaco-editor"
import type { SchemaInfo, TableInfo, ColumnInfo } from "../types"

export interface SchemaMetadata {
  schemas: SchemaInfo[]
  tables: Map<string, TableInfo[]>
  columns: Map<string, ColumnInfo[]>
}

export function registerSqlCompletionProvider(
  metadata: SchemaMetadata
): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " ", "("],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1)

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

        for (const [key, columns] of metadata.columns.entries()) {
          const [_schema, tableName] = key.split(":")
          if (tableName?.toLowerCase() === prefix) {
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

        if (suggestions.length > 0) {
          return { suggestions }
        }
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
        })
      })

      metadata.schemas.forEach((schema) => {
        suggestions.push({
          label: schema.name,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: schema.name,
          range,
          detail: "Schema",
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
          })

          suggestions.push({
            label: `${schemaName}.${table.name}`,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `${schemaName}.${table.name}`,
            range,
            detail: "Fully qualified table",
          })
        })
      }

      return { suggestions }
    },
  })
}

export function configureMonacoDefaults(): void {
  monaco.editor.defineTheme("db-gui-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#858585",
      "editor.selectionBackground": "#264f78",
      "editor.lineHighlightBackground": "#2a2d2e",
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
