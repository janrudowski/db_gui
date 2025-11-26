<script setup lang="ts">
  import { ref, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Dialog from "primevue/dialog"
  import InputText from "primevue/inputtext"
  import Button from "primevue/button"
  import type { DatabaseType } from "../../types"

  const props = defineProps<{
    visible: boolean
    connectionId: string
    dbType: DatabaseType
  }>()

  const emit = defineEmits<{
    (e: "update:visible", value: boolean): void
    (e: "created"): void
  }>()

  const toast = useToast()
  const loading = ref(false)
  const schemaName = ref("")

  const title = props.dbType === "mysql" ? "Create Database" : "Create Schema"
  const label = props.dbType === "mysql" ? "Database Name" : "Schema Name"

  function generateSql(): string {
    if (props.dbType === "mysql") {
      return `CREATE DATABASE \`${schemaName.value}\`;`
    } else if (props.dbType === "sqlite") {
      return `-- SQLite does not support multiple schemas`
    }
    return `CREATE SCHEMA "${schemaName.value}";`
  }

  async function handleCreate() {
    if (!schemaName.value.trim()) {
      toast.add({
        severity: "warn",
        summary: "Validation Error",
        detail: `${label} is required`,
        life: 3000,
      })
      return
    }

    if (props.dbType === "sqlite") {
      toast.add({
        severity: "warn",
        summary: "Not Supported",
        detail: "SQLite does not support multiple schemas",
        life: 3000,
      })
      return
    }

    loading.value = true
    try {
      const sql = generateSql()
      await invoke("execute_query", {
        connectionId: props.connectionId,
        sql,
      })

      toast.add({
        severity: "success",
        summary: `${props.dbType === "mysql" ? "Database" : "Schema"} Created`,
        detail: `"${schemaName.value}" created successfully`,
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
    schemaName.value = ""
  }

  watch(
    () => props.visible,
    (newVal) => {
      if (newVal) {
        schemaName.value = ""
      }
    }
  )
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="title"
    :modal="true"
    :style="{ width: '400px' }"
    :closable="!loading"
  >
    <div class="form-content">
      <div class="form-row">
        <label>{{ label }}</label>
        <InputText
          v-model="schemaName"
          class="w-full"
          :placeholder="dbType === 'mysql' ? 'my_database' : 'my_schema'"
          @keyup.enter="handleCreate"
        />
      </div>

      <div class="sql-preview" v-if="schemaName.trim()">
        <pre>{{ generateSql() }}</pre>
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
        :label="dbType === 'mysql' ? 'Create Database' : 'Create Schema'"
        icon="pi pi-check"
        @click="handleCreate"
        :loading="loading"
        :disabled="dbType === 'sqlite'"
      />
    </template>
  </Dialog>
</template>

<style scoped>
  .form-content {
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

  .sql-preview {
    padding: 0.75rem;
    background: var(--p-surface-100);
    border-radius: 6px;
    border: 1px solid var(--p-surface-200);
  }

  .sql-preview pre {
    margin: 0;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
    color: var(--p-primary-color);
  }

  .w-full {
    width: 100%;
  }
</style>
