<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Toolbar from "primevue/toolbar"
  import InputText from "primevue/inputtext"
  import Select from "primevue/select"
  import Checkbox from "primevue/checkbox"
  import Button from "primevue/button"
  import DataTable from "primevue/datatable"
  import Column from "primevue/column"
  import MultiSelect from "primevue/multiselect"
  import type { DatabaseType } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { useConnectionsStore } from "../../stores/connections"

  interface ColumnDefinition {
    id: string
    name: string
    dataType: string
    isPrimaryKey: boolean
    isNullable: boolean
    defaultValue: string
  }

  interface IndexDefinition {
    id: string
    name: string
    columns: string[]
    isUnique: boolean
  }

  const props = defineProps<{
    connectionId: string
    tabId: string
    schema: string
  }>()

  const emit = defineEmits<{
    (e: "saved"): void
  }>()

  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const connectionsStore = useConnectionsStore()

  const loading = ref(false)
  const tableName = ref("")
  const columns = ref<ColumnDefinition[]>([createEmptyColumn()])
  const indexes = ref<IndexDefinition[]>([])

  const connection = computed(() =>
    connectionsStore.connections.find((c) => c.id === props.connectionId)
  )

  const dbType = computed<DatabaseType>(
    () => connection.value?.db_type || "postgresql"
  )

  const dataTypes: Record<DatabaseType, string[]> = {
    postgresql: [
      "INTEGER",
      "BIGINT",
      "SMALLINT",
      "SERIAL",
      "BIGSERIAL",
      "VARCHAR(255)",
      "TEXT",
      "CHAR(10)",
      "BOOLEAN",
      "NUMERIC(10,2)",
      "DECIMAL(10,2)",
      "REAL",
      "DOUBLE PRECISION",
      "DATE",
      "TIME",
      "TIMESTAMP",
      "TIMESTAMPTZ",
      "UUID",
      "JSON",
      "JSONB",
      "BYTEA",
    ],
    mysql: [
      "INT",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "VARCHAR(255)",
      "TEXT",
      "CHAR(10)",
      "MEDIUMTEXT",
      "LONGTEXT",
      "BOOLEAN",
      "DECIMAL(10,2)",
      "FLOAT",
      "DOUBLE",
      "DATE",
      "TIME",
      "DATETIME",
      "TIMESTAMP",
      "JSON",
      "BLOB",
      "MEDIUMBLOB",
      "LONGBLOB",
    ],
    sqlite: ["INTEGER", "REAL", "TEXT", "BLOB", "NUMERIC", "BOOLEAN"],
  }

  const availableDataTypes = computed(
    () => dataTypes[dbType.value] || dataTypes.postgresql
  )

  function createEmptyColumn(): ColumnDefinition {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      dataType: availableDataTypes.value[0],
      isPrimaryKey: false,
      isNullable: true,
      defaultValue: "",
    }
  }

  function addColumn() {
    columns.value.push(createEmptyColumn())
    markDirty()
  }

  function removeColumn(id: string) {
    if (columns.value.length > 1) {
      columns.value = columns.value.filter((c) => c.id !== id)
      markDirty()
    }
  }

  function moveColumnUp(index: number) {
    if (index > 0) {
      const temp = columns.value[index]
      columns.value[index] = columns.value[index - 1]
      columns.value[index - 1] = temp
      markDirty()
    }
  }

  function moveColumnDown(index: number) {
    if (index < columns.value.length - 1) {
      const temp = columns.value[index]
      columns.value[index] = columns.value[index + 1]
      columns.value[index + 1] = temp
      markDirty()
    }
  }

  function createEmptyIndex(): IndexDefinition {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      columns: [],
      isUnique: false,
    }
  }

  function addIndex() {
    indexes.value.push(createEmptyIndex())
    markDirty()
  }

  function removeIndex(id: string) {
    indexes.value = indexes.value.filter((i) => i.id !== id)
    markDirty()
  }

  const availableColumns = computed(() =>
    columns.value.filter((c) => c.name.trim()).map((c) => c.name)
  )

  function markDirty() {
    workspaceStore.setTabDirty(props.tabId, true)
  }

  function generateCreateTableSql(): string {
    const quotedTableName =
      dbType.value === "mysql"
        ? `\`${props.schema}\`.\`${tableName.value}\``
        : `"${props.schema}"."${tableName.value}"`

    const columnDefs = columns.value
      .filter((c) => c.name.trim())
      .map((col) => {
        const parts: string[] = []

        const quotedName =
          dbType.value === "mysql" ? `\`${col.name}\`` : `"${col.name}"`
        parts.push(quotedName)
        parts.push(col.dataType)

        if (col.isPrimaryKey) {
          parts.push("PRIMARY KEY")
          if (dbType.value === "mysql" && col.dataType === "INT") {
            parts.push("AUTO_INCREMENT")
          }
        }

        if (!col.isNullable && !col.isPrimaryKey) {
          parts.push("NOT NULL")
        }

        if (col.defaultValue.trim()) {
          parts.push(`DEFAULT ${col.defaultValue}`)
        }

        return "  " + parts.join(" ")
      })

    let sql = `CREATE TABLE ${quotedTableName} (\n${columnDefs.join(",\n")}\n);`

    const validIndexes = indexes.value.filter(
      (idx) => idx.name.trim() && idx.columns.length > 0
    )
    if (validIndexes.length > 0) {
      sql += "\n\n"
      for (const idx of validIndexes) {
        const indexType = idx.isUnique ? "UNIQUE INDEX" : "INDEX"
        const quotedIndexName =
          dbType.value === "mysql" ? `\`${idx.name}\`` : `"${idx.name}"`
        const quotedCols = idx.columns
          .map((c) => (dbType.value === "mysql" ? `\`${c}\`` : `"${c}"`))
          .join(", ")
        sql += `CREATE ${indexType} ${quotedIndexName} ON ${quotedTableName} (${quotedCols});\n`
      }
    }

    return sql
  }

  const sqlPreview = computed(() => {
    if (!tableName.value.trim())
      return "-- Enter a table name to see SQL preview"
    const validColumns = columns.value.filter((c) => c.name.trim())
    if (validColumns.length === 0) return "-- Add at least one column"
    return generateCreateTableSql()
  })

  async function handleSave() {
    if (!tableName.value.trim()) {
      toast.add({
        severity: "warn",
        summary: "Validation Error",
        detail: "Table name is required",
        life: 3000,
      })
      return
    }

    const validColumns = columns.value.filter((c) => c.name.trim())
    if (validColumns.length === 0) {
      toast.add({
        severity: "warn",
        summary: "Validation Error",
        detail: "At least one column is required",
        life: 3000,
      })
      return
    }

    loading.value = true
    try {
      const sql = generateCreateTableSql()
      await invoke("execute_query", {
        connectionId: props.connectionId,
        sql,
      })

      toast.add({
        severity: "success",
        summary: "Table Created",
        detail: `Table "${tableName.value}" created successfully`,
        life: 3000,
      })

      workspaceStore.setTabDirty(props.tabId, false)
      workspaceStore.updateTabTitle(props.tabId, `Table: ${tableName.value}`)
      emit("saved")
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Create Failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  watch(tableName, () => markDirty())
</script>

<template>
  <div class="table-creator">
    <Toolbar class="creator-toolbar">
      <template #start>
        <div class="toolbar-title">
          <i class="pi pi-plus-circle" style="color: var(--p-orange-500)" />
          <span>New Table</span>
          <span class="schema-badge">{{ schema }}</span>
        </div>
      </template>
      <template #end>
        <Button
          label="Create Table"
          icon="pi pi-check"
          @click="handleSave"
          :loading="loading"
          severity="success"
        />
      </template>
    </Toolbar>

    <div class="creator-content">
      <div class="form-section">
        <div class="form-row">
          <label>Table Name</label>
          <InputText
            v-model="tableName"
            placeholder="my_table"
            class="table-name-input"
          />
        </div>
      </div>

      <div class="columns-section">
        <div class="section-header">
          <h3>Columns</h3>
          <Button
            icon="pi pi-plus"
            label="Add Column"
            size="small"
            outlined
            @click="addColumn"
          />
        </div>

        <DataTable
          :value="columns"
          class="columns-table"
          size="small"
          stripedRows
          showGridlines
        >
          <Column header="" style="width: 80px">
            <template #body="{ index }">
              <div class="order-buttons">
                <Button
                  icon="pi pi-chevron-up"
                  text
                  rounded
                  size="small"
                  :disabled="index === 0"
                  @click="moveColumnUp(index)"
                />
                <Button
                  icon="pi pi-chevron-down"
                  text
                  rounded
                  size="small"
                  :disabled="index === columns.length - 1"
                  @click="moveColumnDown(index)"
                />
              </div>
            </template>
          </Column>
          <Column header="Column Name" style="min-width: 150px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.name"
                placeholder="column_name"
                class="w-full"
                @input="markDirty"
              />
            </template>
          </Column>
          <Column header="Data Type" style="min-width: 180px">
            <template #body="slotProps">
              <Select
                v-model="slotProps.data.dataType"
                :options="availableDataTypes"
                class="w-full"
                :editable="true"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="PK" style="width: 60px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.isPrimaryKey"
                :binary="true"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="Nullable" style="width: 80px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.isNullable"
                :binary="true"
                :disabled="slotProps.data.isPrimaryKey"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="Default Value" style="min-width: 120px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.defaultValue"
                placeholder="NULL"
                class="w-full"
                @input="markDirty"
              />
            </template>
          </Column>
          <Column header="" style="width: 60px">
            <template #body="slotProps">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                @click="removeColumn(slotProps.data.id)"
                :disabled="columns.length === 1"
              />
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="indexes-section">
        <div class="section-header">
          <h3>Indexes</h3>
          <Button
            icon="pi pi-plus"
            label="Add Index"
            size="small"
            outlined
            @click="addIndex"
          />
        </div>

        <DataTable
          v-if="indexes.length > 0"
          :value="indexes"
          class="indexes-table"
          size="small"
          stripedRows
          showGridlines
        >
          <Column header="Index Name" style="min-width: 150px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.name"
                placeholder="idx_name"
                class="w-full"
                @input="markDirty"
              />
            </template>
          </Column>
          <Column header="Columns" style="min-width: 250px">
            <template #body="slotProps">
              <MultiSelect
                v-model="slotProps.data.columns"
                :options="availableColumns"
                placeholder="Select columns"
                class="w-full"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="Unique" style="width: 80px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.isUnique"
                :binary="true"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="" style="width: 60px">
            <template #body="slotProps">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                @click="removeIndex(slotProps.data.id)"
              />
            </template>
          </Column>
        </DataTable>

        <p v-else class="empty-hint">
          <i class="pi pi-info-circle" />
          No indexes defined. Click "Add Index" to create one.
        </p>
      </div>

      <div class="sql-preview-section">
        <h3>SQL Preview</h3>
        <pre class="sql-preview">{{ sqlPreview }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .table-creator {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--p-surface-0);
  }

  .creator-toolbar {
    border-bottom: 1px solid var(--p-surface-200);
    padding: 0.5rem 1rem;
  }

  .toolbar-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
  }

  .schema-badge {
    font-size: 0.75rem;
    font-weight: normal;
    padding: 0.15rem 0.5rem;
    background: var(--p-surface-200);
    border-radius: 4px;
    color: var(--p-text-muted-color);
  }

  .creator-content {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .table-name-input {
    max-width: 400px;
  }

  .columns-section {
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem;
    background: var(--p-surface-50);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .columns-table,
  .indexes-table {
    background: var(--p-surface-0);
  }

  .order-buttons {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .indexes-section {
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem;
    background: var(--p-surface-50);
  }

  .empty-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 1rem;
    color: var(--p-text-muted-color);
    font-size: 0.9rem;
    background: var(--p-surface-0);
    border-radius: 6px;
    border: 1px dashed var(--p-surface-300);
  }

  .sql-preview-section {
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem;
    background: var(--p-surface-100);
  }

  .sql-preview-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
  }

  .sql-preview {
    margin: 0;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
    white-space: pre-wrap;
    color: var(--p-primary-color);
    background: var(--p-surface-0);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid var(--p-surface-200);
  }

  .w-full {
    width: 100%;
  }
</style>
