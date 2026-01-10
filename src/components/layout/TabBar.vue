<script setup lang="ts">
  import { ref, watch, computed } from "vue"
  import draggable from "vuedraggable"
  import ContextMenu from "primevue/contextmenu"
  import { useConfirm } from "primevue/useconfirm"
  import type { MenuItem } from "primevue/menuitem"
  import type { Tab, TabType } from "../../types"
  import { TAB_ICONS } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"
  import { dockingService } from "../../services/DockingService"

  interface DragChangeEvent {
    added?: { element: Tab; newIndex: number }
    removed?: { element: Tab; oldIndex: number }
    moved?: { element: Tab; oldIndex: number; newIndex: number }
  }

  const props = defineProps<{
    tabs: Tab[]
    activeTabId: string | null
    paneId: string
  }>()

  const emit = defineEmits<{
    (e: "select", tabId: string): void
    (e: "close", tabId: string): void
    (e: "close-others", tabId: string): void
    (e: "close-saved"): void
    (e: "close-to-right", tabId: string): void
    (e: "tab-added", tab: Tab, index: number): void
    (e: "tab-removed", tab: Tab): void
  }>()

  const workspaceStore = useWorkspaceStore()
  const confirm = useConfirm()
  const contextMenu = ref()
  const contextTabId = ref<string | null>(null)
  const localTabs = ref<Tab[]>([...props.tabs])
  const isDragging = ref(false)

  watch(
    () => props.tabs.map((t) => t.id).join(","),
    () => {
      if (!isDragging.value) {
        localTabs.value = [...props.tabs]
      }
    }
  )

  watch(
    () => props.tabs.map((t) => `${t.id}:${t.title}:${t.isDirty}`).join(","),
    () => {
      if (!isDragging.value) {
        localTabs.value = [...props.tabs]
      }
    }
  )

  function clearDockingState() {
    if (dockingService.dragState.dropPosition) {
      dockingService.dragState.targetPaneId = null
      dockingService.dragState.dropPosition = null
    }
  }

  function onDragStart(event: any) {
    console.log("[TabBar] onDragStart FIRED", {
      paneId: props.paneId,
      event,
      item: event.item,
      oldIndex: event.oldIndex,
    })
    isDragging.value = true
    const draggedTab = localTabs.value[event.oldIndex]
    if (draggedTab) {
      dockingService.startDrag(draggedTab, props.paneId)
    }
  }

  function onDragEnd(event: any) {
    console.log("[TabBar] onDragEnd FIRED", {
      paneId: props.paneId,
      event,
      localTabsAfter: localTabs.value.map((t) => t.id),
    })
    isDragging.value = false

    const dragResult = dockingService.endDrag()
    console.log("[TabBar] dragResult:", dragResult)

    if (
      dragResult.dropPosition &&
      dragResult.dropPosition !== "center" &&
      dragResult.tab
    ) {
      console.log(
        "[TabBar] Creating new pane with position:",
        dragResult.dropPosition
      )
      workspaceStore.splitPane(
        props.paneId,
        dragResult.dropPosition,
        dragResult.tab
      )
    } else {
      console.log(
        "[TabBar] Calling workspaceStore.setTabs with:",
        [...localTabs.value].map((t) => t.id)
      )
      workspaceStore.setTabs(props.paneId, [...localTabs.value])
    }
  }

  function handleDragChange(event: DragChangeEvent) {
    console.log("[TabBar] handleDragChange FIRED", {
      paneId: props.paneId,
      event,
      added: event.added,
      removed: event.removed,
      moved: event.moved,
      localTabsNow: localTabs.value.map((t) => t.id),
    })
    if (event.added) {
      console.log(
        "[TabBar] Tab ADDED from another pane:",
        event.added.element.id,
        "at index",
        event.added.newIndex
      )
      emit("tab-added", event.added.element, event.added.newIndex)
    }
    if (event.removed) {
      console.log(
        "[TabBar] Tab REMOVED to another pane:",
        event.removed.element.id
      )
      emit("tab-removed", event.removed.element)
    }
    if (event.moved) {
      console.log(
        "[TabBar] Tab MOVED within pane from",
        event.moved.oldIndex,
        "to",
        event.moved.newIndex
      )
    }
  }

  function getTabIcon(type: TabType): { icon: string; color?: string } {
    return TAB_ICONS[type] || { icon: "pi pi-file" }
  }

  function onTabContextMenu(event: MouseEvent, tabId: string) {
    contextTabId.value = tabId
    contextMenu.value.show(event)
  }

  const contextMenuItems = computed<MenuItem[]>(() => {
    const idx = props.tabs.findIndex((t) => t.id === contextTabId.value)
    const isLast = idx === props.tabs.length - 1

    return [
      {
        label: "Close",
        icon: "pi pi-times",
        command: () => contextTabId.value && handleClose(contextTabId.value),
      },
      {
        label: "Close Others",
        icon: "pi pi-times-circle",
        command: handleCloseOthers,
        disabled: props.tabs.length <= 1,
      },
      {
        label: "Close Saved",
        icon: "pi pi-check-circle",
        command: handleCloseSaved,
        disabled: props.tabs.every((t) => t.isDirty),
      },
      {
        label: "Close to the Right",
        icon: "pi pi-arrow-right",
        command: handleCloseToRight,
        disabled: isLast,
      },
    ]
  })

  function onMiddleClick(event: MouseEvent, tabId: string) {
    if (event.button === 1) {
      event.preventDefault()
      handleClose(tabId)
    }
  }

  function handleClose(tabId: string) {
    const tab = props.tabs.find((t) => t.id === tabId)
    if (tab?.isDirty) {
      confirm.require({
        message: "This tab has unsaved changes. Close anyway?",
        header: "Unsaved Changes",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => emit("close", tabId),
      })
    } else {
      emit("close", tabId)
    }
  }

  function handleCloseOthers() {
    if (!contextTabId.value) return
    const dirtyTabs = props.tabs.filter(
      (t) => t.id !== contextTabId.value && t.isDirty
    )
    if (dirtyTabs.length > 0) {
      confirm.require({
        message: `${dirtyTabs.length} tab(s) have unsaved changes. Close anyway?`,
        header: "Unsaved Changes",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => emit("close-others", contextTabId.value!),
      })
    } else {
      emit("close-others", contextTabId.value)
    }
  }

  function handleCloseSaved() {
    emit("close-saved")
  }

  function handleCloseToRight() {
    if (!contextTabId.value) return
    const idx = props.tabs.findIndex((t) => t.id === contextTabId.value)
    const rightTabs = props.tabs.slice(idx + 1)
    const dirtyTabs = rightTabs.filter((t) => t.isDirty)
    if (dirtyTabs.length > 0) {
      confirm.require({
        message: `${dirtyTabs.length} tab(s) have unsaved changes. Close anyway?`,
        header: "Unsaved Changes",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => emit("close-to-right", contextTabId.value!),
      })
    } else {
      emit("close-to-right", contextTabId.value)
    }
  }
