<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from "vue"
  import { useRouter } from "vue-router"
  import { invoke } from "@tauri-apps/api/core"
  import { Splitpanes, Pane } from "splitpanes"
  import "splitpanes/dist/splitpanes.css"
  import Button from "primevue/button"
  import Tree from "primevue/tree"
  import ProgressSpinner from "primevue/progressspinner"
  import Toast from "primevue/toast"
  import ContextMenu from "primevue/contextmenu"
  import type { TreeNode } from "primevue/treenode"
  import type { MenuItem } from "primevue/menuitem"
  import TabView from "primevue/tabview"
  import TabPanel from "primevue/tabpanel"
  import WorkspacePane from "../components/layout/WorkspacePane.vue"
  import HistoryPanel from "../components/sidebar/HistoryPanel.vue"
  import DropConfirmDialog, {
    type DropAction,
  } from "../components/schema/DropConfirmDialog.vue"
  import { useConnectionsStore } from "../stores/connections"
  import { useWorkspaceStore } from "../stores/workspace"
  import { useTransactionStore } from "../stores/transaction"
  import { useToast } from "primevue/usetoast"
  import ToggleSwitch from "primevue/toggleswitch"
  import Tag from "primevue/tag"
  import ThemeToggle from "../components/common/ThemeToggle.vue"
  import {
    generateSelect,
    generateInsert,
    generateUpdate,
    generateDelete,
    type DatabaseType as SqlDbType,
  } from "../utils/sql-generator"
  const props = defineProps<{ id: string }>()
  const router = useRouter()
  const connectionsStore = useConnectionsStore()
  const workspaceStore = useWorkspaceStore()
  const transactionStore = useTransactionStore()
  const toast = useToast()

  const treeNodes = ref<TreeNode[]>([])
  const expandedKeys = ref<Record<string, boolean>>({})
  const loading = ref(false)

  const selectedContextNode = ref<TreeNode | null>(null)
  const contextMenu = ref()
  const contextMenuItems = ref<MenuItem[]>([])

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

        tables.forEach((t) => {
          connectionsStore
            .getColumns(props.id, t.schema, t.name)
            .catch(() => {})
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  function onNodeSelect(node: TreeNode) {
    if (node.data?.type === "table") {
      workspaceStore.openTab(
        props.id,
        "data-grid",
        `${node.data.schema}.${node.data.name}`,
        { schema: node.data.schema, table: node.data.name }
      )
    }
  }

  function onNodeContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault()
    event.stopPropagation()
    selectedContextNode.value = node
    const nodeType = node.data?.type

    if (nodeType === "schema") {
      const schemaName = node.data.name
      contextMenuItems.value = [
        {
          label: "New Table",
          icon: "pi pi-plus",
          command: () => openTableCreatorTab(schemaName),
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
          command: () => openDropDialog("drop_schema", schemaName),
        },
      ]
    } else if (nodeType === "table") {
      const schema = node.data.schema
      const table = node.data.name
      const sqlDbType = (dbType.value || "postgres") as SqlDbType

      contextMenuItems.value = [
        {
          label: "View Data",
          icon: "pi pi-table",
          command: () => onNodeSelect(node),
        },
        {
          label: "Edit Table",
          icon: "pi pi-pencil",
          command: () => openTableDesignerTab(schema, table),
        },
        { separator: true },
        {
          label: "Generate SQL",
          icon: "pi pi-code",
          items: [
            {
              label: "SELECT",
              command: () =>
                openGeneratedSql(schema, table, "select", sqlDbType),
            },
            {
              label: "INSERT",
              command: () =>
                openGeneratedSql(schema, table, "insert", sqlDbType),
            },
            {
              label: "UPDATE",
              command: () =>
                openGeneratedSql(schema, table, "update", sqlDbType),
            },
            {
              label: "DELETE",
              command: () =>
                openGeneratedSql(schema, table, "delete", sqlDbType),
            },
          ],
        },
        {
          label: "Copy Name",
          icon: "pi pi-copy",
          command: () => copyToClipboard(`${schema}.${table}`),
        },
        { separator: true },
        {
          label: "Truncate Table",
          icon: "pi pi-eraser",
          command: () => openDropDialog("truncate_table", schema, table),
        },
        {
          label: "Drop Table",
          icon: "pi pi-trash",
          command: () => openDropDialog("drop_table", schema, table),
        },
      ]
    } else if (nodeType === "column") {
      const schema = node.data.schema
      const table = node.data.table
      const column = node.data.name

      contextMenuItems.value = [
        {
          label: "Copy Name",
          icon: "pi pi-copy",
          command: () => copyToClipboard(column),
        },
        { separator: true },
        {
          label: "Drop Column",
          icon: "pi pi-trash",
          command: () => confirmDropColumn(schema, table, column),
        },
      ]
    }

    if (contextMenuItems.value.length > 0) {
      contextMenu.value.show(event)
    }
  }

  function openTableCreatorTab(schema: string) {
    workspaceStore.openTab(props.id, "table-creator", "New Table", {
      schema,
      forceNew: true,
    })
  }

  function openTableDesignerTab(schema: string, table: string) {
    workspaceStore.openTab(props.id, "table-designer", `Edit: ${table}`, {
      schema,
      table,
    })
  }

  function openSchemaCreatorTab() {
    workspaceStore.openTab(
      props.id,
      "schema-creator",
      dbType.value === "mysql" ? "New Database" : "New Schema",
      { forceNew: true }
    )
  }

  function openDropDialog(action: DropAction, schema: string, table?: string) {
    dropAction.value = action
    dropSchema.value = schema
    dropTable.value = table || ""
    showDropDialog.value = true
  }

  async function openGeneratedSql(
    schema: string,
    table: string,
    type: "select" | "insert" | "update" | "delete",
    sqlDbType: SqlDbType
  ) {
    const columns = await connectionsStore.getColumns(props.id, schema, table)
    const colInfos = columns.map((c) => ({
      name: c.name,
      dataType: c.data_type,
      isNullable: c.is_nullable,
      defaultValue: c.default_value,
    }))

    let sql = ""
    switch (type) {
      case "select":
        sql = generateSelect(schema, table, colInfos, sqlDbType)
        break
      case "insert":
        sql = generateInsert(schema, table, colInfos, sqlDbType)
        break
      case "update":
        sql = generateUpdate(schema, table, colInfos, sqlDbType)
        break
      case "delete":
        sql = generateDelete(schema, table, sqlDbType)
        break
    }

    workspaceStore.openTab(
      props.id,
      "sql-editor",
      `${type.toUpperCase()} ${table}`,
      {
        query: sql,
        forceNew: true,
      }
    )
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.add({
      severity: "success",
      summary: "Copied",
      detail: `"${text}" copied to clipboard`,
      life: 2000,
    })
  }

  async function confirmDropColumn(
    schema: string,
    table: string,
    column: string
  ) {
    const confirm = window.confirm(
      `Are you sure you want to drop column "${column}" from ${schema}.${table}?`
    )
    if (!confirm) return

    try {
      await invoke("alter_table", {
        connectionId: props.id,
        params: {
          schema,
          table,
          changes: [{ action: "drop", column }],
        },
      })
      toast.add({
        severity: "success",
        summary: "Column Dropped",
        detail: `Column "${column}" was dropped`,
        life: 3000,
      })
      const schemaNode = treeNodes.value.find((n) => n.data?.name === schema)
      if (schemaNode) {
        await refreshSchema(schemaNode)
      }
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Failed to drop column",
        detail: String(e),
        life: 5000,
      })
    }
  }

  async function refreshSchema(node: TreeNode) {
    node.children = undefined
    await onNodeExpand(node)
  }

  function openNewQuery() {
    workspaceStore.openTab(props.id, "sql-editor", "New Query", {
      query: "SELECT * FROM ",
      forceNew: true,
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

  const inTransaction = computed(() =>
    transactionStore.isInTransaction(props.id)
  )

  async function handleCommit() {
    try {
      await transactionStore.commit(props.id)
      toast.add({
        severity: "success",
        summary: "Committed",
        detail: "Transaction committed successfully",
        life: 3000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Commit failed",
        detail: String(e),
        life: 5000,
      })
    }
  }

  async function handleRollback() {
    try {
      await transactionStore.rollback(props.id)
      toast.add({
        severity: "info",
        summary: "Rolled back",
        detail: "Transaction rolled back",
        life: 3000,
      })
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Rollback failed",
        detail: String(e),
        life: 5000,
      })
    }
  }

  async function toggleAutoCommit() {
    transactionStore.toggleAutoCommit()
    if (!transactionStore.autoCommit) {
      try {
        await transactionStore.beginTransaction(props.id)
        toast.add({
          severity: "info",
          summary: "Transaction started",
          detail: "Auto-commit disabled. Changes will be batched.",
          life: 3000,
        })
      } catch (e) {
        toast.add({
          severity: "error",
          summary: "Failed to start transaction",
          detail: String(e),
          life: 5000,
        })
        transactionStore.toggleAutoCommit()
      }
    } else if (inTransaction.value) {
      await transactionStore.commit(props.id)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey

    if (modKey && event.key === "w") {
      event.preventDefault()
      workspaceStore.closeActiveTab()
    } else if (event.ctrlKey && event.key === "PageUp") {
      event.preventDefault()
      workspaceStore.previousTab()
    } else if (event.ctrlKey && event.key === "PageDown") {
      event.preventDefault()
      workspaceStore.nextTab()
    }
  }

  onMounted(() => {
    loadSchemas()
    window.addEventListener("keydown", handleKeydown)
  })

  onUnmounted(async () => {
    window.removeEventListener("keydown", handleKeydown)
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
        <div class="transaction-controls">
          <Tag
            v-if="inTransaction"
            severity="warn"
            value="IN TRANSACTION"
            class="transaction-tag"
          />
          <div class="auto-commit-toggle">
            <label for="auto-commit">Auto-commit</label>
            <ToggleSwitch
              input-id="auto-commit"
              :model-value="transactionStore.autoCommit"
              @update:model-value="toggleAutoCommit"
            />
          </div>
          <Button
            v-if="inTransaction"
            icon="pi pi-check"
            label="Commit"
            size="small"
            severity="success"
            @click="handleCommit"
            :loading="transactionStore.loading"
          />
          <Button
            v-if="inTransaction"
            icon="pi pi-undo"
            label="Rollback"
            size="small"
            severity="danger"
            outlined
            @click="handleRollback"
            :loading="transactionStore.loading"
          />
        </div>
        <div class="header-separator" />
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
          @click="
            workspaceStore.splitPane(workspaceStore.activePaneId, 'right')
          "
          v-tooltip.left="'Split Vertical'"
          :disabled="workspaceStore.panes.length >= 4"
        />
        <Button
          icon="pi pi-arrows-h"
          text
          rounded
          @click="
            workspaceStore.splitPane(workspaceStore.activePaneId, 'bottom')
          "
          v-tooltip.left="'Split Horizontal'"
          :disabled="workspaceStore.panes.length >= 4"
        />
        <ThemeToggle />
      </div>
    </div>

    <div class="content">
      <aside class="sidebar">
        <TabView class="sidebar-tabs">
          <TabPanel value="explorer">
            <template #header>
              <i class="pi pi-database" style="margin-right: 0.35rem" />
              <span>Explorer</span>
            </template>
            <div class="sidebar-panel">
              <div class="sidebar-header">
                <div class="sidebar-actions">
                  <Button
                    icon="pi pi-plus"
                    text
                    rounded
                    size="small"
                    @click="openSchemaCreatorTab"
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
                class="schema-tree"
              >
                <template #default="{ node }">
                  <span
                    @contextmenu="(e: MouseEvent) => onNodeContextMenu(e, node)"
                  >
                    {{ node.label }}
                  </span>
                </template>
              </Tree>
            </div>
          </TabPanel>
          <TabPanel value="history">
            <template #header>
              <i class="pi pi-history" style="margin-right: 0.35rem" />
              <span>History</span>
            </template>
            <HistoryPanel :connection-id="id" />
          </TabPanel>
        </TabView>
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
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--p-surface-0);
    border-bottom: 1px solid var(--p-surface-200);
    position: relative;
  }

  .connection-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .connection-name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--p-text-color);
  }

  .connection-details {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--p-text-muted-color);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }

  .transaction-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .transaction-tag {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .auto-commit-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    font-weight: 500;
  }

  .header-separator {
    width: 1px;
    height: 24px;
    background: var(--p-surface-300);
    margin: 0 var(--space-2);
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

  .sidebar-tabs {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :deep(.sidebar-tabs .p-tabview-panels) {
    flex: 1;
    overflow: hidden;
    padding: 0;
    background: transparent;
  }

  :deep(.sidebar-tabs .p-tabview-panel) {
    height: 100%;
    overflow: auto;
  }

  :deep(.sidebar-tabs .p-tabview-nav) {
    background: var(--p-surface-50);
    border-bottom: 1px solid var(--p-surface-200);
    padding: 0 var(--space-2);
  }

  :deep(.sidebar-tabs .p-tabview-nav-link) {
    padding: var(--space-2) var(--space-3);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--p-text-muted-color);
    border: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: all var(--transition-fast);
  }

  :deep(.sidebar-tabs .p-tabview-nav-link:hover) {
    color: var(--p-text-color);
    background: var(--p-surface-100);
  }

  :deep(.sidebar-tabs .p-tabview-nav-link.p-tabview-nav-link-active) {
    color: var(--p-primary-color);
    background: var(--p-surface-0);
    border-bottom: 2px solid var(--p-primary-color);
  }

  .sidebar-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--p-surface-100);
    background: var(--p-surface-50);
  }

  .sidebar-actions {
    display: flex;
    gap: var(--space-1);
  }

  .schema-tree {
    flex: 1;
    overflow: auto;
    padding: var(--space-2);
    background: transparent;
    border: none;
  }

  :deep(.schema-tree .p-tree-node-content) {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  :deep(.schema-tree .p-tree-node-content:hover) {
    background: var(--p-surface-100);
  }

  :deep(.schema-tree .p-tree-node-content.p-highlight) {
    background: var(--p-highlight-background);
  }

  :deep(.schema-tree .p-tree-node-content.p-highlight .p-tree-node-label) {
    color: var(--p-primary-color);
  }

  :deep(.schema-tree .p-tree-node-icon) {
    color: var(--p-text-muted-color);
  }

  :deep(.schema-tree .p-tree-node-label) {
    font-size: 0.85rem;
    font-family: var(--font-ui);
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    padding: var(--space-2);
    background: var(--p-surface-ground);
  }

  :deep(.splitpanes) {
    height: 100%;
  }

  :deep(.splitpanes__pane) {
    background: transparent;
  }

  :deep(.splitpanes__splitter) {
    background: var(--p-surface-200);
    transition: background var(--transition-fast);
  }

  :deep(.splitpanes__splitter:hover) {
    background: var(--p-primary-color);
  }

  :deep(.splitpanes--vertical > .splitpanes__splitter) {
    width: 4px;
    margin: 0 2px;
    border-radius: 2px;
  }

  :deep(.splitpanes--horizontal > .splitpanes__splitter) {
    height: 4px;
    margin: 2px 0;
    border-radius: 2px;
  }
</style>
