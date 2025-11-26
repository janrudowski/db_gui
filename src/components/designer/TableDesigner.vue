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
  import type { ColumnInfo, DatabaseType, ColumnChange } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { useConnectionsStore } from "../../stores/connections"

  interface EditableColumn extends ColumnInfo {
    id: string
    status: "existing" | "added" | "modified" | "dropped"
    originalName?: string
    originalType?: string
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
    return columns.value.some(
      (c) =>
        c.status === "added" ||
        c.status === "modified" ||
        c.status === "dropped"
    )
  })

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
      const cols = await invoke<ColumnInfo[]>("get_columns", {
        connectionId: props.connectionId,
        schema: props.schema,
        table: props.table,
      })

      originalColumns.value = cols
      columns.value = cols.map((c) => ({
        ...c,
        id: Math.random().toString(36).substring(2, 9),
        status: "existing" as const,
        originalName: c.name,
        originalType: c.data_type,
      }))
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Failed to load columns",
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

  .columns-table {
    background: var(--p-surface-0);
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
