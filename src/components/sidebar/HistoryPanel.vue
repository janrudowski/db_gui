<script setup lang="ts">
  import { computed } from "vue"
  import Button from "primevue/button"
  import ScrollPanel from "primevue/scrollpanel"
  import Tag from "primevue/tag"
  import { useHistoryStore, type HistoryEntry } from "../../stores/history"
  import { useWorkspaceStore } from "../../stores/workspace"

  const props = defineProps<{
    connectionId: string
  }>()

  const historyStore = useHistoryStore()
  const workspaceStore = useWorkspaceStore()

  const entries = computed(() =>
    historyStore.getEntriesForConnection(props.connectionId)
  )

  function formatTimestamp(ts: number): string {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  function truncateSql(sql: string, maxLength = 80): string {
    const singleLine = sql.replace(/\s+/g, " ").trim()
    if (singleLine.length <= maxLength) return singleLine
    return singleLine.substring(0, maxLength) + "..."
  }

  function openInEditor(entry: HistoryEntry) {
    workspaceStore.openTab(props.connectionId, "sql-editor", "Query", {
      query: entry.sql,
      forceNew: true,
    })
  }

  function copyToClipboard(sql: string) {
    navigator.clipboard.writeText(sql)
  }

  function removeEntry(id: string) {
    historyStore.removeEntry(id)
  }

  function clearAll() {
    historyStore.clearHistory()
  }
</script>

<template>
  <div class="history-panel">
    <div class="panel-header">
      <span class="panel-title">
        <i class="pi pi-history" />
        Query History
      </span>
      <Button
        v-if="entries.length > 0"
        icon="pi pi-trash"
        text
        rounded
        size="small"
        severity="secondary"
        @click="clearAll"
        v-tooltip="'Clear history'"
      />
    </div>

    <ScrollPanel class="history-list">
      <div v-if="entries.length === 0" class="empty-state">
        <i class="pi pi-inbox" />
        <p>No query history</p>
        <p class="hint">Executed queries will appear here</p>
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        class="history-entry"
        :class="{ error: entry.status === 'error' }"
        @dblclick="openInEditor(entry)"
      >
        <div class="entry-header">
          <Tag
            :severity="entry.status === 'success' ? 'success' : 'danger'"
            :value="entry.status === 'success' ? 'OK' : 'ERR'"
            class="status-tag"
          />
          <span class="entry-time">{{ formatTimestamp(entry.timestamp) }}</span>
          <span class="entry-duration">{{
            formatDuration(entry.duration)
          }}</span>
        </div>
        <div class="entry-sql">{{ truncateSql(entry.sql) }}</div>
        <div v-if="entry.rowsAffected !== undefined" class="entry-rows">
          {{ entry.rowsAffected }} rows
        </div>
        <div v-if="entry.error" class="entry-error">{{ entry.error }}</div>
        <div class="entry-actions">
          <Button
            icon="pi pi-play"
            text
            rounded
            size="small"
            @click.stop="openInEditor(entry)"
            v-tooltip="'Open in editor'"
          />
          <Button
            icon="pi pi-copy"
            text
            rounded
            size="small"
            @click.stop="copyToClipboard(entry.sql)"
            v-tooltip="'Copy SQL'"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            severity="secondary"
            @click.stop="removeEntry(entry.id)"
            v-tooltip="'Remove'"
          />
        </div>
      </div>
    </ScrollPanel>
  </div>
</template>

<style scoped>
  .history-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--p-surface-0);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--p-surface-200);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .history-list {
    flex: 1;
    overflow: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--p-text-muted-color);
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .empty-state .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .history-entry {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--p-surface-100);
    cursor: pointer;
    transition: background 0.15s;
  }

  .history-entry:hover {
    background: var(--p-surface-50);
  }

  .history-entry.error {
    border-left: 3px solid var(--p-red-500);
  }

  .entry-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .status-tag {
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
  }

  .entry-time {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
  }

  .entry-duration {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    margin-left: auto;
  }

  .entry-sql {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8rem;
    color: var(--p-text-color);
    word-break: break-all;
  }

  .entry-rows {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    margin-top: 0.25rem;
  }

  .entry-error {
    font-size: 0.75rem;
    color: var(--p-red-500);
    margin-top: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-actions {
    display: none;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .history-entry:hover .entry-actions {
    display: flex;
  }
</style>
