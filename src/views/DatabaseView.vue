<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from "vue"
  import { useRouter } from "vue-router"
  import { Splitpanes, Pane } from "splitpanes"
  import "splitpanes/dist/splitpanes.css"
  import Button from "primevue/button"
  import Tree from "primevue/tree"
  import ProgressSpinner from "primevue/progressspinner"
  import Toast from "primevue/toast"
  import ContextMenu from "primevue/contextmenu"
  import type { TreeNode } from "primevue/treenode"
  import type { MenuItem } from "primevue/menuitem"
  import WorkspacePane from "../components/layout/WorkspacePane.vue"
  import CreateTableDialog from "../components/schema/CreateTableDialog.vue"
  import CreateSchemaDialog from "../components/schema/CreateSchemaDialog.vue"
  import DropConfirmDialog, {
    type DropAction,
  } from "../components/schema/DropConfirmDialog.vue"
  import { useConnectionsStore } from "../stores/connections"
  import { useWorkspaceStore } from "../stores/workspace"

  const props = defineProps<{ id: string }>()
  const router = useRouter()
  const connectionsStore = useConnectionsStore()
  const workspaceStore = useWorkspaceStore()

  const treeNodes = ref<TreeNode[]>([])
  const expandedKeys = ref<Record<string, boolean>>({})
  const loading = ref(false)

  const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
  const contextMenuItems = ref<MenuItem[]>([])
  const selectedContextNode = ref<TreeNode | null>(null)

  const showCreateTableDialog = ref(false)
  const showCreateSchemaDialog = ref(false)
  const showDropDialog = ref(false)
  const dropAction = ref<DropAction>("drop_table")
  const dropSchema = ref("")
  const dropTable = ref("")

  const connection = computed(() =>
    connectionsStore.connections.find((c) => c.id === props.id)
  )

  const dbType = computed(() => connection.value?.db_type || "postgresql")

  async function loadSchemas() {
    loading.value = true
    try {
      await connectionsStore.loadSchemas(props.id)
      const schemas = connectionsStore.getSchemas(props.id)
      treeNodes.value = schemas.map((s) => ({
        key: s.name,
        label: s.name,
        icon: "pi pi-folder",
        leaf: false,
        data: { type: "schema", name: s.name },
      }))
    } finally {
      loading.value = false
    }
  }

  async function onNodeExpand(node: TreeNode) {
    if (node.data?.type === "schema" && !node.children) {
      try {
        await connectionsStore.loadTables(props.id, node.data.name)
        const tables = connectionsStore.getTables(props.id, node.data.name)
        node.children = tables.map((t) => ({
          key: `${t.schema}.${t.name}`,
          label: t.name,
          icon: t.table_type === "VIEW" ? "pi pi-eye" : "pi pi-table",
          leaf: true,
          data: { type: "table", schema: t.schema, name: t.name },
        }))
      } catch (e) {
        console.error(e)
      }
    }
  }

  function onNodeSelect(node: TreeNode) {
    if (node.data?.type === "table") {
      workspaceStore.openTab(
        props.id,
        "table",
        `${node.data.schema}.${node.data.name}`,
        { schema: node.data.schema, table: node.data.name }
      )
    }
  }

  function onNodeContextMenu(event: MouseEvent, node: TreeNode) {
    selectedContextNode.value = node

    if (node.data?.type === "schema") {
      contextMenuItems.value = [
        {
          label: "New Table",
          icon: "pi pi-plus",
          command: () => openCreateTableDialog(node.data.name),
        },
        {
          label: "Refresh",
          icon: "pi pi-refresh",
          command: () => refreshSchema(node),
        },
        { separator: true },
        {
          label: dbType.value === "mysql" ? "Drop Database" : "Drop Schema",
          icon: "pi pi-trash",
          class: "p-menuitem-danger",
          command: () => openDropDialog("drop_schema", node.data.name),
        },
      ]
    } else if (node.data?.type === "table") {
      contextMenuItems.value = [
        {
          label: "View Data",
          icon: "pi pi-table",
          command: () => onNodeSelect(node),
        },
        {
          label: "Query Table",
          icon: "pi pi-code",
          command: () => openQueryForTable(node.data.schema, node.data.name),
        },
        { separator: true },
        {
          label: "Truncate Table",
          icon: "pi pi-eraser",
          command: () =>
            openDropDialog("truncate_table", node.data.schema, node.data.name),
        },
        {
          label: "Drop Table",
          icon: "pi pi-trash",
          class: "p-menuitem-danger",
          command: () =>
            openDropDialog("drop_table", node.data.schema, node.data.name),
        },
      ]
    }

    contextMenu.value?.show(event)
  }

  function openCreateTableDialog(schema: string) {
    dropSchema.value = schema
    showCreateTableDialog.value = true
  }

  function openDropDialog(action: DropAction, schema: string, table?: string) {
    dropAction.value = action
    dropSchema.value = schema
    dropTable.value = table || ""
    showDropDialog.value = true
  }

  function openQueryForTable(schema: string, table: string) {
    const q = dbType.value === "mysql" ? "`" : '"'
    workspaceStore.openTab(props.id, "query", `Query ${table}`, {
      query: `SELECT *\nFROM ${q}${schema}${q}.${q}${table}${q}\nLIMIT 100;`,
    })
  }

  async function refreshSchema(node: TreeNode) {
    node.children = undefined
    await onNodeExpand(node)
  }

  function openNewQuery() {
    workspaceStore.openTab(props.id, "query", "New Query", {
      query: "SELECT * FROM ",
    })
  }

  async function disconnect() {
    try {
      await connectionsStore.disconnect(props.id)
      router.push({ name: "connections" })
    } catch (e) {
      console.error(e)
    }
  }

  async function onSchemaCreated() {
    await loadSchemas()
  }

  async function onTableCreated() {
    const node = treeNodes.value.find((n) => n.data?.name === dropSchema.value)
    if (node) {
      await refreshSchema(node)
    }
  }

  async function onDropCompleted() {
    if (dropAction.value === "drop_schema") {
      await loadSchemas()
    } else {
      const node = treeNodes.value.find(
        (n) => n.data?.name === dropSchema.value
      )
      if (node) {
        await refreshSchema(node)
      }
    }
  }

  onMounted(loadSchemas)

  onUnmounted(async () => {
    try {
      await connectionsStore.disconnect(props.id)
    } catch {
      // Ignore
    }
  })
