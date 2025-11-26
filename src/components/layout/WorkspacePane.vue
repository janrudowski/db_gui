<script setup lang="ts">
  import { computed } from "vue"
  import TabBar from "./TabBar.vue"
  import TableView from "../data/TableView.vue"
  import SqlEditor from "../editor/SqlEditor.vue"
  import type { Pane, Tab } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"

  const props = defineProps<{
    pane: Pane
  }>()

  const workspaceStore = useWorkspaceStore()

  const activeTab = computed(() => {
    if (!props.pane.activeTabId) return null
    return props.pane.tabs.find((t) => t.id === props.pane.activeTabId) || null
  })

  function handleSelectTab(tabId: string) {
    workspaceStore.setActiveTab(props.pane.id, tabId)
  }

  function handleCloseTab(tabId: string) {
    workspaceStore.closeTab(props.pane.id, tabId)
  }

  function handleReorderTabs(tabs: Tab[]) {
    props.pane.tabs.splice(0, props.pane.tabs.length, ...tabs)
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
      <template v-if="activeTab">
        <TableView
          v-if="activeTab.type === 'table'"
          :connection-id="activeTab.connectionId"
          :schema="activeTab.schema!"
          :table="activeTab.table!"
        />
        <SqlEditor
          v-else-if="activeTab.type === 'query'"
          :connection-id="activeTab.connectionId"
          :tab-id="activeTab.id"
          :initial-query="activeTab.query"
        />
      </template>
      <div v-else class="empty-pane">
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
