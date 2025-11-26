import { defineStore } from "pinia"
import { ref, computed } from "vue"

export interface HistoryEntry {
  id: string
  sql: string
  connectionId: string
  timestamp: number
  status: "success" | "error"
  duration: number
  rowsAffected?: number
  error?: string
}

const STORAGE_KEY = "db_gui_query_history"
const MAX_ENTRIES = 100

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export const useHistoryStore = defineStore("history", () => {
  const entries = ref<HistoryEntry[]>([])

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        entries.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error("Failed to load history:", e)
      entries.value = []
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
    } catch (e) {
      console.error("Failed to save history:", e)
    }
  }

  function addEntry(
    sql: string,
    connectionId: string,
    status: "success" | "error",
    duration: number,
    rowsAffected?: number,
    error?: string
  ) {
    const entry: HistoryEntry = {
      id: generateId(),
      sql: sql.trim(),
      connectionId,
      timestamp: Date.now(),
      status,
      duration,
      rowsAffected,
      error,
    }

    entries.value.unshift(entry)

    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES)
    }

    saveToStorage()
  }

  function clearHistory() {
    entries.value = []
    saveToStorage()
  }

  function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    saveToStorage()
  }

  function getEntriesForConnection(connectionId: string): HistoryEntry[] {
    return entries.value.filter((e) => e.connectionId === connectionId)
  }

  const recentEntries = computed(() => entries.value.slice(0, 20))

  const successCount = computed(
    () => entries.value.filter((e) => e.status === "success").length
  )

  const errorCount = computed(
    () => entries.value.filter((e) => e.status === "error").length
  )

  loadFromStorage()

  return {
    entries,
    recentEntries,
    successCount,
    errorCount,
    addEntry,
    clearHistory,
    removeEntry,
    getEntriesForConnection,
  }
})
