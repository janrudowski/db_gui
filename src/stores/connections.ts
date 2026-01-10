import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { invoke } from "@tauri-apps/api/core"
import type {
  ConnectionListItem,
  ConnectionInput,
  TestConnectionInput,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "../types"

export const useConnectionsStore = defineStore("connections", () => {
  const connections = ref<ConnectionListItem[]>([])
  const activeConnectionId = ref<string | null>(null)
  const schemas = ref<Map<string, SchemaInfo[]>>(new Map())
  const tables = ref<Map<string, TableInfo[]>>(new Map())
  const columns = ref<Map<string, ColumnInfo[]>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeConnection = computed(() =>
    connections.value.find((c) => c.id === activeConnectionId.value)
  )

  async function loadConnections() {
    loading.value = true
    error.value = null
    try {
      connections.value = await invoke<ConnectionListItem[]>("get_connections")
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function saveConnection(input: ConnectionInput): Promise<string> {
    const id = await invoke<string>("save_connection", { input })
    await loadConnections()
    return id
  }

  async function deleteConnection(id: string) {
    await invoke("delete_connection", { id })
    if (activeConnectionId.value === id) {
      activeConnectionId.value = null
    }
    schemas.value.delete(id)
    tables.value.delete(id)
    await loadConnections()
  }

  async function testConnection(input: TestConnectionInput): Promise<boolean> {
    return await invoke<boolean>("test_connection", { input })
  }

  const CONNECTION_TIMEOUT_MS = 15000

  async function connect(id: string) {
    loading.value = true
    error.value = null
    try {
      const connectPromise = invoke("connect_to_database", { id })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error("Connection timed out. Database may be unavailable.")
            ),
          CONNECTION_TIMEOUT_MS
        )
      )
      await Promise.race([connectPromise, timeoutPromise])
      activeConnectionId.value = id
      await loadSchemas(id)
    } catch (e) {
      error.value = String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function disconnect(id: string) {
    await invoke("disconnect_from_database", { id })
    if (activeConnectionId.value === id) {
      activeConnectionId.value = null
    }
    schemas.value.delete(id)
    tables.value.delete(id)
  }

  async function loadSchemas(connectionId: string) {
    const result = await invoke<SchemaInfo[]>("get_schemas", {
      connectionId,
    })
    schemas.value.set(connectionId, result)
  }

  async function loadTables(connectionId: string, schema: string) {
    const result = await invoke<TableInfo[]>("get_tables", {
      connectionId,
      schema,
    })
    const key = `${connectionId}:${schema}`
    tables.value.set(key, result)
  }

  function getSchemas(connectionId: string): SchemaInfo[] {
    return schemas.value.get(connectionId) || []
  }

  function getTables(connectionId: string, schema: string): TableInfo[] {
    const key = `${connectionId}:${schema}`
    return tables.value.get(key) || []
  }

  async function getColumns(
    connectionId: string,
    schema: string,
    table: string
  ): Promise<ColumnInfo[]> {
    const key = `${connectionId}:${schema}:${table}`
    const cached = columns.value.get(key)
    if (cached) return cached

    const result = await invoke<ColumnInfo[]>("get_columns", {
      connectionId,
      schema,
      table,
    })
    columns.value.set(key, result)
    return result
  }

  function getCachedColumns(
    connectionId: string,
    schema: string,
    table: string
  ): ColumnInfo[] {
    const key = `${connectionId}:${schema}:${table}`
    return columns.value.get(key) || []
  }

  function getAllCachedColumns(): Map<string, ColumnInfo[]> {
    return columns.value
  }

  return {
    connections,
    activeConnectionId,
    activeConnection,
    schemas,
    tables,
    columns,
    loading,
    error,
    loadConnections,
    saveConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    loadSchemas,
    loadTables,
    getSchemas,
    getTables,
    getColumns,
    getCachedColumns,
    getAllCachedColumns,
  }
})
