<script setup lang="ts">
  import {
    ref,
    onMounted,
    onUnmounted,
    shallowRef,
    computed,
    nextTick,
  } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import { Splitpanes, Pane } from "splitpanes"
  import "splitpanes/dist/splitpanes.css"
  import Button from "primevue/button"
  import * as monaco from "monaco-editor"
  import { format } from "sql-formatter"
  import type { QueryResult } from "../../types"
  import DataGrid, {
    type GridColumn,
    type LazyLoadEvent,
  } from "../common/DataGrid.vue"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { useConnectionsStore } from "../../stores/connections"
  import { useHistoryStore } from "../../stores/history"
  import {
    configureMonacoDefaults,
    getEditorOptions,
    registerSqlCompletionProvider,
    type SchemaMetadata,
  } from "../../utils/monaco-config"

  const props = defineProps<{
    connectionId: string
    tabId: string
    initialQuery?: string
  }>()

  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const connectionsStore = useConnectionsStore()
  const historyStore = useHistoryStore()

  const editorContainer = ref<HTMLElement | null>(null)
  const editorInstance = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  )
  const completionDisposable = shallowRef<monaco.IDisposable | null>(null)
  const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)

  const loading = ref(false)
  const result = ref<QueryResult | null>(null)
  const error = ref<string | null>(null)
  const currentQuery = ref("")
  const CHUNK_SIZE = 50
  const resultRows = ref<Record<string, unknown>[]>([])
  const loadedChunks = ref<Set<number>>(new Set())

  const gridColumns = computed<GridColumn[]>(() => {
    if (!result.value) return []
    return result.value.columns.map((col) => ({
      name: col,
      dataType: undefined,
      isPrimaryKey: false,
    }))
  })

  function buildSchemaMetadata(): SchemaMetadata {
    const schemas = connectionsStore.getSchemas(props.connectionId)
    const tables = new Map<string, any[]>()
    const columns = new Map<string, any[]>()

    for (const schema of schemas) {
      const schemaTables = connectionsStore.getTables(
        props.connectionId,
        schema.name
      )
      tables.set(schema.name, schemaTables)
    }

    return { schemas, tables, columns }
  }

  onMounted(() => {
    if (!editorContainer.value) return

    configureMonacoDefaults()

    editorInstance.value = monaco.editor.create(editorContainer.value, {
      ...getEditorOptions(),
      value: props.initialQuery || "SELECT * FROM ",
    })

    editorInstance.value.onDidChangeModelContent(() => {
      const query = editorInstance.value?.getValue() || ""
      workspaceStore.updateTabQuery(props.tabId, query)
    })

    editorInstance.value.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => executeQuery()
    )

    editorInstance.value.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => formatQuery()
    )

    const metadata = buildSchemaMetadata()
    completionDisposable.value = registerSqlCompletionProvider(metadata)
  })

  onUnmounted(() => {
    completionDisposable.value?.dispose()
    editorInstance.value?.dispose()
  })

  async function executeQuery() {
    if (!editorInstance.value) return

    const selection = editorInstance.value.getSelection()
    let query = ""

    if (selection && !selection.isEmpty()) {
      query = editorInstance.value.getModel()?.getValueInRange(selection) || ""
    } else {
      query = editorInstance.value.getValue()
    }

    query = query.trim()
    if (!query) {
      toast.add({
        severity: "warn",
        summary: "Empty query",
        detail: "Please enter a SQL query",
        life: 3000,
      })
      return
    }

    loading.value = true
    error.value = null
    result.value = null
    const startTime = Date.now()

    try {
      result.value = await invoke<QueryResult>("execute_query", {
        connectionId: props.connectionId,
        sql: query,
      })

      const duration = Date.now() - startTime

      currentQuery.value = query
      loadedChunks.value.clear()

      resultRows.value = result.value.rows.map((row) => {
        const obj: Record<string, unknown> = { __loaded: true }
        result.value!.columns.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })

      dataGridRef.value?.resetLoadedRanges()

      historyStore.addEntry(
        query,
        props.connectionId,
        "success",
        duration,
        result.value.rows_affected
      )

      toast.add({
        severity: "success",
        summary: "Query executed",
        detail: `${result.value.rows_affected} rows in ${result.value.execution_time_ms}ms`,
        life: 3000,
      })
    } catch (e) {
      const duration = Date.now() - startTime
      error.value = String(e)

      historyStore.addEntry(
        query,
        props.connectionId,
        "error",
        duration,
        undefined,
        String(e)
      )

      toast.add({
        severity: "error",
        summary: "Query failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  function formatQuery() {
    if (!editorInstance.value) return

    try {
      const currentValue = editorInstance.value.getValue()
      const formatted = format(currentValue, {
        language: "postgresql",
        tabWidth: 2,
        keywordCase: "upper",
        linesBetweenQueries: 2,
      })
      editorInstance.value.setValue(formatted)
      toast.add({
        severity: "success",
        summary: "Formatted",
        detail: "SQL formatted successfully",
        life: 2000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Format failed",
        detail: String(e),
        life: 3000,
      })
    }
  }

  async function onLazyLoad(event: LazyLoadEvent) {
    if (!currentQuery.value || loading.value) return

    const chunkStart = Math.floor(event.first / CHUNK_SIZE) * CHUNK_SIZE
    if (loadedChunks.value.has(chunkStart)) return

    loadedChunks.value.add(chunkStart)

    try {
      const chunkResult = await invoke<QueryResult>("execute_query", {
        connectionId: props.connectionId,
        sql: currentQuery.value,
        limit: CHUNK_SIZE,
        offset: chunkStart,
      })

      const newRows = chunkResult.rows.map((row) => {
        const obj: Record<string, unknown> = { __loaded: true }
        chunkResult.columns.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })

      for (let i = 0; i < newRows.length; i++) {
        if (chunkStart + i < resultRows.value.length) {
          resultRows.value[chunkStart + i] = newRows[i]
        } else {
          resultRows.value.push(newRows[i])
        }
      }
    } catch (e) {
      console.error("Lazy load failed:", e)
    }
  }

  function handlePaneResize() {
    nextTick(() => {
      editorInstance.value?.layout()
    })
  }
</script>

<template>
  <div class="sql-editor">
    <div class="editor-toolbar">
      <Button
        label="Execute"
        icon="pi pi-play"
        @click="executeQuery"
        :loading="loading"
        severity="success"
        size="small"
        v-tooltip.bottom="'Ctrl+Enter'"
      />
      <Button
        label="Format"
        icon="pi pi-align-left"
        @click="formatQuery"
        text
        size="small"
        v-tooltip.bottom="'Ctrl+Shift+F'"
      />
      <div class="toolbar-spacer" />
      <span v-if="result" class="execution-info">
        <i class="pi pi-clock" />
        {{ result.execution_time_ms }}ms · {{ result.rows_affected }} rows
      </span>
    </div>

    <Splitpanes
      horizontal
      class="default-theme split-content"
      @resize="handlePaneResize"
    >
      <Pane :size="50" :min-size="20">
        <div class="editor-container" ref="editorContainer" />
      </Pane>
      <Pane :size="50" :min-size="20">
        <div class="results-panel">
          <div v-if="error" class="error-message">
            <i class="pi pi-exclamation-triangle" />
            {{ error }}
          </div>
          <DataGrid
            v-else-if="result && result.columns.length > 0"
            ref="dataGridRef"
            :rows="resultRows"
            :columns="gridColumns"
            :loading="loading"
            :total-records="resultRows.length"
            :paginator="false"
            virtual-scroll
            @lazy-load="onLazyLoad"
          />
          <div v-else-if="result" class="no-results">
            <i class="pi pi-check-circle" />
            <p>Query executed successfully</p>
            <p class="detail">{{ result.rows_affected }} rows affected</p>
          </div>
          <div v-else class="placeholder">
            <i class="pi pi-database" />
            <p>Execute a query to see results</p>
          </div>
        </div>
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
  .sql-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--p-surface-100);
    border-bottom: 1px solid var(--p-surface-200);
  }

  .toolbar-spacer {
    flex: 1;
  }

  .execution-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    padding: 0.25rem 0.5rem;
    background: var(--p-surface-200);
    border-radius: 4px;
  }

  .split-content {
    flex: 1;
    overflow: hidden;
  }

  .editor-container {
    height: 100%;
    overflow: hidden;
  }

  .results-panel {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .error-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    margin: 0.5rem;
    background: var(--p-red-900);
    color: var(--p-red-100);
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }

  .error-message i {
    color: var(--p-red-400);
    font-size: 1.25rem;
  }

  .no-results,
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--p-text-muted-color);
  }

  .no-results i,
  .placeholder i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .no-results .detail {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .rows-info {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
  }
</style>
