<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import DataTable from "primevue/datatable"
  import Column from "primevue/column"
  import InputText from "primevue/inputtext"
  import Button from "primevue/button"
  import ContextMenu from "primevue/contextmenu"
  import type { MenuItem } from "primevue/menuitem"
  import ExportDialog from "../export/ExportDialog.vue"
  import ValueInspector from "../common/ValueInspector.vue"
  import ColumnFilter, {
    type ColumnFilterValue,
  } from "../common/ColumnFilter.vue"
  import {
    rowToInsertSql,
    rowToCsv,
    rowToJson,
  } from "../../utils/sql-generator"
  import type {
    TableData,
    SortColumn,
    FilterCondition,
    RowUpdate,
    RowDelete,
    RowInsert,
  } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"

  const props = defineProps<{
    connectionId: string
    schema: string
    table: string
    tabId: string
  }>()

  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const loading = ref(false)
  const tableData = ref<TableData | null>(null)
  const editingRows = ref<Record<string, Record<string, unknown>>>({})
  const filters = ref<Record<string, string>>({})
  const sortField = ref<string | null>(null)
  const sortOrder = ref<1 | -1 | 0>(0)
  const showFilterRow = ref(true)
  const newRow = ref<Record<string, unknown> | null>(null)
  const savingNewRow = ref(false)
  const showExportDialog = ref(false)
  const showValueInspector = ref(false)
  const inspectorValue = ref<unknown>(null)
  const inspectorColumn = ref("")
  const inspectorColumnType = ref("")
  const inspectorRowData = ref<Record<string, unknown> | null>(null)

  const CHUNK_SIZE = 1000
  const ROW_HEIGHT = 40
  const serverFilters = ref<Record<string, ColumnFilterValue>>({})
  const dataTableRef = ref<InstanceType<typeof DataTable> | null>(null)
  const rowContextMenu = ref()
  const contextRow = ref<Record<string, unknown> | null>(null)
  const contextField = ref<string | null>(null)
  const rows = ref<Record<string, unknown>[]>([])

  const primaryKeyColumn = computed(() => {
    return tableData.value?.columns.find((c) => c.is_primary_key)?.name || null
  })

  const displayRows = computed(() => {
    if (newRow.value) {
      return [{ ...newRow.value, __rowIndex: -1 }, ...rows.value]
    }
    return rows.value
  })

  const activeFilterCount = computed(() => {
    return Object.values(filters.value).filter((v) => v.trim() !== "").length
  })

  const virtualScrollerOptions = {
    itemSize: ROW_HEIGHT,
    numToleratedItems: 10,
  }

  function parseFilterValue(column: string, value: string): FilterCondition {
    const trimmed = value.trim()

    const rawPatterns = [
      /^(>=?|<=?|<>|!=)\s*(.+)$/,
      /^LIKE\s+(.+)$/i,
      /^NOT\s+LIKE\s+(.+)$/i,
      /^IN\s*\((.+)\)$/i,
      /^NOT\s+IN\s*\((.+)\)$/i,
      /^BETWEEN\s+(.+)\s+AND\s+(.+)$/i,
      /^IS\s+NULL$/i,
      /^IS\s+NOT\s+NULL$/i,
    ]

    for (const pattern of rawPatterns) {
      if (pattern.test(trimmed)) {
        return { column, operator: "raw", value: trimmed }
      }
    }

    if (trimmed.startsWith("=")) {
      return { column, operator: "equals", value: trimmed.substring(1).trim() }
    }

    return { column, operator: "contains", value: trimmed }
  }

  function convertServerFilter(
    filter: ColumnFilterValue
  ): FilterCondition | null {
    const { column, operator, value } = filter

    switch (operator) {
      case "in":
        if (Array.isArray(value) && value.length > 0) {
          const inList = value
            .map((v) => `'${String(v).replace(/'/g, "''")}'`)
            .join(",")
          return { column, operator: "raw", value: `IN (${inList})` }
        }
        return null
      case "contains":
        return { column, operator: "contains", value: String(value) }
      case "equals":
        return { column, operator: "equals", value: String(value) }
      case "notEquals":
        return {
          column,
          operator: "raw",
          value: `<> '${String(value).replace(/'/g, "''")}'`,
        }
      case "startsWith":
        return {
          column,
          operator: "raw",
          value: `LIKE '${String(value).replace(/'/g, "''")}%'`,
        }
      case "endsWith":
        return {
          column,
          operator: "raw",
          value: `LIKE '%${String(value).replace(/'/g, "''")}'`,
        }
      case "gt":
        return {
          column,
          operator: "raw",
          value: `> '${String(value).replace(/'/g, "''")}'`,
        }
      case "lt":
        return {
          column,
          operator: "raw",
          value: `< '${String(value).replace(/'/g, "''")}'`,
        }
      case "isNull":
        return { column, operator: "raw", value: "IS NULL" }
      case "isNotNull":
        return { column, operator: "raw", value: "IS NOT NULL" }
      default:
        return null
    }
  }

  function getFilterParams(): {
    sort: SortColumn[] | null
    filters: FilterCondition[] | null
  } {
    const sort: SortColumn[] | undefined = sortField.value
      ? [
          {
            column: sortField.value,
            direction: sortOrder.value === 1 ? "asc" : "desc",
          },
        ]
      : undefined

    const filterConditions: FilterCondition[] = Object.entries(filters.value)
      .filter(([_, value]) => value.trim() !== "")
      .map(([column, value]) => parseFilterValue(column, value))

    const serverFilterConditions: FilterCondition[] = Object.values(
      serverFilters.value
    )
      .map((f) => convertServerFilter(f))
      .filter((f): f is FilterCondition => f !== null)

    const allFilters = [...filterConditions, ...serverFilterConditions]

    return {
      sort: sort || null,
      filters: allFilters.length > 0 ? allFilters : null,
    }
  }

  async function loadData() {
    loading.value = true
    try {
      const { sort, filters: filterParams } = getFilterParams()

      const data = await invoke<TableData>("get_table_data", {
        connectionId: props.connectionId,
        schema: props.schema,
        table: props.table,
        limit: CHUNK_SIZE,
        offset: 0,
        sort,
        filters: filterParams,
      })

      tableData.value = data

      rows.value = data.rows.map((row, i) => {
        const obj: Record<string, unknown> = { __rowIndex: i }
        data.columns.forEach((col, colIndex) => {
          obj[col.name] = row[colIndex]
        })
        return obj
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Error loading data",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  function onServerSort(event: {
    sortField?: string | ((item: unknown) => string)
    sortOrder?: number | null
  }) {
    if (event.sortField && typeof event.sortField === "string") {
      sortField.value = event.sortField
      sortOrder.value = (event.sortOrder || 0) as 1 | -1 | 0
    } else {
      sortField.value = null
      sortOrder.value = 0
    }
    loadData()
  }

  function onServerFilter(event: {
    filters: Record<string, ColumnFilterValue>
  }) {
    serverFilters.value = event.filters
    loadData()
  }

  function onCellEditComplete(event: {
    data: Record<string, unknown>
    newValue: unknown
    field: string
  }) {
    const { data, newValue, field } = event
    if (data[field] === newValue) return

    const rowKey = String(data.__rowIndex)
    if (!editingRows.value[rowKey]) {
      editingRows.value[rowKey] = {}
    }
    editingRows.value[rowKey][field] = newValue
    data[field] = newValue
  }

  async function saveRow(rowData: Record<string, unknown>) {
    if (!primaryKeyColumn.value) {
      toast.add({
        severity: "warn",
        summary: "Cannot save",
        detail: "Table has no primary key",
        life: 3000,
      })
      return
    }

    const rowKey = String(rowData.__rowIndex)
    const changes = editingRows.value[rowKey]
    if (!changes || Object.keys(changes).length === 0) return

    try {
      const update: RowUpdate = {
        schema: props.schema,
        table: props.table,
        primary_key_column: primaryKeyColumn.value,
        primary_key_value: rowData[primaryKeyColumn.value],
        updates: changes,
      }

      await invoke("update_row", {
        connectionId: props.connectionId,
        update,
      })

      delete editingRows.value[rowKey]
      toast.add({
        severity: "success",
        summary: "Row updated",
        life: 2000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Update failed",
        detail: String(e),
        life: 5000,
      })
    }
  }

  async function deleteRow(rowData: Record<string, unknown>) {
    if (!primaryKeyColumn.value) {
      toast.add({
        severity: "warn",
        summary: "Cannot delete",
        detail: "Table has no primary key",
        life: 3000,
      })
      return
    }

    try {
      const deleteParams: RowDelete = {
        schema: props.schema,
        table: props.table,
        primary_key_column: primaryKeyColumn.value,
        primary_key_value: rowData[primaryKeyColumn.value],
      }

      await invoke("delete_row", {
        connectionId: props.connectionId,
        delete: deleteParams,
      })

      toast.add({
        severity: "success",
        summary: "Row deleted",
        life: 2000,
      })
      loadData()
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Delete failed",
        detail: String(e),
        life: 5000,
      })
    }
  }

  function hasChanges(rowData: Record<string, unknown>): boolean {
    const rowKey = String(rowData.__rowIndex)
    return (
      !!editingRows.value[rowKey] &&
      Object.keys(editingRows.value[rowKey]).length > 0
    )
  }

  function applyFilter() {
    loadData()
  }

  function clearFilters() {
    filters.value = {}
    loadData()
  }

  function isAutoGeneratedDefault(defaultValue: unknown): boolean {
    if (!defaultValue || typeof defaultValue !== "string") return false
    const lower = defaultValue.toLowerCase()
    return (
      lower.includes("nextval(") ||
      lower.includes("gen_random_uuid()") ||
      lower.includes("uuid_generate") ||
      lower.includes("now()") ||
      lower.includes("current_timestamp") ||
      lower.includes("current_date") ||
      lower.includes("auto_increment")
    )
  }

  function startNewRow() {
    if (!tableData.value) return
    newRow.value = {}
    for (const col of tableData.value.columns) {
      if (isAutoGeneratedDefault(col.default_value)) {
        newRow.value[col.name] = null
      } else {
        newRow.value[col.name] = col.default_value || null
      }
    }
    newRow.value.__isNew = true
  }

  function cancelNewRow() {
    newRow.value = null
  }

  async function saveNewRow() {
    if (!newRow.value || !tableData.value) return

    const values: Record<string, unknown> = {}
    for (const col of tableData.value.columns) {
      const val = newRow.value[col.name]
      if (val !== null && val !== undefined && val !== "") {
        values[col.name] = val
      }
    }

    if (Object.keys(values).length === 0) {
      toast.add({
        severity: "warn",
        summary: "Empty row",
        detail: "Please fill in at least one field",
        life: 3000,
      })
      return
    }

    savingNewRow.value = true
    try {
      const insert: RowInsert = {
        schema: props.schema,
        table: props.table,
        values,
      }

      await invoke("insert_row", {
        connectionId: props.connectionId,
        insert,
      })

      toast.add({
        severity: "success",
        summary: "Row inserted",
        life: 2000,
      })

      newRow.value = null
      loadData()
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Insert failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      savingNewRow.value = false
    }
  }

  function getExportQuery(): string {
    const q = '"'
    return `SELECT * FROM ${q}${props.schema}${q}.${q}${props.table}${q}`
  }

  const columnNames = computed(
    () => tableData.value?.columns.map((c) => c.name) || []
  )

  const rowContextMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: "Copy Row as...",
        icon: "pi pi-copy",
        items: [
          { label: "CSV", command: () => copyRowAs("csv") },
          { label: "JSON", command: () => copyRowAs("json") },
          { label: "SQL INSERT", command: () => copyRowAs("sql") },
        ],
      },
      { separator: true },
      {
        label: "Delete Row",
        icon: "pi pi-trash",
        command: () => contextRow.value && deleteRow(contextRow.value),
      },
    ]

    if (contextField.value) {
      items.push(
        { separator: true },
        {
          label: "Set to NULL",
          icon: "pi pi-ban",
          command: () => {
            if (contextRow.value && contextField.value) {
              const rowKey = String(contextRow.value.__rowIndex)
              if (!editingRows.value[rowKey]) {
                editingRows.value[rowKey] = {}
              }
              editingRows.value[rowKey][contextField.value] = null
              contextRow.value[contextField.value] = null
            }
          },
        },
        {
          label: "Inspect Value",
          icon: "pi pi-search",
          command: () => {
            if (contextRow.value && contextField.value) {
              openInspector(contextRow.value, contextField.value)
            }
          },
        }
      )
    }

    return items
  })

  function onCellContextMenu(
    event: MouseEvent,
    rowData: Record<string, unknown>,
    field?: string
  ) {
    event.preventDefault()
    event.stopPropagation()
    contextRow.value = rowData
    contextField.value = field || null
    rowContextMenu.value.show(event)
  }

  function copyRowAs(format: "csv" | "json" | "sql") {
    if (!contextRow.value) return

    let text = ""
    switch (format) {
      case "csv":
        text = rowToCsv(contextRow.value, columnNames.value)
        break
      case "json":
        text = rowToJson(contextRow.value, columnNames.value)
        break
      case "sql":
        text = rowToInsertSql(
          props.schema,
          props.table,
          contextRow.value,
          columnNames.value
        )
        break
    }

    navigator.clipboard.writeText(text)
    toast.add({
      severity: "success",
      summary: "Copied to clipboard",
      life: 2000,
    })
  }

  function openInspector(rowData: Record<string, unknown>, field: string) {
    const column = tableData.value?.columns.find((c) => c.name === field)
    inspectorRowData.value = rowData
    inspectorColumn.value = field
    inspectorColumnType.value = column?.data_type || ""
    inspectorValue.value = rowData[field]
    showValueInspector.value = true
  }

  function handleInspectorSave(newValue: unknown) {
    if (!inspectorRowData.value || !inspectorColumn.value) return

    const rowIndex = rows.value.findIndex(
      (r) => r?.__rowIndex === inspectorRowData.value?.__rowIndex
    )
    if (rowIndex === -1) return

    const oldValue = inspectorRowData.value[inspectorColumn.value]
    if (oldValue === newValue) return

    inspectorRowData.value[inspectorColumn.value] = newValue

    const rowKey = String(inspectorRowData.value.__rowIndex)
    if (!editingRows.value[rowKey]) {
      editingRows.value[rowKey] = {}
    }
    editingRows.value[rowKey][inspectorColumn.value] = newValue

    saveRow(inspectorRowData.value)
  }

  watch(
    () => [props.connectionId, props.schema, props.table],
    () => {
      filters.value = {}
      sortField.value = null
      sortOrder.value = 0
      editingRows.value = {}
      loadData()
    },
    { immediate: false }
  )

  watch(
    () => editingRows.value,
    (newVal) => {
      const isDirty = Object.keys(newVal).length > 0 || newRow.value !== null
      workspaceStore.setTabDirty(props.tabId, isDirty)
    },
    { deep: true }
  )

  watch(
    () => newRow.value,
    (newVal) => {
      const isDirty =
        Object.keys(editingRows.value).length > 0 || newVal !== null
      workspaceStore.setTabDirty(props.tabId, isDirty)
    }
  )

  async function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      const editedRowKeys = Object.keys(editingRows.value)
      if (editedRowKeys.length > 0) {
        const promises = editedRowKeys.map((rowKey) => {
          const row = displayRows.value.find(
            (r) => r && String(r.__rowIndex) === rowKey
          )
          if (row) return saveRow(row)
          return Promise.resolve()
        })
        await Promise.all(promises)
      }
      if (newRow.value) {
        await saveNewRow()
      }
    }
  }

  onMounted(() => {
    loadData()
    window.addEventListener("keydown", handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown)
  })
