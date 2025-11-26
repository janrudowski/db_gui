import { defineStore } from "pinia"
import { ref } from "vue"
import { invoke } from "@tauri-apps/api/core"

export const useTransactionStore = defineStore("transaction", () => {
  const autoCommit = ref(true)
  const inTransaction = ref<Record<string, boolean>>({})
  const loading = ref(false)

  function isInTransaction(connectionId: string): boolean {
    return inTransaction.value[connectionId] ?? false
  }

  async function beginTransaction(connectionId: string): Promise<void> {
    loading.value = true
    try {
      await invoke("begin_transaction", { connectionId })
      inTransaction.value[connectionId] = true
    } finally {
      loading.value = false
    }
  }

  async function commit(connectionId: string): Promise<void> {
    loading.value = true
    try {
      await invoke("commit_transaction", { connectionId })
      inTransaction.value[connectionId] = false
    } finally {
      loading.value = false
    }
  }

  async function rollback(connectionId: string): Promise<void> {
    loading.value = true
    try {
      await invoke("rollback_transaction", { connectionId })
      inTransaction.value[connectionId] = false
    } finally {
      loading.value = false
    }
  }

  async function syncTransactionStatus(connectionId: string): Promise<void> {
    try {
      const status = await invoke<boolean>("get_transaction_status", {
        connectionId,
      })
      inTransaction.value[connectionId] = status
    } catch {
      inTransaction.value[connectionId] = false
    }
  }

  function toggleAutoCommit() {
    autoCommit.value = !autoCommit.value
  }

  return {
    autoCommit,
    inTransaction,
    loading,
    isInTransaction,
    beginTransaction,
    commit,
    rollback,
    syncTransactionStatus,
    toggleAutoCommit,
  }
})
