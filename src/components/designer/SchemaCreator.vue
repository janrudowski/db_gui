<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import { invoke } from "@tauri-apps/api/core"
  import { useToast } from "primevue/usetoast"
  import Toolbar from "primevue/toolbar"
  import InputText from "primevue/inputtext"
  import Button from "primevue/button"
  import Message from "primevue/message"
  import type { DatabaseType } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { useConnectionsStore } from "../../stores/connections"

  const props = defineProps<{
    connectionId: string
    tabId: string
  }>()

  const emit = defineEmits<{
    (e: "saved"): void
  }>()

  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const connectionsStore = useConnectionsStore()

  const loading = ref(false)
  const schemaName = ref("")

  const connection = computed(() =>
    connectionsStore.connections.find((c) => c.id === props.connectionId)
  )

  const dbType = computed<DatabaseType>(
    () => connection.value?.db_type || "postgresql"
  )

  const isSqlite = computed(() => dbType.value === "sqlite")

  const entityLabel = computed(() =>
    dbType.value === "mysql" ? "Database" : "Schema"
  )

  const sqlPreview = computed(() => {
    if (!schemaName.value.trim()) {
      return `-- Enter a ${entityLabel.value.toLowerCase()} name`
    }

    if (dbType.value === "mysql") {
      return `CREATE DATABASE \`${schemaName.value}\`;`
    } else if (dbType.value === "postgresql") {
      return `CREATE SCHEMA "${schemaName.value}";`
    }
    return "-- SQLite does not support creating schemas"
  })

  function markDirty() {
    workspaceStore.setTabDirty(props.tabId, schemaName.value.trim().length > 0)
  }

  async function handleSave() {
    if (isSqlite.value) {
      toast.add({
        severity: "warn",
        summary: "Not Supported",
        detail: "SQLite does not support creating schemas",
        life: 3000,
      })
      return
    }

    if (!schemaName.value.trim()) {
      toast.add({
        severity: "warn",
        summary: "Validation Error",
        detail: `${entityLabel.value} name is required`,
        life: 3000,
      })
      return
    }

    loading.value = true
    try {
      await invoke("create_schema", {
        connectionId: props.connectionId,
        name: schemaName.value,
      })

      toast.add({
        severity: "success",
        summary: `${entityLabel.value} Created`,
        detail: `${entityLabel.value} "${schemaName.value}" created successfully`,
        life: 3000,
      })

      workspaceStore.setTabDirty(props.tabId, false)
      workspaceStore.updateTabTitle(
        props.tabId,
        `${entityLabel.value}: ${schemaName.value}`
      )
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

  watch(schemaName, markDirty)
</script>

<template>
  <div class="schema-creator">
    <Toolbar class="creator-toolbar">
      <template #start>
        <div class="toolbar-title">
          <i class="pi pi-database" style="color: var(--p-cyan-500)" />
          <span>New {{ entityLabel }}</span>
        </div>
      </template>
      <template #end>
        <Button
          :label="`Create ${entityLabel}`"
          icon="pi pi-check"
          @click="handleSave"
          :loading="loading"
          :disabled="isSqlite"
          severity="success"
        />
      </template>
    </Toolbar>

    <div class="creator-content">
      <Message v-if="isSqlite" severity="warn" :closable="false">
        SQLite uses a single database file and does not support creating
        separate schemas. Each SQLite connection is already a complete database.
      </Message>

      <div v-else class="form-section">
        <div class="form-row">
          <label>{{ entityLabel }} Name</label>
          <InputText
            v-model="schemaName"
            :placeholder="`my_${entityLabel.toLowerCase()}`"
            class="schema-name-input"
            :disabled="isSqlite"
          />
        </div>

        <div class="info-box">
          <i class="pi pi-info-circle" />
          <div>
            <p v-if="dbType === 'postgresql'">
              In PostgreSQL, schemas are namespaces within a database that
              contain tables, views, and other objects.
            </p>
            <p v-else-if="dbType === 'mysql'">
              In MySQL, databases (also called schemas) are top-level containers
              for tables and other objects.
            </p>
          </div>
        </div>

        <div class="sql-preview-section">
          <h3>SQL Preview</h3>
          <pre class="sql-preview">{{ sqlPreview }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .schema-creator {
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
    gap: 1.5rem;
    max-width: 600px;
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

  .schema-name-input {
    width: 100%;
  }

  .info-box {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--p-blue-50);
    border: 1px solid var(--p-blue-200);
    border-radius: 8px;
    color: var(--p-blue-800);
  }

  .info-box i {
    font-size: 1.25rem;
    color: var(--p-blue-500);
    flex-shrink: 0;
  }

  .info-box p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
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
</style>
