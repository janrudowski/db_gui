<script setup lang="ts">
  import { ref, computed, watch } from "vue"
  import draggable from "vuedraggable"
  import ContextMenu from "primevue/contextmenu"
  import { useConfirm } from "primevue/useconfirm"
  import type { MenuItem } from "primevue/menuitem"
  import type { Tab, TabType } from "../../types"
  import { TAB_ICONS } from "../../types"

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
    (e: "reorder", tabs: Tab[]): void
    (e: "tab-added", tab: Tab, index: number): void
    (e: "tab-removed", tab: Tab): void
  }>()

  const confirm = useConfirm()
  const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
  const contextTabId = ref<string | null>(null)
  const dragging = ref(false)

  const localTabs = ref<Tab[]>([...props.tabs])

  watch(
    () => props.tabs,
    (newTabs) => {
      if (!dragging.value) {
        localTabs.value = [...newTabs]
      }
    },
    { deep: true }
  )

  function handleDragChange(event: DragChangeEvent) {
    if (event.added) {
      emit("tab-added", event.added.element, event.added.newIndex)
    }
    if (event.removed) {
      emit("tab-removed", event.removed.element)
    }
    if (event.moved) {
      emit("reorder", [...localTabs.value])
    }
  }

  function getTabIcon(type: TabType): { icon: string; color?: string } {
    return TAB_ICONS[type] || { icon: "pi pi-file" }
  }

  function onTabContextMenu(event: MouseEvent, tabId: string) {
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
      :list="localTabs"
      item-key="id"
      class="tab-list"
      group="workspace-tabs"
      ghost-class="ghost-tab"
      :animation="150"
      @start="dragging = true"
      @end="dragging = false"
      @change="handleDragChange"
    >
      <template #item="{ element: tab }">
        <div
          class="tab"
          :class="{ active: tab.id === activeTabId, dirty: tab.isDirty }"
          @click="emit('select', tab.id)"
          @contextmenu.prevent="onTabContextMenu($event, tab.id)"
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
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
    transition: background 0.15s;
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
</style>
