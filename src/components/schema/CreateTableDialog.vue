<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Dialog from "primevue/dialog"
  import InputText from "primevue/inputtext"
  import Select from "primevue/select"
  import Checkbox from "primevue/checkbox"
  import Button from "primevue/button"
  import type { DatabaseType } from "../../types"

  interface ColumnDefinition {
    id: string
    name: string
    dataType: string
    isPrimaryKey: boolean
    isNullable: boolean
    defaultValue: string
  }

  const props = defineProps<{
    visible: boolean
    connectionId: string
    schema: string
    dbType: DatabaseType
  }>()

  const emit = defineEmits<{
    (e: "update:visible", value: boolean): void
    (e: "created"): void
  }>()

  const toast = useToast()
  const loading = ref(false)
  const tableName = ref("")
  const columns = ref<ColumnDefinition[]>([createEmptyColumn()])

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
    () => dataTypes[props.dbType] || dataTypes.postgresql
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
  }

  function removeColumn(id: string) {
    if (columns.value.length > 1) {
      columns.value = columns.value.filter((c) => c.id !== id)
    }
  }

  function generateCreateTableSql(): string {
    const quotedTableName =
      props.dbType === "mysql"
        ? `\`${props.schema}\`.\`${tableName.value}\``
        : `"${props.schema}"."${tableName.value}"`

    const columnDefs = columns.value
      .filter((c) => c.name.trim())
      .map((col) => {
        const parts: string[] = []

        const quotedName =
          props.dbType === "mysql" ? `\`${col.name}\`` : `"${col.name}"`
        parts.push(quotedName)
        parts.push(col.dataType)

        if (col.isPrimaryKey) {
          parts.push("PRIMARY KEY")
          if (props.dbType === "postgresql" && col.dataType === "SERIAL") {
          } else if (props.dbType === "mysql" && col.dataType === "INT") {
            parts.push("AUTO_INCREMENT")
          } else if (props.dbType === "sqlite" && col.dataType === "INTEGER") {
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

    return `CREATE TABLE ${quotedTableName} (\n${columnDefs.join(",\n")}\n);`
  }

  async function handleCreate() {
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

      emit("created")
      closeDialog()
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

  function closeDialog() {
    emit("update:visible", false)
    tableName.value = ""
    columns.value = [createEmptyColumn()]
  }

  watch(
    () => props.visible,
    (newVal) => {
      if (newVal) {
        tableName.value = ""
        columns.value = [createEmptyColumn()]
      }
    }
  )
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Create New Table"
    :modal="true"
    :style="{ width: '700px' }"
    :closable="!loading"
  >
    <div class="create-table-form">
      <div class="form-row">
        <label>Schema</label>
        <InputText :model-value="schema" disabled class="w-full" />
      </div>

      <div class="form-row">
        <label>Table Name</label>
        <InputText v-model="tableName" class="w-full" placeholder="my_table" />
      </div>

      <div class="columns-section">
        <div class="section-header">
          <h4>Columns</h4>
          <Button
            icon="pi pi-plus"
            label="Add Column"
            size="small"
            text
            @click="addColumn"
          />
        </div>

        <div class="columns-list">
          <div class="column-header">
            <span class="col-name">Name</span>
            <span class="col-type">Data Type</span>
            <span class="col-pk">PK</span>
            <span class="col-null">Nullable</span>
            <span class="col-default">Default</span>
            <span class="col-actions"></span>
          </div>

          <div v-for="col in columns" :key="col.id" class="column-row">
            <InputText
              v-model="col.name"
              placeholder="column_name"
              class="col-name"
            />
            <Select
              v-model="col.dataType"
              :options="availableDataTypes"
              class="col-type"
              :editable="true"
            />
            <Checkbox
              v-model="col.isPrimaryKey"
              :binary="true"
              class="col-pk"
            />
            <Checkbox
              v-model="col.isNullable"
              :binary="true"
              :disabled="col.isPrimaryKey"
              class="col-null"
            />
            <InputText
              v-model="col.defaultValue"
              placeholder="NULL"
              class="col-default"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click="removeColumn(col.id)"
              :disabled="columns.length === 1"
              class="col-actions"
            />
          </div>
        </div>
      </div>

      <div class="sql-preview">
        <h4>SQL Preview</h4>
        <pre>{{ generateCreateTableSql() }}</pre>
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        @click="closeDialog"
        :disabled="loading"
      />
      <Button
        label="Create Table"
        icon="pi pi-check"
        @click="handleCreate"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<style scoped>
  .create-table-form {
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

  .columns-section {
    border: 1px solid var(--p-surface-200);
    border-radius: 6px;
    padding: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .section-header h4 {
    margin: 0;
    font-size: 0.95rem;
  }

  .columns-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .column-header,
  .column-row {
    display: grid;
    grid-template-columns: 1fr 1fr 50px 60px 100px 40px;
    gap: 0.5rem;
    align-items: center;
  }

  .column-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--p-surface-200);
  }

  .column-header span {
    text-align: center;
  }

  .column-header .col-name,
  .column-header .col-type {
    text-align: left;
  }

  .col-pk,
  .col-null {
    justify-self: center;
  }

  .sql-preview {
    border: 1px solid var(--p-surface-200);
    border-radius: 6px;
    padding: 1rem;
    background: var(--p-surface-100);
  }

  .sql-preview h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
  }

  .sql-preview pre {
    margin: 0;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8rem;
    white-space: pre-wrap;
    color: var(--p-primary-color);
  }

  .w-full {
    width: 100%;
  }
</style>
