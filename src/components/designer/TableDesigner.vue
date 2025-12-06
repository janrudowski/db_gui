<script setup lang="ts">
  import { ref, computed, onMounted, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Toolbar from "primevue/toolbar"
  import InputText from "primevue/inputtext"
  import Select from "primevue/select"
  import Checkbox from "primevue/checkbox"
  import Button from "primevue/button"
  import DataTable from "primevue/datatable"
  import Column from "primevue/column"
  import Tag from "primevue/tag"
  import MultiSelect from "primevue/multiselect"
  import type {
    ColumnInfo,
    DatabaseType,
    ColumnChange,
    IndexInfo,
  } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { useConnectionsStore } from "../../stores/connections"

  interface EditableColumn extends ColumnInfo {
    id: string
    status: "existing" | "added" | "modified" | "dropped"
    originalName?: string
    originalType?: string
  }

  interface EditableIndex {
    id: string
    name: string
    columns: string[]
    isUnique: boolean
    isPrimary: boolean
    status: "existing" | "added" | "dropped"
    originalName?: string
  }

  const props = defineProps<{
    connectionId: string
    tabId: string
    schema: string
    table: string
  }>()

  const emit = defineEmits<{
    (e: "saved"): void
  }>()

  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const connectionsStore = useConnectionsStore()

  const loading = ref(false)
  const saving = ref(false)
  const columns = ref<EditableColumn[]>([])
  const originalColumns = ref<ColumnInfo[]>([])
  const indexes = ref<EditableIndex[]>([])
  const originalIndexes = ref<EditableIndex[]>([])

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
    ],
    sqlite: ["INTEGER", "REAL", "TEXT", "BLOB", "NUMERIC", "BOOLEAN"],
  }

  const availableDataTypes = computed(
    () => dataTypes[dbType.value] || dataTypes.postgresql
  )

  const hasChanges = computed(() => {
    const columnChanges = columns.value.some(
      (c) =>
        c.status === "added" ||
        c.status === "modified" ||
        c.status === "dropped"
    )
    const indexChanges = indexes.value.some(
      (i) => i.status === "added" || i.status === "dropped"
    )
    return columnChanges || indexChanges
  })

  const availableColumnNames = computed(() =>
    columns.value
      .filter((c) => c.name.trim() && c.status !== "dropped")
      .map((c) => c.name)
  )

  const pendingChanges = computed<ColumnChange[]>(() => {
    const changes: ColumnChange[] = []

    for (const col of columns.value) {
      if (col.status === "added") {
        changes.push({
          action: "add",
          column: col.name,
          dataType: col.data_type,
          isNullable: col.is_nullable,
          defaultValue: col.default_value,
        })
      } else if (col.status === "dropped") {
        changes.push({
          action: "drop",
          column: col.originalName || col.name,
        })
      } else if (col.status === "modified") {
        if (col.originalName && col.originalName !== col.name) {
          changes.push({
            action: "rename",
            column: col.originalName,
            newName: col.name,
          })
        }
        if (col.originalType && col.originalType !== col.data_type) {
          changes.push({
            action: "modify",
            column: col.name,
            dataType: col.data_type,
            isNullable: col.is_nullable,
          })
        }
      }
    }

    return changes
  })

  async function loadColumns() {
    loading.value = true
    try {
      const [cols, idxs] = await Promise.all([
        invoke<ColumnInfo[]>("get_columns", {
          connectionId: props.connectionId,
          schema: props.schema,
          table: props.table,
        }),
        invoke<IndexInfo[]>("get_indexes", {
          connectionId: props.connectionId,
          schema: props.schema,
          table: props.table,
        }),
      ])

      originalColumns.value = cols
      columns.value = cols.map((c) => ({
        ...c,
        id: Math.random().toString(36).substring(2, 9),
        status: "existing" as const,
        originalName: c.name,
        originalType: c.data_type,
      }))

      const editableIndexes: EditableIndex[] = idxs.map((idx) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: idx.name,
        columns: idx.columns,
        isUnique: idx.is_unique,
        isPrimary: idx.is_primary,
        status: "existing" as const,
        originalName: idx.name,
      }))
      originalIndexes.value = editableIndexes
      indexes.value = editableIndexes.map((idx) => ({ ...idx }))
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Failed to load table structure",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  function addColumn() {
    columns.value.push({
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      data_type: availableDataTypes.value[0],
      is_nullable: true,
      is_primary_key: false,
      default_value: null,
      status: "added",
    })
    markDirty()
  }

  function removeColumn(col: EditableColumn) {
    if (col.status === "added") {
      columns.value = columns.value.filter((c) => c.id !== col.id)
    } else {
      col.status = "dropped"
    }
    markDirty()
  }

  function restoreColumn(col: EditableColumn) {
    if (col.status === "dropped") {
      const original = originalColumns.value.find(
        (c) => c.name === col.originalName
      )
      if (original) {
        col.name = original.name
        col.data_type = original.data_type
        col.is_nullable = original.is_nullable
        col.default_value = original.default_value
        col.status = "existing"
      }
    }
    markDirty()
  }

  function onColumnChange(col: EditableColumn) {
    if (col.status === "existing") {
      const original = originalColumns.value.find(
        (c) => c.name === col.originalName
      )
      if (original) {
        const hasChange =
          col.name !== original.name ||
          col.data_type !== original.data_type ||
          col.is_nullable !== original.is_nullable
        col.status = hasChange ? "modified" : "existing"
      }
    }
    markDirty()
  }

  function markDirty() {
    workspaceStore.setTabDirty(props.tabId, hasChanges.value)
  }

  function addIndex() {
    indexes.value.push({
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      columns: [],
      isUnique: false,
      isPrimary: false,
      status: "added",
    })
    markDirty()
  }

  function removeIndex(idx: EditableIndex) {
    if (idx.status === "added") {
      indexes.value = indexes.value.filter((i) => i.id !== idx.id)
    } else {
      idx.status = "dropped"
    }
    markDirty()
  }

  function restoreIndex(idx: EditableIndex) {
    if (idx.status === "dropped") {
      const original = originalIndexes.value.find(
        (i) => i.name === idx.originalName
      )
      if (original) {
        idx.name = original.name
        idx.columns = [...original.columns]
        idx.isUnique = original.isUnique
        idx.status = "existing"
      }
    }
    markDirty()
  }

  function generateAlterSql(): string {
    const lines: string[] = []
    const tableName =
      dbType.value === "mysql"
        ? `\`${props.schema}\`.\`${props.table}\``
        : `"${props.schema}"."${props.table}"`

    for (const change of pendingChanges.value) {
      const colName =
        dbType.value === "mysql" ? `\`${change.column}\`` : `"${change.column}"`

      switch (change.action) {
        case "add":
          lines.push(
            `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${change.dataType}${
              change.isNullable ? "" : " NOT NULL"
            }${change.defaultValue ? ` DEFAULT ${change.defaultValue}` : ""};`
          )
          break
        case "drop":
          lines.push(`ALTER TABLE ${tableName} DROP COLUMN ${colName};`)
          break
        case "rename":
          if (dbType.value === "postgresql") {
            lines.push(
              `ALTER TABLE ${tableName} RENAME COLUMN ${colName} TO "${change.newName}";`
            )
          } else if (dbType.value === "mysql") {
            lines.push(
              `ALTER TABLE ${tableName} RENAME COLUMN ${colName} TO \`${change.newName}\`;`
            )
          }
          break
        case "modify":
          if (dbType.value === "postgresql") {
            lines.push(
              `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${change.dataType};`
            )
          } else if (dbType.value === "mysql") {
            lines.push(
              `ALTER TABLE ${tableName} MODIFY COLUMN ${colName} ${change.dataType};`
            )
          }
          break
      }
    }

    for (const idx of indexes.value) {
      if (idx.status === "dropped" && idx.originalName) {
        const quotedIndexName =
          dbType.value === "mysql"
            ? `\`${idx.originalName}\``
            : `"${idx.originalName}"`
        if (dbType.value === "mysql") {
          lines.push(`DROP INDEX ${quotedIndexName} ON ${tableName};`)
        } else {
          lines.push(`DROP INDEX ${quotedIndexName};`)
        }
      } else if (
        idx.status === "added" &&
        idx.name.trim() &&
        idx.columns.length > 0
      ) {
        const indexType = idx.isUnique ? "UNIQUE INDEX" : "INDEX"
        const quotedIndexName =
          dbType.value === "mysql" ? `\`${idx.name}\`` : `"${idx.name}"`
        const quotedCols = idx.columns
          .map((c) => (dbType.value === "mysql" ? `\`${c}\`` : `"${c}"`))
          .join(", ")
        lines.push(
          `CREATE ${indexType} ${quotedIndexName} ON ${tableName} (${quotedCols});`
        )
      }
    }

    return lines.join("\n") || "-- No changes"
  }

  const sqlPreview = computed(() => generateAlterSql())

  async function handleSave() {
    if (!hasChanges.value) {
      toast.add({
        severity: "info",
        summary: "No changes",
        detail: "No modifications to save",
        life: 2000,
      })
      return
    }

    if (
      dbType.value === "sqlite" &&
      pendingChanges.value.some((c) => c.action !== "add")
    ) {
      toast.add({
        severity: "warn",
        summary: "SQLite Limitation",
        detail:
          "SQLite only supports adding columns. Other changes require table recreation.",
        life: 5000,
      })
      return
    }

    saving.value = true
    try {
      const sql = generateAlterSql()
      const statements = sql.split(";").filter((s) => s.trim())

      for (const stmt of statements) {
        await invoke("execute_query", {
          connectionId: props.connectionId,
          sql: stmt + ";",
        })
      }

      toast.add({
        severity: "success",
        summary: "Table Modified",
        detail: "Changes applied successfully",
        life: 3000,
      })

      workspaceStore.setTabDirty(props.tabId, false)
      await loadColumns()
      emit("saved")
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Alter Failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      saving.value = false
    }
  }

  function discardChanges() {
    columns.value = originalColumns.value.map((c) => ({
      ...c,
      id: Math.random().toString(36).substring(2, 9),
      status: "existing" as const,
      originalName: c.name,
      originalType: c.data_type,
    }))
    indexes.value = originalIndexes.value.map((idx) => ({ ...idx }))
    workspaceStore.setTabDirty(props.tabId, false)
  }

  onMounted(loadColumns)

  watch(() => [props.schema, props.table], loadColumns)
