import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type { Tab, Pane, TabType } from "../types"

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export interface OpenTabOptions {
  schema?: string
  table?: string
  query?: string
  metadata?: Record<string, unknown>
  forceNew?: boolean
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
    options?: OpenTabOptions
  ): string {
    const pane = activePane.value
    if (!pane) return ""

    if (!options?.forceNew) {
      const existingTab = pane.tabs.find(
        (t) =>
          t.connectionId === connectionId &&
          t.type === type &&
          t.schema === options?.schema &&
          t.table === options?.table
      )

      if (existingTab) {
        pane.activeTabId = existingTab.id
        return existingTab.id
      }
    }

    const tab: Tab = {
      id: generateId(),
      type,
      title,
      connectionId,
      schema: options?.schema,
      table: options?.table,
      query: options?.query,
      isDirty: false,
      metadata: options?.metadata,
    }

    pane.tabs.push(tab)
    pane.activeTabId = tab.id
    return tab.id
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

    if (pane.tabs.length === 0 && panes.value.length > 1) {
      closePane(paneId)
    }
  }

  function closeOtherTabs(paneId: string, keepTabId: string) {
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) return

    pane.tabs = pane.tabs.filter((t) => t.id === keepTabId)
    pane.activeTabId = keepTabId
  }

  function closeSavedTabs(paneId: string) {
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) return

    const savedTabs = pane.tabs.filter((t) => !t.isDirty)
    savedTabs.forEach((t) => {
      const idx = pane.tabs.findIndex((tab) => tab.id === t.id)
      if (idx !== -1) pane.tabs.splice(idx, 1)
    })

    if (pane.activeTabId && !pane.tabs.find((t) => t.id === pane.activeTabId)) {
      pane.activeTabId = pane.tabs[0]?.id || null
    }

    if (pane.tabs.length === 0 && panes.value.length > 1) {
      closePane(paneId)
    }
  }

  function closeTabsToRight(paneId: string, tabId: string) {
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) return

    const idx = pane.tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    pane.tabs = pane.tabs.slice(0, idx + 1)

    if (pane.activeTabId && !pane.tabs.find((t) => t.id === pane.activeTabId)) {
      pane.activeTabId = pane.tabs[pane.tabs.length - 1]?.id || null
    }
  }

  function closeActiveTab() {
    const pane = activePane.value
    if (!pane || !pane.activeTabId) return
    closeTab(pane.id, pane.activeTabId)
  }

  function nextTab() {
    const pane = activePane.value
    if (!pane || pane.tabs.length === 0) return

    const currentIdx = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
    const nextIdx = (currentIdx + 1) % pane.tabs.length
    pane.activeTabId = pane.tabs[nextIdx].id
  }

  function previousTab() {
    const pane = activePane.value
    if (!pane || pane.tabs.length === 0) return

    const currentIdx = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
    const prevIdx = currentIdx <= 0 ? pane.tabs.length - 1 : currentIdx - 1
    pane.activeTabId = pane.tabs[prevIdx].id
  }

  function setTabs(paneId: string, tabs: Tab[]) {
    console.log("[WorkspaceStore] setTabs called", {
      paneId,
      incomingTabIds: tabs.map((t) => t.id),
    })
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) {
      console.log("[WorkspaceStore] setTabs: pane not found!")
      return
    }

    console.log("[WorkspaceStore] setTabs: before", {
      currentTabIds: pane.tabs.map((t) => t.id),
      activeTabId: pane.activeTabId,
    })
    pane.tabs = tabs
    if (pane.activeTabId && !tabs.find((t) => t.id === pane.activeTabId)) {
      console.log(
        "[WorkspaceStore] setTabs: activeTabId no longer valid, resetting"
      )
      pane.activeTabId = tabs[0]?.id || null
    }
    console.log("[WorkspaceStore] setTabs: after", {
      newTabIds: pane.tabs.map((t) => t.id),
      activeTabId: pane.activeTabId,
    })
  }

  function reorderTabs(paneId: string, tabs: Tab[]) {
    console.log("[WorkspaceStore] reorderTabs called", { paneId })
    setTabs(paneId, tabs)
  }

  function addTabToPane(paneId: string, tab: Tab, index: number) {
    console.log("[WorkspaceStore] addTabToPane called", {
      paneId,
      tabId: tab.id,
      index,
    })
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) {
      console.log("[WorkspaceStore] addTabToPane: pane not found!")
      return
    }

    const exists = pane.tabs.find((t) => t.id === tab.id)
    if (exists) {
      console.log("[WorkspaceStore] addTabToPane: tab already exists!")
      return
    }

    pane.tabs.splice(index, 0, tab)
    pane.activeTabId = tab.id
    console.log("[WorkspaceStore] addTabToPane: done", {
      newTabIds: pane.tabs.map((t) => t.id),
    })
  }

  function removeTabFromPane(paneId: string, tabId: string) {
    console.log("[WorkspaceStore] removeTabFromPane called", { paneId, tabId })
    const pane = panes.value.find((p) => p.id === paneId)
    if (!pane) {
      console.log("[WorkspaceStore] removeTabFromPane: pane not found!")
      return
    }

    const idx = pane.tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) {
      console.log("[WorkspaceStore] removeTabFromPane: tab not found!")
      return
    }

    pane.tabs.splice(idx, 1)
    console.log(
      "[WorkspaceStore] removeTabFromPane: removed tab, remaining:",
      pane.tabs.map((t) => t.id)
    )

    if (pane.activeTabId === tabId) {
      pane.activeTabId = pane.tabs[0]?.id || null
    }

    if (pane.tabs.length === 0 && panes.value.length > 1) {
      console.log(
        "[WorkspaceStore] removeTabFromPane: pane is empty, closing it"
      )
      closePane(paneId)
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

  function splitPane(
    targetPaneId: string,
    position: "left" | "right" | "top" | "bottom",
    tab?: Tab
  ) {
    if (panes.value.length >= 4) return

    const direction =
      position === "top" || position === "bottom" ? "horizontal" : "vertical"
    splitDirection.value = direction

    const newPane: Pane = {
      id: generateId(),
      tabs: tab ? [{ ...tab }] : [],
      activeTabId: tab?.id || null,
    }

    const targetIndex = panes.value.findIndex((p) => p.id === targetPaneId)
    if (targetIndex === -1) {
      panes.value.push(newPane)
    } else if (position === "left" || position === "top") {
      panes.value.splice(targetIndex, 0, newPane)
    } else {
      panes.value.splice(targetIndex + 1, 0, newPane)
    }

    if (tab) {
      for (const pane of panes.value) {
        if (pane.id !== newPane.id) {
          const tabIndex = pane.tabs.findIndex((t) => t.id === tab.id)
          if (tabIndex !== -1) {
            pane.tabs.splice(tabIndex, 1)
            if (pane.activeTabId === tab.id) {
              pane.activeTabId = pane.tabs[0]?.id || null
            }
          }
        }
      }
    }

    activePaneId.value = newPane.id
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

  function setTabDirty(tabId: string, isDirty: boolean) {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) {
        tab.isDirty = isDirty
        break
      }
    }
  }

  function updateTabMetadata(tabId: string, metadata: Record<string, unknown>) {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) {
        tab.metadata = { ...tab.metadata, ...metadata }
        break
      }
    }
  }

  function updateTabTitle(tabId: string, title: string) {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) {
        tab.title = title
        break
      }
    }
  }

  function getTabById(tabId: string): Tab | null {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) return tab
    }
    return null
  }

  return {
    panes,
    activePaneId,
    activePane,
    activeTab,
    splitDirection,
    openTab,
    closeTab,
    closeOtherTabs,
    closeSavedTabs,
    closeTabsToRight,
    closeActiveTab,
    nextTab,
    previousTab,
    setTabs,
    reorderTabs,
    addTabToPane,
    removeTabFromPane,
    setActiveTab,
    setActivePane,
    splitPane,
    closePane,
    moveTab,
    updateTabQuery,
    setTabDirty,
    updateTabMetadata,
    updateTabTitle,
    getTabById,
  }
})
