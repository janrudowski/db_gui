<script setup lang="ts">
  import { computed, defineAsyncComponent, type Component } from "vue"
  import TabBar from "./TabBar.vue"
  import type { Pane, Tab, TabType } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"

  const TableView = defineAsyncComponent(() => import("../data/TableView.vue"))
  const SqlEditor = defineAsyncComponent(
    () => import("../editor/SqlEditor.vue")
  )
  const TableCreator = defineAsyncComponent(
    () => import("../designer/TableCreator.vue")
  )
  const TableDesigner = defineAsyncComponent(
    () => import("../designer/TableDesigner.vue")
  )
  const SchemaCreator = defineAsyncComponent(
    () => import("../designer/SchemaCreator.vue")
  )

  const props = defineProps<{
    pane: Pane
  }>()

  const workspaceStore = useWorkspaceStore()

  const activeTab = computed(() => {
    if (!props.pane.activeTabId) return null
    return props.pane.tabs.find((t) => t.id === props.pane.activeTabId) || null
  })

  const tabComponentMap: Record<TabType, Component> = {
    "data-grid": TableView,
    "sql-editor": SqlEditor,
    "table-creator": TableCreator,
    "table-designer": TableDesigner,
    "schema-creator": SchemaCreator,
  }

  function getTabComponent(type: TabType): Component {
    return tabComponentMap[type] || TableView
  }

  function getTabProps(tab: Tab): Record<string, unknown> {
    const baseProps = {
      connectionId: tab.connectionId,
      tabId: tab.id,
    }

    switch (tab.type) {
      case "data-grid":
        return {
          ...baseProps,
          schema: tab.schema,
          table: tab.table,
        }
      case "sql-editor":
        return {
          ...baseProps,
          initialQuery: tab.query,
        }
      case "table-creator":
        return {
          ...baseProps,
          schema: tab.schema,
        }
      case "table-designer":
        return {
          ...baseProps,
          schema: tab.schema,
          table: tab.table,
        }
      case "schema-creator":
        return baseProps
      default:
        return baseProps
    }
  }

  function handleSelectTab(tabId: string) {
    workspaceStore.setActiveTab(props.pane.id, tabId)
  }

  function handleCloseTab(tabId: string) {
    workspaceStore.closeTab(props.pane.id, tabId)
  }

  function handleReorderTabs(tabs: Tab[]) {
    props.pane.tabs.splice(0, props.pane.tabs.length, ...tabs)
  }

  function handleTabSaved() {
    workspaceStore.setTabDirty(activeTab.value?.id || "", false)
  }
</script>

<template>
  <div
    class="workspace-pane"
    :class="{ active: workspaceStore.activePaneId === pane.id }"
    @click="workspaceStore.setActivePane(pane.id)"
  >
    <TabBar
      :tabs="pane.tabs"
      :active-tab-id="pane.activeTabId"
      :pane-id="pane.id"
      @select="handleSelectTab"
      @close="handleCloseTab"
      @reorder="handleReorderTabs"
    />

    <div class="pane-content">
      <KeepAlive>
        <component
          v-if="activeTab"
          :is="getTabComponent(activeTab.type)"
          :key="activeTab.id"
          v-bind="getTabProps(activeTab)"
          @saved="handleTabSaved"
        />
      </KeepAlive>
      <div v-if="!activeTab" class="empty-pane">
        <i class="pi pi-inbox" />
        <p>No tabs open</p>
        <p class="hint"
          >Select a table from the sidebar or open a new SQL query</p
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
  .workspace-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--p-surface-0);
    border: 2px solid transparent;
    border-radius: 4px;
    overflow: hidden;
  }

  .workspace-pane.active {
    border-color: var(--p-primary-color);
  }

  .pane-content {
    flex: 1;
    overflow: hidden;
  }

  .empty-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--p-text-muted-color);
  }

  .empty-pane i {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-pane p {
    margin: 0.25rem 0;
  }

  .empty-pane .hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
</style>
