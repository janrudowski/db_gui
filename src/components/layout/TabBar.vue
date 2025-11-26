<script setup lang="ts">
  import { computed } from "vue"
  import draggable from "vuedraggable"
  import type { Tab } from "../../types"

  const props = defineProps<{
    tabs: Tab[]
    activeTabId: string | null
    paneId: string
  }>()

  const emit = defineEmits<{
    (e: "select", tabId: string): void
    (e: "close", tabId: string): void
    (e: "reorder", tabs: Tab[]): void
  }>()

  const localTabs = computed({
    get: () => props.tabs,
    set: (value) => emit("reorder", value),
  })

  function getTabIcon(type: string): string {
    switch (type) {
      case "table":
        return "pi pi-table"
      case "query":
        return "pi pi-code"
      case "schema":
        return "pi pi-database"
      default:
        return "pi pi-file"
    }
  }
</script>

<template>
  <div class="tab-bar">
    <draggable
      v-model="localTabs"
      item-key="id"
      class="tab-list"
      :group="{ name: 'tabs', pull: true, put: true }"
      :animation="150"
    >
      <template #item="{ element: tab }">
        <div
          class="tab"
          :class="{ active: tab.id === activeTabId }"
          @click="emit('select', tab.id)"
        >
          <i :class="getTabIcon(tab.type)" />
          <span class="tab-title">{{ tab.title }}</span>
          <button class="close-btn" @click.stop="emit('close', tab.id)">
            <i class="pi pi-times" />
          </button>
        </div>
      </template>
    </draggable>
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
</style>