</script>

<template>
  <div class="tab-bar">
    <draggable
      v-model="localTabs"
      tag="div"
      item-key="id"
      class="tab-list"
      group="workspace-tabs"
      ghost-class="ghost-tab"
      drag-class="dragging-tab"
      :animation="150"
      :force-fallback="true"
      @start="onDragStart"
      @end="onDragEnd"
      @change="handleDragChange"
      @dragover.native="clearDockingState"
    >
      <template #item="{ element: tab }">
        <div
          class="tab"
          :class="{ active: tab.id === activeTabId, dirty: tab.isDirty }"
          data-allow-context-menu="true"
          @click="emit('select', tab.id)"
          @contextmenu="onTabContextMenu($event, tab.id)"
          @mousedown="onMiddleClick($event, tab.id)"
        >
          <i
            :class="getTabIcon(tab.type).icon"
            :style="{ color: getTabIcon(tab.type).color }"
          />
          <span class="tab-title">{{ tab.title }}</span>
          <span v-if="tab.isDirty" class="dirty-indicator">●</span>
          <button class="close-btn" @click.stop="handleClose(tab.id)">
            <i class="pi pi-times" />
          </button>
        </div>
      </template>
    </draggable>
    <ContextMenu ref="contextMenu" :model="contextMenuItems" />
  </div>
</template>

<style scoped>
  .tab-bar {
    display: flex;
    background: var(--p-surface-100);
    border-bottom: 1px solid var(--p-surface-200);
    min-height: 38px;
  }

  .tab-list {
    display: flex;
    flex: 1;
    overflow-x: auto;
    gap: 1px;
    padding: 6px 6px 0;
  }

  /* Hide scrollbar but keep functionality */
  .tab-list::-webkit-scrollbar {
    height: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--p-surface-50);
    border: 1px solid var(--p-surface-200);
    border-bottom: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    cursor: grab;
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    transition: background var(--transition-fast), color var(--transition-fast),
      border-color var(--transition-fast);
    color: var(--p-text-muted-color);
    position: relative;
  }

  .tab::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    border-radius: 2px 2px 0 0;
    transition: background var(--transition-fast);
  }

  .tab:active {
    cursor: grabbing;
  }

  .tab:hover {
    background: var(--p-surface-0);
    color: var(--p-text-color);
  }

  .tab.active {
    background: var(--p-surface-0);
    border-color: var(--p-primary-color);
    color: var(--p-text-color);
    margin-bottom: -1px;
    border-bottom: 1px solid var(--p-surface-0);
  }

  .tab.active::before {
    background: var(--p-primary-color);
  }

  .tab i {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .tab-title {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    opacity: 0;
    transition: all var(--transition-fast);
    color: var(--p-text-muted-color);
    margin-left: var(--space-1);
  }

  .tab:hover .close-btn {
    opacity: 0.6;
  }

  .close-btn:hover {
    background: var(--p-surface-200);
    opacity: 1;
    color: var(--danger);
  }

  .close-btn i {
    font-size: 0.65rem;
    opacity: 1;
  }

  .dirty-indicator {
    color: var(--p-primary-color);
    font-size: 0.5rem;
    margin-left: -2px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .tab.dirty .tab-title {
    font-style: italic;
  }

  .tab.dirty::before {
    background: var(--p-primary-color);
    opacity: 0.5;
  }

  .ghost-tab {
    opacity: 0.4;
    background: rgba(245, 158, 11, 0.1);
    border-color: var(--p-primary-color);
  }

  .dragging-tab {
    opacity: 0.9;
    background: var(--p-surface-0);
    box-shadow: var(--shadow-lg);
    border-color: var(--p-primary-color);
  }
</style>
