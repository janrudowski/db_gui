<script setup lang="ts">
  import { ref, watch, computed } from "vue"
  import draggable from "vuedraggable"
  import ContextMenu from "primevue/contextmenu"
  import { useConfirm } from "primevue/useconfirm"
  import type { MenuItem } from "primevue/menuitem"
  import type { Tab, TabType } from "../../types"
  import { TAB_ICONS } from "../../types"
  import { useWorkspaceStore } from "../../stores/workspace"

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
  const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
  const contextTabId = ref<string | null>(null)
  const localTabs = ref<Tab[]>([...props.tabs])
  const isDragging = ref(false)

  watch(
    () => props.tabs,
    (newTabs, oldTabs) => {
      console.log("[TabBar] WATCH props.tabs changed", {
        paneId: props.paneId,
        isDragging: isDragging.value,
        oldCount: oldTabs?.length,
        newCount: newTabs.length,
        newTabIds: newTabs.map((t) => t.id),
      })
      if (!isDragging.value) {
        console.log("[TabBar] WATCH: Syncing localTabs from props")
        localTabs.value = [...newTabs]
      } else {
        console.log("[TabBar] WATCH: SKIPPING sync because isDragging=true")
      }
    },
    { deep: true }
  )

  function onDragStart(event: any) {
    console.log("[TabBar] onDragStart FIRED", {
      paneId: props.paneId,
      event,
      localTabsBefore: localTabs.value.map((t) => t.id),
    })
    isDragging.value = true
  }

  function onDragEnd(event: any) {
    console.log("[TabBar] onDragEnd FIRED", {
      paneId: props.paneId,
      event,
      localTabsAfter: localTabs.value.map((t) => t.id),
    })
    isDragging.value = false
    console.log(
      "[TabBar] Calling workspaceStore.setTabs with:",
      [...localTabs.value].map((t) => t.id)
    )
    workspaceStore.setTabs(props.paneId, [...localTabs.value])
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
    event.preventDefault()
    event.stopPropagation()
    contextTabId.value = tabId
    contextMenu.value?.show(event)
  }

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

  const contextMenuItems = computed<MenuItem[]>(() => [
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
      disabled: () => {
        if (!contextTabId.value) return true
        const idx = props.tabs.findIndex((t) => t.id === contextTabId.value)
        return idx === props.tabs.length - 1
      },
    },
  ])
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
    min-height: 36px;
  }

  .tab-list {
    display: flex;
    flex: 1;
    overflow-x: auto;
    gap: 2px;
    padding: 4px 4px 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--p-surface-50);
    border: 1px solid var(--p-surface-200);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    cursor: grab;
    font-size: 0.85rem;
    white-space: nowrap;
    transition: background 0.15s;
    -webkit-user-drag: element;
  }

  .tab:active {
    cursor: grabbing;
  }

  .tab:hover {
    background: var(--p-surface-0);
  }

  .tab.active {
    background: var(--p-surface-0);
    border-color: var(--p-primary-color);
    border-bottom: 1px solid var(--p-surface-0);
    margin-bottom: -1px;
  }

  .tab-title {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--p-surface-200);
    opacity: 1;
  }

  .close-btn i {
    font-size: 0.7rem;
  }

  .dirty-indicator {
    color: var(--p-orange-500);
    font-size: 0.6rem;
    margin-left: -4px;
  }

  .tab.dirty .tab-title {
    font-style: italic;
  }

  .ghost-tab {
    opacity: 0.5;
    background: var(--p-primary-100);
  }

  .dragging-tab {
    opacity: 0.8;
    background: var(--p-primary-200);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
</style>
