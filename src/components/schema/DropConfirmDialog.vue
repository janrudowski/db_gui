<script setup lang="ts">
  import { ref, computed } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Dialog from "primevue/dialog"
  import InputText from "primevue/inputtext"
  import Button from "primevue/button"
  import type { DatabaseType } from "../../types"

  export type DropAction = "drop_table" | "truncate_table" | "drop_schema"

  const props = defineProps<{
    visible: boolean
    connectionId: string
    dbType: DatabaseType
    action: DropAction
    schema: string
    table?: string
  }>()

  const emit = defineEmits<{
    (e: "update:visible", value: boolean): void
    (e: "completed"): void
  }>()

  const toast = useToast()
  const loading = ref(false)
  const confirmText = ref("")

  const targetName = computed(() => {
    if (props.action === "drop_schema") {
      return props.schema
    }
    return `${props.schema}.${props.table}`
  })

  const actionLabel = computed(() => {
    switch (props.action) {
      case "drop_table":
        return "Drop Table"
      case "truncate_table":
        return "Truncate Table"
      case "drop_schema":
        return props.dbType === "mysql" ? "Drop Database" : "Drop Schema"
      default:
        return "Delete"
    }
  })

  const warningMessage = computed(() => {
    switch (props.action) {
      case "drop_table":
        return "This will permanently delete the table and all its data. This action cannot be undone."
      case "truncate_table":
        return "This will delete all rows from the table. The table structure will be preserved."
      case "drop_schema":
        return "This will permanently delete the schema/database and ALL tables within it. This action cannot be undone."
      default:
        return "This action cannot be undone."
    }
  })

  const isConfirmValid = computed(() => {
    return confirmText.value === targetName.value
  })

  function generateSql(): string {
    const q = props.dbType === "mysql" ? "`" : '"'

    switch (props.action) {
      case "drop_table":
        return `DROP TABLE ${q}${props.schema}${q}.${q}${props.table}${q};`
      case "truncate_table":
        return `TRUNCATE TABLE ${q}${props.schema}${q}.${q}${props.table}${q};`
      case "drop_schema":
        if (props.dbType === "mysql") {
          return `DROP DATABASE ${q}${props.schema}${q};`
        }
        return `DROP SCHEMA ${q}${props.schema}${q} CASCADE;`
      default:
        return ""
    }
  }

  async function handleConfirm() {
    if (!isConfirmValid.value) {
      toast.add({
        severity: "warn",
        summary: "Confirmation Required",
        detail: `Please type "${targetName.value}" to confirm`,
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
        summary: "Success",
        detail: `${actionLabel.value} completed successfully`,
        life: 3000,
      })

      emit("completed")
      closeDialog()
    } catch (e) {
      toast.add({
        severity: "error",
        summary: `${actionLabel.value} Failed`,
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  function closeDialog() {
    emit("update:visible", false)
    confirmText.value = ""
  }
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="actionLabel"
    :modal="true"
    :style="{ width: '450px' }"
    :closable="!loading"
  >
    <div class="confirm-content">
      <div class="warning-box">
        <i class="pi pi-exclamation-triangle" />
        <div class="warning-text">
          <p class="warning-title">{{ warningMessage }}</p>
          <p class="target-name"
            >Target: <strong>{{ targetName }}</strong></p
          >
        </div>
      </div>

      <div class="sql-preview">
        <pre>{{ generateSql() }}</pre>
      </div>

      <div class="confirm-input">
        <label
          >Type <strong>{{ targetName }}</strong> to confirm:</label
        >
        <InputText
          v-model="confirmText"
          class="w-full"
          :placeholder="targetName"
          @keyup.enter="handleConfirm"
        />
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
        :label="actionLabel"
        icon="pi pi-trash"
        severity="danger"
        @click="handleConfirm"
        :loading="loading"
        :disabled="!isConfirmValid"
      />
    </template>
  </Dialog>
</template>

<style scoped>
  .confirm-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .warning-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--p-orange-900);
    border-radius: 6px;
    color: var(--p-orange-100);
  }

  .warning-box i {
    font-size: 1.5rem;
    color: var(--p-orange-400);
  }

  .warning-text {
    flex: 1;
  }

  .warning-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
  }

  .target-name {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.9;
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
    font-size: 0.8rem;
    color: var(--p-red-400);
  }

  .confirm-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .confirm-input label {
    font-size: 0.9rem;
  }

  .w-full {
    width: 100%;
  }
</style>
