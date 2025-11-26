<script setup lang="ts">
  import { ref, onMounted } from "vue"
  import { useRouter } from "vue-router"
  import type { ConnectionListItem, DatabaseType } from "../types"
  import Button from "primevue/button"
  import DataTable from "primevue/datatable"
  import Column from "primevue/column"
  import Dialog from "primevue/dialog"
  import InputText from "primevue/inputtext"
  import InputNumber from "primevue/inputnumber"
  import Password from "primevue/password"
  import Message from "primevue/message"
  import Select from "primevue/select"
  import Toast from "primevue/toast"
  import { useToast } from "primevue/usetoast"
  import { useConnectionsStore } from "../stores/connections"

  const router = useRouter()
  const toast = useToast()
  const connectionsStore = useConnectionsStore()

  const showNewDialog = ref(false)
  const loading = ref(false)
  const testResult = ref<string | null>(null)
  const formPassword = ref("")

  const dbTypes = [
    { label: "PostgreSQL", value: "postgresql" as DatabaseType },
    { label: "MySQL", value: "mysql" as DatabaseType },
    { label: "SQLite", value: "sqlite" as DatabaseType },
  ]

  const newConnection = ref({
    name: "",
    db_type: "postgresql" as DatabaseType,
    host: "localhost",
    port: 5432,
    database: "",
    username: "postgres",
  })

  const defaultPorts: Record<DatabaseType, number> = {
    postgresql: 5432,
    mysql: 3306,
    sqlite: 0,
  }

  function onDbTypeChange() {
    newConnection.value.port = defaultPorts[newConnection.value.db_type]
  }

  async function handleSaveConnection() {
    loading.value = true
    try {
      const input = {
        ...newConnection.value,
        password: formPassword.value,
      }
      await connectionsStore.saveConnection(input)
      showNewDialog.value = false
      resetNewConnection()
      toast.add({
        severity: "success",
        summary: "Connection saved",
        life: 2000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  async function testConnection() {
    loading.value = true
    testResult.value = null
    try {
      await connectionsStore.testConnection({
        db_type: newConnection.value.db_type,
        host: newConnection.value.host,
        port: newConnection.value.port,
        database: newConnection.value.database,
        username: newConnection.value.username,
        password: formPassword.value,
      })
      testResult.value = "success"
    } catch (e) {
      testResult.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function handleDeleteConnection(id: string) {
    try {
      await connectionsStore.deleteConnection(id)
      toast.add({
        severity: "success",
        summary: "Connection deleted",
        life: 2000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: String(e),
        life: 5000,
      })
    }
  }

  async function connectToDatabase(conn: ConnectionListItem) {
    loading.value = true
    try {
      await connectionsStore.connect(conn.id)
      router.push({ name: "database", params: { id: conn.id } })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Connection failed",
        detail: String(e),
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  function resetNewConnection() {
    newConnection.value = {
      name: "",
      db_type: "postgresql",
      host: "localhost",
      port: 5432,
      database: "",
      username: "postgres",
    }
    formPassword.value = ""
    testResult.value = null
  }

  function openNewDialog() {
    resetNewConnection()
    showNewDialog.value = true
  }

  function getDbTypeLabel(type: DatabaseType): string {
    return dbTypes.find((t) => t.value === type)?.label || type
  }

  onMounted(() => connectionsStore.loadConnections())
</script>

<template>
  <div class="connections-view">
    <Toast />
    <div class="header">
      <h1>Database Connections</h1>
      <Button label="New Connection" icon="pi pi-plus" @click="openNewDialog" />
    </div>

    <DataTable
      :value="connectionsStore.connections"
      :loading="connectionsStore.loading"
      stripedRows
      class="connections-table"
      @row-dblclick="(e: any) => connectToDatabase(e.data)"
    >
      <template #empty>
        <div class="empty-state">
          <i
            class="pi pi-database"
            style="font-size: 3rem; color: var(--p-text-muted-color)"
          />
          <p>No saved connections</p>
          <Button label="Create your first connection" @click="openNewDialog" />
        </div>
      </template>
      <Column field="name" header="Name" sortable />
      <Column field="db_type" header="Type" sortable>
        <template #body="{ data }">
          {{ getDbTypeLabel(data.db_type) }}
        </template>
      </Column>
      <Column field="host" header="Host" sortable />
      <Column field="port" header="Port" sortable />
      <Column field="database" header="Database" sortable />
      <Column header="Actions" style="width: 150px">
        <template #body="{ data }">
          <Button
            icon="pi pi-link"
            severity="success"
            text
            rounded
            @click="connectToDatabase(data)"
            v-tooltip="'Connect'"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            @click="handleDeleteConnection(data.id)"
            v-tooltip="'Delete'"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="showNewDialog"
      header="New Connection"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="form-grid">
        <div class="field">
          <label for="name">Connection Name</label>
          <InputText id="name" v-model="newConnection.name" class="w-full" />
        </div>
        <div class="field">
          <label for="db_type">Database Type</label>
          <Select
            id="db_type"
            v-model="newConnection.db_type"
            :options="dbTypes"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            @change="onDbTypeChange"
          />
        </div>
        <div class="field" v-if="newConnection.db_type !== 'sqlite'">
          <label for="host">Host</label>
          <InputText id="host" v-model="newConnection.host" class="w-full" />
        </div>
        <div class="field" v-if="newConnection.db_type !== 'sqlite'">
          <label for="port">Port</label>
          <InputNumber
            id="port"
            v-model="newConnection.port"
            class="w-full"
            :useGrouping="false"
          />
        </div>
        <div class="field">
          <label for="database">{{
            newConnection.db_type === "sqlite"
              ? "Database File Path"
              : "Database"
          }}</label>
          <InputText
            id="database"
            v-model="newConnection.database"
            class="w-full"
          />
        </div>
        <div class="field" v-if="newConnection.db_type !== 'sqlite'">
          <label for="username">Username</label>
          <InputText
            id="username"
            v-model="newConnection.username"
            class="w-full"
          />
        </div>
        <div class="field" v-if="newConnection.db_type !== 'sqlite'">
          <label for="password">Password</label>
          <Password
            id="password"
            v-model="formPassword"
            class="w-full"
            :feedback="false"
            toggleMask
          />
        </div>
      </div>

      <Message
        v-if="testResult === 'success'"
        severity="success"
        :closable="false"
      >
        Connection successful!
      </Message>
      <Message v-else-if="testResult" severity="error" :closable="false">
        {{ testResult }}
      </Message>

      <template #footer>
        <Button
          label="Test"
          icon="pi pi-check-circle"
          severity="secondary"
          @click="testConnection"
          :loading="loading"
        />
        <Button
          label="Save"
          icon="pi pi-save"
          @click="handleSaveConnection"
          :loading="loading"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
  .connections-view {
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .connections-table {
    margin-top: 1rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    gap: 1rem;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field label {
    font-weight: 500;
  }

  .w-full {
    width: 100%;
  }
</style>