</script>

<template>
  <div class="database-view">
    <Toast />
    <div class="header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        @click="disconnect"
        v-tooltip="'Disconnect'"
      />
      <div class="connection-info">
        <span class="connection-name">{{
          connection?.name || "Database"
        }}</span>
        <span class="connection-details">
          {{ connection?.host }}:{{ connection?.port }}/{{
            connection?.database
          }}
        </span>
      </div>
      <div class="header-actions">
        <Button
          icon="pi pi-code"
          label="New Query"
          size="small"
          @click="openNewQuery"
        />
        <Button
          icon="pi pi-columns"
          text
          rounded
          @click="workspaceStore.splitPane('vertical')"
          v-tooltip="'Split Vertical'"
          :disabled="workspaceStore.panes.length >= 4"
        />
        <Button
          icon="pi pi-arrows-h"
          text
          rounded
          @click="workspaceStore.splitPane('horizontal')"
          v-tooltip="'Split Horizontal'"
          :disabled="workspaceStore.panes.length >= 4"
        />
      </div>
    </div>

    <div class="content">
      <aside class="sidebar">
        <div class="sidebar-header">
          <span>Database Explorer</span>
          <div class="sidebar-actions">
            <Button
              icon="pi pi-plus"
              text
              rounded
              size="small"
              @click="showCreateSchemaDialog = true"
              v-tooltip.bottom="
                dbType === 'mysql' ? 'New Database' : 'New Schema'
              "
            />
            <Button
              icon="pi pi-refresh"
              text
              rounded
              size="small"
              @click="loadSchemas"
              :loading="loading"
              v-tooltip.bottom="'Refresh'"
            />
          </div>
        </div>
        <ProgressSpinner
          v-if="loading"
          style="width: 30px; height: 30px; margin: 1rem auto"
        />
        <Tree
          v-else
          :value="treeNodes"
          v-model:expandedKeys="expandedKeys"
          selectionMode="single"
          @node-expand="onNodeExpand"
          @node-select="onNodeSelect"
          @node-contextmenu="(e: any) => onNodeContextMenu(e.originalEvent, e.node)"
          class="schema-tree"
        />
      </aside>

      <ContextMenu ref="contextMenu" :model="contextMenuItems" />

      <main class="main-content">
        <Splitpanes
          v-if="workspaceStore.panes.length > 1"
          :horizontal="workspaceStore.splitDirection === 'horizontal'"
          class="default-theme"
        >
          <Pane
            v-for="pane in workspaceStore.panes"
            :key="pane.id"
            :min-size="20"
          >
            <WorkspacePane :pane="pane" />
          </Pane>
        </Splitpanes>
        <WorkspacePane
          v-else-if="workspaceStore.panes.length === 1"
          :pane="workspaceStore.panes[0]"
        />
      </main>
    </div>

    <CreateTableDialog
      v-model:visible="showCreateTableDialog"
      :connection-id="id"
      :schema="dropSchema"
      :db-type="dbType"
      @created="onTableCreated"
    />

    <CreateSchemaDialog
      v-model:visible="showCreateSchemaDialog"
      :connection-id="id"
      :db-type="dbType"
      @created="onSchemaCreated"
    />

    <DropConfirmDialog
      v-model:visible="showDropDialog"
      :connection-id="id"
      :db-type="dbType"
      :action="dropAction"
      :schema="dropSchema"
      :table="dropTable"
      @completed="onDropCompleted"
    />
  </div>
</template>

<style scoped>
  .database-view {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--p-surface-ground);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--p-surface-0);
    border-bottom: 1px solid var(--p-surface-200);
  }

  .connection-info {
    display: flex;
    flex-direction: column;
  }

  .connection-name {
    font-weight: 600;
    font-size: 1rem;
  }

  .connection-details {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    width: 280px;
    background: var(--p-surface-0);
    border-right: 1px solid var(--p-surface-200);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    font-weight: 600;
    border-bottom: 1px solid var(--p-surface-200);
  }

  .sidebar-actions {
    display: flex;
    gap: 0.25rem;
  }

  .schema-tree {
    flex: 1;
    overflow: auto;
    padding: 0.5rem;
    background: transparent;
    border: none;
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    padding: 0.5rem;
  }

  :deep(.splitpanes) {
    height: 100%;
  }

  :deep(.splitpanes__pane) {
    background: transparent;
  }

  :deep(.splitpanes__splitter) {
    background: var(--p-surface-200);
  }

  :deep(.splitpanes--vertical > .splitpanes__splitter) {
    width: 6px;
    margin: 0 2px;
  }

  :deep(.splitpanes--horizontal > .splitpanes__splitter) {
    height: 6px;
    margin: 2px 0;
  }
</style>