</script>

<template>
  <div class="table-view" data-allow-context-menu="true">
    <div class="toolbar">
      <span class="table-info">
        <i class="pi pi-table" />
        {{ schema }}.{{ table }}
        <span v-if="tableData" class="row-count"
          >({{ tableData.total_count }} rows)</span
        >
      </span>
      <div class="toolbar-actions">
        <Button
          icon="pi pi-plus"
          label="New Row"
          size="small"
          outlined
          @click="startNewRow"
          :disabled="!!newRow"
          v-tooltip="'Insert new row'"
        />
        <Button
          :icon="showFilterRow ? 'pi pi-filter-slash' : 'pi pi-filter'"
          text
          rounded
          size="small"
          @click="showFilterRow = !showFilterRow"
          v-tooltip="showFilterRow ? 'Hide Filters' : 'Show Filters'"
          :badge="activeFilterCount > 0 ? String(activeFilterCount) : undefined"
        />
        <Button
          v-if="activeFilterCount > 0"
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="clearFilters"
          v-tooltip="'Clear Filters'"
        />
        <Button
          icon="pi pi-download"
          text
          rounded
          size="small"
          @click="showExportDialog = true"
          v-tooltip="'Export'"
        />
        <Button
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          @click="loadData"
          :loading="loading"
          v-tooltip="'Refresh'"
        />
      </div>
    </div>

    <div v-if="showFilterRow" class="filter-hint">
      <i class="pi pi-info-circle" />
      <span
        >Filter syntax: <code>&gt; 100</code>, <code>LIKE '%test%'</code>,
        <code>IS NULL</code>, <code>IN (1,2,3)</code>, or plain text for
        contains</span
      >
    </div>

    <DataTable
      ref="dataTableRef"
      :value="displayRows"
      :loading="loading"
      scrollable
      scroll-height="flex"
      :virtualScrollerOptions="virtualScrollerOptions"
      @sort="onServerSort"
      :sortField="sortField || undefined"
      :sortOrder="sortOrder"
      editMode="cell"
      @cell-edit-complete="onCellEditComplete"
      class="data-grid"
      stripedRows
      showGridlines
      size="small"
    >
      <Column
        v-for="col in tableData?.columns"
        :key="col.name"
        :field="col.name"
        :header="col.name"
        :sortable="true"
        style="min-width: 120px"
      >
        <template #header>
          <div class="column-header">
            <div class="column-header-content">
              <span class="column-name">
                {{ col.name }}
                <i
                  v-if="col.is_primary_key"
                  class="pi pi-key"
                  style="font-size: 0.7rem; color: var(--p-primary-color)"
                />
              </span>
              <span class="column-type">{{ col.data_type }}</span>
            </div>
            <ColumnFilter
              :column="col.name"
              :connection-id="connectionId"
              :schema="schema"
              :table="table"
              :current-filter="serverFilters[col.name]"
              @apply="
                (f) =>
                  onServerFilter({
                    filters: { ...serverFilters, [f.column]: f },
                  })
              "
              @clear="
                () => {
                  delete serverFilters[col.name]
                  onServerFilter({ filters: { ...serverFilters } })
                }
              "
            />
          </div>
        </template>
        <template #filter>
          <InputText
            v-model="filters[col.name]"
            placeholder="Filter..."
            size="small"
            @keyup.enter="applyFilter"
            style="width: 100%"
          />
        </template>
        <template #editor="slotProps">
          <InputText
            v-model="slotProps.data[slotProps.field as string]"
            autofocus
            style="width: 100%"
          />
        </template>
        <template #body="slotProps">
          <span
            :class="{ 'null-value': slotProps.data[slotProps.field as string] === null }"
            @dblclick="openInspector(slotProps.data, slotProps.field as string)"
            @contextmenu="
              onCellContextMenu(
                $event,
                slotProps.data,
                slotProps.field as string
              )
            "
            class="cell-value"
          >
            {{
              slotProps.data[slotProps.field as string] === null
                ? "NULL"
                : slotProps.data[slotProps.field as string]
            }}
          </span>
        </template>
      </Column>
      <Column header="Actions" frozen alignFrozen="right" style="width: 120px">
        <template #body="{ data }">
          <div class="row-actions">
            <template v-if="data.__isNew">
              <Button
                icon="pi pi-check"
                text
                rounded
                severity="success"
                size="small"
                @click="saveNewRow"
                :loading="savingNewRow"
                v-tooltip="'Save new row'"
              />
              <Button
                icon="pi pi-times"
                text
                rounded
                severity="secondary"
                size="small"
                @click="cancelNewRow"
                v-tooltip="'Cancel'"
              />
            </template>
            <template v-else>
              <Button
                v-if="hasChanges(data)"
                icon="pi pi-check"
                text
                rounded
                severity="success"
                size="small"
                @click="saveRow(data)"
                v-tooltip="'Save changes'"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                size="small"
                @click="deleteRow(data)"
                v-tooltip="'Delete row'"
              />
            </template>
          </div>
        </template>
      </Column>
    </DataTable>

    <ExportDialog
      v-model:visible="showExportDialog"
      :connection-id="connectionId"
      :query="getExportQuery()"
      :total-records="tableData?.total_count || 0"
    />

    <ValueInspector
      v-model:visible="showValueInspector"
      :value="inspectorValue"
      :column-name="inspectorColumn"
      :column-type="inspectorColumnType"
      :editable="true"
      @save="handleInspectorSave"
    />

    <ContextMenu ref="rowContextMenu" :model="rowContextMenuItems" />
  </div>