</script>

<template>
  <div class="table-designer">
    <Toolbar class="designer-toolbar">
      <template #start>
        <div class="toolbar-title">
          <i class="pi pi-pencil" style="color: var(--p-purple-500)" />
          <span>{{ table }}</span>
          <span class="schema-badge">{{ schema }}</span>
          <Tag v-if="hasChanges" severity="warn" value="Modified" />
        </div>
      </template>
      <template #end>
        <Button
          v-if="hasChanges"
          label="Discard"
          icon="pi pi-undo"
          severity="secondary"
          outlined
          @click="discardChanges"
          class="mr-2"
        />
        <Button
          label="Save Changes"
          icon="pi pi-check"
          @click="handleSave"
          :loading="saving"
          :disabled="!hasChanges"
          severity="success"
        />
      </template>
    </Toolbar>

    <div class="designer-content">
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
          :value="columns.filter((c) => c.status !== 'dropped')"
          :loading="loading"
          class="columns-table"
          size="small"
          stripedRows
          showGridlines
        >
          <Column header="Status" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :severity="
                  data.status === 'added'
                    ? 'success'
                    : data.status === 'modified'
                    ? 'warn'
                    : 'secondary'
                "
                :value="data.status === 'existing' ? 'Original' : data.status"
              />
            </template>
          </Column>
          <Column header="Column Name" style="min-width: 150px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.name"
                class="w-full"
                @input="onColumnChange(slotProps.data)"
              />
            </template>
          </Column>
          <Column header="Data Type" style="min-width: 180px">
            <template #body="slotProps">
              <Select
                v-model="slotProps.data.data_type"
                :options="availableDataTypes"
                class="w-full"
                :editable="true"
                @change="onColumnChange(slotProps.data)"
              />
            </template>
          </Column>
          <Column header="PK" style="width: 60px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.is_primary_key"
                :binary="true"
                :disabled="slotProps.data.status === 'existing'"
              />
            </template>
          </Column>
          <Column header="Nullable" style="width: 80px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.is_nullable"
                :binary="true"
                :disabled="slotProps.data.is_primary_key"
                @change="onColumnChange(slotProps.data)"
              />
            </template>
          </Column>
          <Column header="Default" style="min-width: 120px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.default_value"
                placeholder="NULL"
                class="w-full"
                :disabled="slotProps.data.status === 'existing'"
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
                @click="removeColumn(slotProps.data)"
              />
            </template>
          </Column>
        </DataTable>

        <div
          v-if="columns.some((c) => c.status === 'dropped')"
          class="dropped-columns"
        >
          <h4>Dropped Columns</h4>
          <div
            v-for="col in columns.filter((c) => c.status === 'dropped')"
            :key="col.id"
            class="dropped-column"
          >
            <span>{{ col.originalName }}</span>
            <Button
              icon="pi pi-undo"
              label="Restore"
              size="small"
              text
              @click="restoreColumn(col)"
            />
          </div>
        </div>
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
          v-if="indexes.filter((i) => i.status !== 'dropped').length > 0"
          :value="indexes.filter((i) => i.status !== 'dropped')"
          class="indexes-table"
          size="small"
          stripedRows
          showGridlines
        >
          <Column header="Status" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :severity="
                  data.status === 'added'
                    ? 'success'
                    : data.isPrimary
                    ? 'info'
                    : 'secondary'
                "
                :value="
                  data.isPrimary
                    ? 'Primary'
                    : data.status === 'existing'
                    ? 'Original'
                    : data.status
                "
              />
            </template>
          </Column>
          <Column header="Index Name" style="min-width: 150px">
            <template #body="slotProps">
              <InputText
                v-model="slotProps.data.name"
                class="w-full"
                :disabled="slotProps.data.status === 'existing'"
              />
            </template>
          </Column>
          <Column header="Columns" style="min-width: 250px">
            <template #body="slotProps">
              <MultiSelect
                v-model="slotProps.data.columns"
                :options="availableColumnNames"
                placeholder="Select columns"
                class="w-full"
                :disabled="slotProps.data.status === 'existing'"
                @change="markDirty"
              />
            </template>
          </Column>
          <Column header="Unique" style="width: 80px">
            <template #body="slotProps">
              <Checkbox
                v-model="slotProps.data.isUnique"
                :binary="true"
                :disabled="
                  slotProps.data.status === 'existing' ||
                  slotProps.data.isPrimary
                "
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
                @click="removeIndex(slotProps.data)"
                :disabled="slotProps.data.isPrimary"
              />
            </template>
          </Column>
        </DataTable>

        <p v-else class="empty-hint">
          <i class="pi pi-info-circle" />
          No indexes defined. Click "Add Index" to create one.
        </p>

        <div
          v-if="indexes.some((i) => i.status === 'dropped')"
          class="dropped-indexes"
        >
          <h4>Dropped Indexes</h4>
          <div
            v-for="idx in indexes.filter((i) => i.status === 'dropped')"
            :key="idx.id"
            class="dropped-index"
          >
            <span>{{ idx.originalName }}</span>
            <Button
              icon="pi pi-undo"
              label="Restore"
              size="small"
              text
              @click="restoreIndex(idx)"
            />
          </div>
        </div>
      </div>

      <div class="sql-preview-section">
        <h3>SQL Preview</h3>
        <pre class="sql-preview">{{ sqlPreview }}</pre>
        <p v-if="dbType === 'sqlite'" class="sqlite-warning">
          <i class="pi pi-exclamation-triangle" />
          SQLite has limited ALTER TABLE support. Only ADD COLUMN is supported.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .table-designer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--p-surface-0);
  }

  .designer-toolbar {
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

  .designer-content {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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

  .dropped-indexes {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--p-red-50);
    border-radius: 6px;
    border: 1px solid var(--p-red-200);
  }

  .dropped-indexes h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--p-red-700);
  }

  .dropped-index {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--p-surface-0);
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .dropped-columns {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--p-red-50);
    border-radius: 6px;
    border: 1px solid var(--p-red-200);
  }

  .dropped-columns h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--p-red-700);
  }

  .dropped-column {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--p-surface-0);
    border-radius: 4px;
    margin-top: 0.5rem;
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

  .sqlite-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: var(--p-yellow-100);
    color: var(--p-yellow-800);
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .w-full {
    width: 100%;
  }

  .mr-2 {
    margin-right: 0.5rem;
  }
</style>
