import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type { Tab, Pane, TabType } from "../types"

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const panes = ref<Pane[]>([{ id: "main", tabs: [], activeTabId: null }])
  const activePaneId = ref<string>("main")
  const splitDirection = ref<"horizontal" | "vertical" | null>(null)

  const activePane = computed(() =>
    panes.value.find((p) => p.id === activePaneId.value)
  )

  const activeTab = computed(() => {
    const pane = activePane.value
    if (!pane || !pane.activeTabId) return null
    return pane.tabs.find((t) => t.id === pane.activeTabId) || null
  })

  function openTab(
    connectionId: string,
    type: TabType,
    title: string,
    options?: { schema?: string; table?: string; query?: string }
  ) {
    const pane = activePane.value
    if (!pane) return

    const existingTab = pane.tabs.find(
      (t) =>
        t.connectionId === connectionId &&
        t.type === type &&
        t.schema === options?.schema &&
        t.table === options?.table
    )

    if (existingTab) {
      pane.activeTabId = existingTab.id
      return
    }

    const tab: Tab = {
      id: generateId(),
      type,
      title,
      connectionId,
      schema: options?.schema,
      table: options?.table,
      query: options?.query,
    }

    pane.tabs.push(tab)
    pane.activeTabId = tab.id
  }

  function closeTab(paneId: string, tabId: string) {
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) return

    const tabIndex = pane.tabs.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return

    pane.tabs.splice(tabIndex, 1)

    if (pane.activeTabId === tabId) {
      pane.activeTabId = pane.tabs[Math.max(0, tabIndex - 1)]?.id || null
    }
  }

  function setActiveTab(paneId: string, tabId: string) {
    const pane = panes.value.find((p) => p.id === paneId)
    if (pane) {
      pane.activeTabId = tabId
    }
  }

  function setActivePane(paneId: string) {
    activePaneId.value = paneId
  }

  function splitPane(direction: "horizontal" | "vertical") {
    if (panes.value.length >= 4) return

    splitDirection.value = direction
    const newPane: Pane = {
      id: generateId(),
      tabs: [],
      activeTabId: null,
    }
    panes.value.push(newPane)
  }

  function closePane(paneId: string) {
    if (panes.value.length <= 1) return

    const index = panes.value.findIndex((p) => p.id === paneId)
    if (index === -1) return

    panes.value.splice(index, 1)

    if (activePaneId.value === paneId) {
      activePaneId.value = panes.value[0]?.id || "main"
    }

    if (panes.value.length === 1) {
      splitDirection.value = null
    }
  }

  function moveTab(
    fromPaneId: string,
    toPaneId: string,
    tabId: string,
    toIndex: number
  ) {
    const fromPane = panes.value.find((p) => p.id === fromPaneId)
    const toPane = panes.value.find((p) => p.id === toPaneId)
    if (!fromPane || !toPane) return

    const tabIndex = fromPane.tabs.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return

    const [tab] = fromPane.tabs.splice(tabIndex, 1)
    toPane.tabs.splice(toIndex, 0, tab)

    if (fromPane.activeTabId === tabId) {
      fromPane.activeTabId = fromPane.tabs[0]?.id || null
    }
    toPane.activeTabId = tabId
  }

  function updateTabQuery(tabId: string, query: string) {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) {
        tab.query = query
        break
      }
    }
  }

  return {
    panes,
    activePaneId,
    activePane,
    activeTab,
    splitDirection,
    openTab,
    closeTab,
    setActiveTab,
    setActivePane,
    splitPane,
    closePane,
    moveTab,
    updateTabQuery,
  }
})
