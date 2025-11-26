<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import DataTable from "primevue/datatable"
  import Column from "primevue/column"
  import InputText from "primevue/inputtext"
  import Button from "primevue/button"
  import ContextMenu from "primevue/contextmenu"
  import Skeleton from "primevue/skeleton"
  import type { MenuItem } from "primevue/menuitem"
  import ColumnFilter, { type ColumnFilterValue } from "./ColumnFilter.vue"
  import {
    rowToInsertSql,
    rowToCsv,
    rowToJson,
  } from "../../utils/sql-generator"

  export interface GridColumn {
    name: string
    dataType?: string
    isPrimaryKey?: boolean
  }

  export interface SortEvent {
    field: string | null
    order: 1 | -1 | 0
  }

  export interface PageEvent {
    page: number
    rows: number
  }

  export interface LazyLoadEvent {
    first: number
    last: number
  }

  export interface CellEditEvent {
    rowIndex: number
    field: string
    oldValue: unknown
    newValue: unknown
    rowData: Record<string, unknown>
  }

  export interface ServerFilterEvent {
    filters: Record<string, ColumnFilterValue>
  }

  const props = withDefaults(
    defineProps<{
      rows: Record<string, unknown>[]
      columns: GridColumn[]
      loading?: boolean
      totalRecords?: number
      editable?: boolean
      sortable?: boolean
      paginator?: boolean
      pageSize?: number
      showFilters?: boolean
      showExport?: boolean
      lazy?: boolean
      virtualScroll?: boolean
      connectionId?: string
      schema?: string
      table?: string
      dbType?: "postgres" | "mysql" | "sqlite"
    }>(),
    {
      loading: false,
      totalRecords: 0,
      editable: false,
      sortable: true,
      paginator: true,
      pageSize: 100,
      showFilters: false,
      showExport: false,
      lazy: false,
      virtualScroll: false,
      dbType: "postgres",
    }
  )

  const emit = defineEmits<{
    (e: "page", event: PageEvent): void
    (e: "sort", event: SortEvent): void
    (e: "server-sort", event: SortEvent): void
    (e: "server-filter", event: ServerFilterEvent): void
    (e: "filter", filters: Record<string, string>): void
    (e: "cell-edit", event: CellEditEvent): void
    (e: "delete-row", rowData: Record<string, unknown>): void
    (e: "clone-row", rowData: Record<string, unknown>): void
    (e: "set-null", rowData: Record<string, unknown>, field: string): void
    (e: "inspect-cell", rowData: Record<string, unknown>, field: string): void
    (e: "lazy-load", event: LazyLoadEvent): void
    (e: "export"): void
  }>()

  const sortField = ref<string | null>(null)
  const sortOrder = ref<1 | -1 | 0>(0)
  const filters = ref<Record<string, string>>({})
  const columnFilters = ref<Record<string, ColumnFilterValue>>({})
  const editingCells = ref<Record<string, Record<string, unknown>>>({})
  const rowContextMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
  const contextRow = ref<Record<string, unknown> | null>(null)
  const contextField = ref<string | null>(null)
  const loadedRanges = ref<Set<string>>(new Set())

  const activeFilterCount = computed(() => {
    return Object.values(filters.value).filter((v) => v.trim() !== "").length
  })

  const virtualScrollerOptions = computed(() => {
    if (!props.virtualScroll) return { itemSize: 40 }
    return {
      itemSize: 40,
      lazy: true,
      onLazyLoad: onVirtualLazyLoad,
      delay: 150,
    }
  })

  function onVirtualLazyLoad(event: { first: number; last: number }) {
    const rangeKey = `${event.first}-${event.last}`
    if (loadedRanges.value.has(rangeKey)) return

    loadedRanges.value.add(rangeKey)
    emit("lazy-load", { first: event.first, last: event.last })
  }

  function resetLoadedRanges() {
    loadedRanges.value.clear()
  }

  const columnNames = computed(() => props.columns.map((c) => c.name))

  const rowContextMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: "Copy Row as...",
        icon: "pi pi-copy",
        items: [
          {
            label: "CSV",
            command: () => copyRowAs("csv"),
          },
          {
            label: "JSON",
            command: () => copyRowAs("json"),
          },
          {
            label: "SQL INSERT",
            command: () => copyRowAs("sql"),
          },
        ],
      },
    ]

    if (props.editable) {
      items.push(
        { separator: true },
        {
          label: "Clone Row",
          icon: "pi pi-clone",
          command: handleCloneRow,
        },
        {
          label: "Delete Row",
          icon: "pi pi-trash",
          class: "p-menuitem-danger",
          command: () => contextRow.value && handleDeleteRow(contextRow.value),
        }
      )

      if (contextField.value) {
        items.push(
          { separator: true },
          {
            label: "Set to NULL",
            icon: "pi pi-ban",
            command: handleSetNull,
          },
          {
            label: "Inspect Value",
            icon: "pi pi-search",
            command: handleInspect,
          }
        )
      }
    }

    return items
  })

  function onRowContextMenu(
    event: MouseEvent,
    rowData: Record<string, unknown>,
    field?: string
  ) {
    contextRow.value = rowData
    contextField.value = field || null
    rowContextMenu.value?.show(event)
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
          props.schema || "public",
          props.table || "table",
          contextRow.value,
          columnNames.value,
          props.dbType
        )
        break
    }

    navigator.clipboard.writeText(text)
  }

  function handleCloneRow() {
    if (contextRow.value) {
      emit("clone-row", { ...contextRow.value })
    }
  }

  function handleSetNull() {
    if (contextRow.value && contextField.value) {
      emit("set-null", contextRow.value, contextField.value)
    }
  }

  function handleInspect() {
    if (contextRow.value && contextField.value) {
      emit("inspect-cell", contextRow.value, contextField.value)
    }
  }

  function onSort(event: {
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
    emit("sort", { field: sortField.value, order: sortOrder.value })
    emit("server-sort", { field: sortField.value, order: sortOrder.value })
  }

  function onPage(event: { page: number; rows: number }) {
    emit("page", { page: event.page, rows: event.rows })
  }

  function onColumnFilterApply(filter: ColumnFilterValue) {
    columnFilters.value[filter.column] = filter
    emit("server-filter", { filters: { ...columnFilters.value } })
  }

  function onColumnFilterClear(column: string) {
    delete columnFilters.value[column]
    emit("server-filter", { filters: { ...columnFilters.value } })
  }

  function getColumnFilter(column: string): ColumnFilterValue | undefined {
    return columnFilters.value[column]
  }

  function clearAllFilters() {
    columnFilters.value = {}
    emit("server-filter", { filters: {} })
  }

  function onCellEditComplete(event: {
    data: Record<string, unknown>
    newValue: unknown
    field: string
    index: number
  }) {
    const { data, newValue, field, index } = event
    const oldValue = data[field]
    if (oldValue === newValue) return

    const rowKey = String(index)
    if (!editingCells.value[rowKey]) {
      editingCells.value[rowKey] = {}
    }
    editingCells.value[rowKey][field] = newValue
    data[field] = newValue

    emit("cell-edit", {
      rowIndex: index,
      field,
      oldValue,
      newValue,
      rowData: data,
    })
  }

  function hasChanges(index: number): boolean {
    const rowKey = String(index)
    return (
      !!editingCells.value[rowKey] &&
      Object.keys(editingCells.value[rowKey]).length > 0
    )
  }

  function applyFilters() {
    emit("filter", { ...filters.value })
  }

  function clearFilters() {
    filters.value = {}
    emit("filter", {})
  }

  function handleExport() {
    emit("export")
  }

  function handleDeleteRow(rowData: Record<string, unknown>) {
    emit("delete-row", rowData)
  }

  function clearEditingState() {
    editingCells.value = {}
  }

  watch(
    () => props.rows,
    () => {
      clearEditingState()
    }
  )

  defineExpose({
    clearEditingState,
    hasChanges,
    editingCells,
    resetLoadedRanges,
    clearAllFilters,
  })
</script>

<template>
  <div class="data-grid-wrapper">
    <div v-if="showFilters || showExport" class="grid-toolbar">
      <div class="toolbar-left">
        <span v-if="showFilters" class="filter-info">
          <i class="pi pi-filter" />
          <span v-if="activeFilterCount > 0"
            >{{ activeFilterCount }} active</span
          >
        </span>
      </div>
      <div class="toolbar-right">
        <Button
          v-if="showExport"
          icon="pi pi-download"
          label="Export"
          size="small"
          outlined
          @click="handleExport"
        />
        <Button
          v-if="showFilters && activeFilterCount > 0"
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="clearFilters"
          v-tooltip="'Clear Filters'"
        />
      </div>
    </div>

    <DataTable
      :value="rows"
      :loading="loading"
      scrollable
      scroll-height="flex"
      :virtualScrollerOptions="virtualScrollerOptions"
      :paginator="paginator && !virtualScroll"
      :rows="pageSize"
      :totalRecords="totalRecords"
      :lazy="lazy || virtualScroll"
      @page="onPage"
      @sort="onSort"
      :sortField="sortField || undefined"
      :sortOrder="sortOrder"
      :editMode="editable ? 'cell' : undefined"
      @cell-edit-complete="onCellEditComplete"
      class="data-grid"
      stripedRows
      showGridlines
      size="small"
    >
      <Column
        v-for="col in columns"
        :key="col.name"
        :field="col.name"
        :header="col.name"
        :sortable="sortable"
        style="min-width: 120px"
      >
        <template #header>
          <div class="column-header">
            <div class="column-header-content">
              <span class="column-name">
                {{ col.name }}
                <i
                  v-if="col.isPrimaryKey"
                  class="pi pi-key"
                  style="font-size: 0.7rem; color: var(--p-primary-color)"
                />
              </span>
              <span v-if="col.dataType" class="column-type">{{
                col.dataType
              }}</span>
            </div>
            <ColumnFilter
              v-if="connectionId && schema && table"
              :column="col.name"
              :connection-id="connectionId"
              :schema="schema"
              :table="table"
              :current-filter="getColumnFilter(col.name)"
              @apply="onColumnFilterApply"
              @clear="onColumnFilterClear(col.name)"
            />
          </div>
        </template>
        <template v-if="showFilters" #filter>
          <InputText
            v-model="filters[col.name]"
            placeholder="Filter..."
            size="small"
            @keyup.enter="applyFilters"
            style="width: 100%"
          />
        </template>
        <template v-if="editable" #editor="slotProps">
          <InputText
            v-model="slotProps.data[slotProps.field as string]"
            autofocus
            style="width: 100%"
          />
        </template>
        <template #body="slotProps">
          <span
            v-if="slotProps.data && slotProps.data.__loaded !== false"
            :class="{ 'null-value': slotProps.data[slotProps.field as string] === null }"
            @contextmenu.prevent="
              onRowContextMenu(
                $event,
                slotProps.data,
                slotProps.field as string
              )
            "
          >
            {{
              slotProps.data[slotProps.field as string] === null
                ? "NULL"
                : slotProps.data[slotProps.field as string]
            }}
          </span>
          <div v-else class="skeleton-cell">
            <Skeleton width="60%" height="1rem" />
          </div>
        </template>
      </Column>
      <Column
        v-if="editable"
        header="Actions"
        frozen
        alignFrozen="right"
        style="width: 80px"
      >
        <template #body="{ data, index }">
          <div class="row-actions">
            <Button
              v-if="hasChanges(index)"
              icon="pi pi-check"
              text
              rounded
              severity="success"
              size="small"
              v-tooltip="'Changes pending'"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              size="small"
              @click="handleDeleteRow(data)"
              v-tooltip="'Delete row'"
            />
          </div>
        </template>
      </Column>
    </DataTable>
    <ContextMenu ref="rowContextMenu" :model="rowContextMenuItems" />
  </div>
</template>

<style scoped>
  .data-grid-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .grid-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--p-surface-50);
    border-bottom: 1px solid var(--p-surface-200);
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
  }

  .data-grid {
    flex: 1;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
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
    gap: 4px;
    font-weight: 600;
  }

  .column-type {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    font-weight: normal;
  }

  .null-value {
    color: var(--p-text-muted-color);
    font-style: italic;
  }

  .row-actions {
    display: flex;
    gap: 2px;
  }

  .skeleton-cell {
    display: flex;
    align-items: center;
    height: 17px;
    flex-grow: 1;
    overflow: hidden;
  }
</style>
