<script setup lang="ts">
  import { ref, computed, onMounted } from "vue"
  import { useRouter } from "vue-router"
  import type { ConnectionListItem, DatabaseType } from "../types"
  import Button from "primevue/button"
  import Card from "primevue/card"
  import Dialog from "primevue/dialog"
  import InputText from "primevue/inputtext"
  import InputNumber from "primevue/inputnumber"
  import Password from "primevue/password"
  import Message from "primevue/message"
  import Select from "primevue/select"
  import Toast from "primevue/toast"
  import ProgressSpinner from "primevue/progressspinner"
  import IconField from "primevue/iconfield"
  import InputIcon from "primevue/inputicon"
  import { useToast } from "primevue/usetoast"
  import { useConnectionsStore } from "../stores/connections"

  const router = useRouter()
  const toast = useToast()
  const connectionsStore = useConnectionsStore()

  const showNewDialog = ref(false)
  const loading = ref(false)
  const testResult = ref<string | null>(null)
  const formPassword = ref("")
  const searchQuery = ref("")

  const filteredConnections = computed(() => {
    if (!searchQuery.value.trim()) {
      return connectionsStore.connections
    }
    const query = searchQuery.value.toLowerCase()
    return connectionsStore.connections.filter((conn) =>
      conn.name.toLowerCase().includes(query)
    )
  })

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

  function getDbTypeColor(type: DatabaseType): string {
    switch (type) {
      case "postgresql":
        return "#336791"
      case "mysql":
        return "#00758F"
      case "sqlite":
        return "#003B57"
      default:
        return "#666"
    }
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

    <div v-if="connectionsStore.connections.length > 0" class="search-bar">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search connections..."
          class="search-input"
        />
      </IconField>
    </div>

    <div v-if="connectionsStore.loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="connectionsStore.connections.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        <i class="pi pi-database" />
      </div>
      <h2>No connections yet</h2>
      <p>Create your first database connection to get started</p>
      <Button
        label="Create Connection"
        icon="pi pi-plus"
        @click="openNewDialog"
      />
    </div>

    <div v-else-if="filteredConnections.length === 0" class="no-results">
      <i class="pi pi-search" />
      <p>No connections match "{{ searchQuery }}"</p>
    </div>

    <div v-else class="connections-grid">
      <Card
        v-for="conn in filteredConnections"
        :key="conn.id"
        class="connection-card"
        @click="connectToDatabase(conn)"
      >
        <template #header>
          <div
            class="card-header"
            :style="{ borderColor: getDbTypeColor(conn.db_type) }"
          >
            <div
              class="db-icon"
              :style="{ backgroundColor: getDbTypeColor(conn.db_type) }"
            >
              <i class="pi pi-database" />
            </div>
            <span class="db-type-badge">{{
              getDbTypeLabel(conn.db_type)
            }}</span>
          </div>
        </template>
        <template #title>
          <div class="card-title">{{ conn.name }}</div>
        </template>
        <template #content>
          <div class="connection-details">
            <div class="detail-row" v-if="conn.db_type !== 'sqlite'">
              <i class="pi pi-server" />
              <span>{{ conn.host }}:{{ conn.port }}</span>
            </div>
            <div class="detail-row">
              <i class="pi pi-folder" />
              <span class="database-name">{{ conn.database }}</span>
            </div>
            <div class="detail-row" v-if="conn.db_type !== 'sqlite'">
              <i class="pi pi-user" />
              <span>{{ conn.username }}</span>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="card-actions">
            <Button
              label="Connect"
              icon="pi pi-link"
              severity="success"
              size="small"
              @click.stop="connectToDatabase(conn)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click.stop="handleDeleteConnection(conn.id)"
              v-tooltip.top="'Delete'"
            />
          </div>
        </template>
      </Card>
    </div>

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
            :feedback="false"
            toggleMask
            fluid
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
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
  }

  .search-bar {
    margin-bottom: 1.5rem;
    max-width: 400px;
  }

  .search-input {
    width: 100%;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: var(--p-text-muted-color);
    gap: 0.5rem;
  }

  .no-results i {
    font-size: 2rem;
  }

  .no-results p {
    margin: 0;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 2rem;
    text-align: center;
    background: var(--p-surface-50);
    border-radius: 12px;
    border: 2px dashed var(--p-surface-200);
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--p-surface-100);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .empty-icon i {
    font-size: 2.5rem;
    color: var(--p-text-muted-color);
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--p-text-color);
  }

  .empty-state p {
    margin: 0 0 1.5rem 0;
    color: var(--p-text-muted-color);
  }

  .connections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .connection-card {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--p-surface-200);
    overflow: hidden;
  }

  .connection-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: var(--p-primary-color);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--p-surface-50);
    border-bottom: 3px solid;
  }

  .db-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .db-icon i {
    font-size: 1.25rem;
    color: white;
  }

  .db-type-badge {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--p-text-muted-color);
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connection-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--p-text-muted-color);
  }

  .detail-row i {
    font-size: 0.85rem;
    width: 16px;
    text-align: center;
  }

  .database-name {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.85rem;
  }

  .card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.5rem;
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