</template>

<style scoped>
  .table-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--p-surface-0);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--p-surface-200);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--p-surface-100);
    border-bottom: 1px solid var(--p-surface-200);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .table-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .table-info i {
    color: var(--amber-500);
  }

  .row-count {
    color: var(--p-text-muted-color);
    font-weight: 500;
    font-size: 0.8rem;
    font-family: var(--font-mono);
  }

  .filter-hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--p-surface-50);
    border-bottom: 1px solid var(--p-surface-200);
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
  }

  .filter-hint i {
    color: var(--p-primary-color);
  }

  .filter-hint code {
    background: var(--p-surface-200);
    color: var(--p-text-color);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }

  .data-grid {
    flex: 1;
  }

  /* DataTable overrides */
  :deep(.p-datatable) {
    background: transparent;
    border: none;
  }

  :deep(.p-datatable .p-datatable-thead > tr > th) {
    background: var(--p-surface-100);
    border-bottom: 1px solid var(--p-surface-200);
    padding: var(--space-3) var(--space-4);
  }

  :deep(.p-datatable .p-datatable-tbody > tr) {
    background: var(--p-surface-0);
    transition: background var(--transition-fast);
  }

  :deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background: var(--p-surface-50);
  }

  :deep(.p-datatable .p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-surface-100);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--p-text-color);
  }

  :deep(.p-datatable .p-datatable-tbody > tr.p-row-odd) {
    background: var(--p-surface-50);
  }

  :deep(.p-datatable .p-datatable-tbody > tr.p-row-odd:hover) {
    background: var(--p-surface-100);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
  }

  .column-header-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .column-name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-color);
    font-family: var(--font-ui);
  }

  .column-name .pi-key {
    color: var(--p-primary-color) !important;
    font-size: 0.65rem !important;
  }

  .column-type {
    font-size: 0.7rem;
    color: var(--p-text-muted-color);
    font-weight: 500;
    font-family: var(--font-mono);
  }

  .null-value {
    color: var(--p-text-muted-color);
    font-style: italic;
    opacity: 0.8;
  }

  .row-actions {
    display: flex;
    gap: 2px;
  }

  :deep(.p-datatable-tbody tr:first-child.new-row) {
    background: var(--success-glow) !important;
  }

  :deep(.p-datatable-tbody tr:first-child.new-row td) {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .cell-value {
    display: block;
    cursor: pointer;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--space-1);
    margin: calc(-1 * var(--space-1));
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);
  }

  .cell-value:hover {
    background: var(--p-surface-100);
  }

  /* Filter row inputs */
  :deep(.p-datatable .p-datatable-thead .p-column-filter) {
    width: 100%;
  }

  :deep(.p-datatable .p-datatable-thead .p-inputtext) {
    font-size: 0.8rem;
    padding: var(--space-1) var(--space-2);
    background: var(--p-surface-0);
    border-color: var(--p-surface-200);
    font-family: var(--font-mono);
  }

  :deep(.p-datatable .p-datatable-thead .p-inputtext:focus) {
    border-color: var(--p-primary-color);
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
  }

  /* Frozen column styling */
  :deep(.p-datatable .p-datatable-frozen-tbody > tr > td) {
    background: var(--p-surface-0);
  }

  :deep(.p-datatable .p-datatable-frozen-tbody > tr:hover > td) {
    background: var(--p-surface-50);
  }
</style>
