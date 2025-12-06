<script setup lang="ts">
  import {
    ref,
    computed,
    defineAsyncComponent,
    onMounted,
    onUnmounted,
    type Component,
  } from "vue"
  import TabBar from "./TabBar.vue"
  import type { Pane, Tab, TabType } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import {
    dockingService,
    type DockPosition,
  } from "../../services/DockingService"

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

  function handleCloseOthers(tabId: string) {
    workspaceStore.closeOtherTabs(props.pane.id, tabId)
  }

  function handleCloseSaved() {
    workspaceStore.closeSavedTabs(props.pane.id)
  }

  function handleCloseToRight(tabId: string) {
    workspaceStore.closeTabsToRight(props.pane.id, tabId)
  }

  function handleTabAdded(tab: Tab, index: number) {
    workspaceStore.addTabToPane(props.pane.id, tab, index)
  }

  function handleTabRemoved(tab: Tab) {
    workspaceStore.removeTabFromPane(props.pane.id, tab.id)
  }

  function handleTabSaved() {
    workspaceStore.setTabDirty(activeTab.value?.id || "", false)
  }

  const paneElement = ref<HTMLElement | null>(null)
  const dropPosition = ref<DockPosition>(null)
  const pendingPosition = ref<DockPosition>(null)
  const hoverTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
  const HOVER_DELAY = 400

  function updatePaneRect() {
    if (paneElement.value) {
      const rect = paneElement.value.getBoundingClientRect()
      dockingService.registerPane(props.pane.id, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }
  }

  function clearHoverTimeout() {
    if (hoverTimeout.value) {
      clearTimeout(hoverTimeout.value)
      hoverTimeout.value = null
    }
  }

  function handlePaneMouseMove(event: MouseEvent) {
    if (!dockingService.dragState.isDragging) {
      dropPosition.value = null
      pendingPosition.value = null
      clearHoverTimeout()
      return
    }

    const rect = paneElement.value?.getBoundingClientRect()
    if (!rect) return

    const relX = (event.clientX - rect.x) / rect.width
    const relY = (event.clientY - rect.y) / rect.height

    const EDGE = 0.18
    let newPosition: DockPosition = null

    if (relX > 1 - EDGE) {
      newPosition = "right"
    } else if (relY > 1 - EDGE) {
      newPosition = "bottom"
    } else {
      newPosition = "center"
    }

    if (
      dockingService.dragState.sourcePaneId === props.pane.id &&
      newPosition === "center"
    ) {
      dropPosition.value = null
      pendingPosition.value = null
      clearHoverTimeout()
      return
    }

    if (newPosition !== pendingPosition.value) {
      pendingPosition.value = newPosition
      clearHoverTimeout()

      if (newPosition && newPosition !== "center") {
        hoverTimeout.value = setTimeout(() => {
          dropPosition.value = newPosition
          dockingService.dragState.targetPaneId = props.pane.id
          dockingService.dragState.dropPosition = newPosition
        }, HOVER_DELAY)
      } else {
        dropPosition.value = null
        dockingService.dragState.targetPaneId = null
        dockingService.dragState.dropPosition = null
      }
    }
  }

  function handlePaneMouseLeave() {
    dropPosition.value = null
    pendingPosition.value = null
    clearHoverTimeout()
    if (dockingService.dragState.targetPaneId === props.pane.id) {
      dockingService.dragState.targetPaneId = null
      dockingService.dragState.dropPosition = null
    }
  }

  const dropIndicatorStyle = computed(() => {
    if (!dropPosition.value || dropPosition.value === "center") return null
    return dockingService.getDropIndicatorStyle(dropPosition.value)
  })

  onMounted(() => {
    console.log("[WorkspacePane] mounted", { paneId: props.pane.id })
    updatePaneRect()
    window.addEventListener("resize", updatePaneRect)
  })

  onUnmounted(() => {
    console.log("[WorkspacePane] unmounted", { paneId: props.pane.id })
    clearHoverTimeout()
    dockingService.unregisterPane(props.pane.id)
    window.removeEventListener("resize", updatePaneRect)
  })
</script>

<template>
  <div
    ref="paneElement"
    class="workspace-pane"
    :class="{ active: workspaceStore.activePaneId === pane.id }"
    @click="workspaceStore.setActivePane(pane.id)"
    @mousemove="handlePaneMouseMove"
    @mouseleave="handlePaneMouseLeave"
  >
    <div
      v-if="dropIndicatorStyle"
      class="drop-indicator"
      :style="dropIndicatorStyle"
    />
    <TabBar
      :tabs="pane.tabs"
      :active-tab-id="pane.activeTabId"
      :pane-id="pane.id"
      @select="handleSelectTab"
      @close="handleCloseTab"
      @close-others="handleCloseOthers"
      @close-saved="handleCloseSaved"
      @close-to-right="handleCloseToRight"
      @tab-added="handleTabAdded"
      @tab-removed="handleTabRemoved"
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
    border: 1px solid var(--p-surface-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    position: relative;
    transition: border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .workspace-pane.active {
    border-color: var(--p-primary-color);
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.15), var(--shadow-md);
  }

  .pane-content {
    flex: 1;
    overflow: hidden;
    background: var(--p-surface-ground);
  }

  .empty-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--p-text-muted-color);
    gap: var(--space-2);
  }

  .empty-pane i {
    font-size: 4rem;
    opacity: 0.3;
    color: var(--p-text-muted-color);
  }

  .empty-pane p {
    margin: 0;
    font-size: 1rem;
    color: var(--p-text-muted-color);
  }

  .empty-pane .hint {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    max-width: 280px;
    text-align: center;
    line-height: 1.4;
    opacity: 0.7;
  }

  .drop-indicator {
    position: absolute;
    pointer-events: none;
    z-index: 1000;
    background: rgba(245, 158, 11, 0.15);
    border: 2px dashed var(--p-primary-color);
    border-radius: var(--radius-md);
  }
</style>
