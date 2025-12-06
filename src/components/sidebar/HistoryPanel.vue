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
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--p-surface-200);
    background: var(--p-surface-50);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--p-text-color);
  }

  .panel-title i {
    color: var(--p-primary-color);
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
    padding: var(--space-8);
    color: var(--p-text-muted-color);
    text-align: center;
    gap: var(--space-2);
  }

  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.4;
    color: var(--p-text-muted-color);
  }

  .empty-state p {
    margin: 0;
    color: var(--p-text-muted-color);
  }

  .empty-state .hint {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    opacity: 0.7;
  }

  .history-entry {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--p-surface-100);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .history-entry:hover {
    background: var(--p-surface-50);
  }

  .history-entry.error {
    border-left: 3px solid var(--danger);
    background: rgba(239, 68, 68, 0.05);
  }

  .history-entry.error:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .entry-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .status-tag {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
  }

  .entry-time {
    font-size: 0.7rem;
    color: var(--p-text-muted-color);
  }

  .entry-duration {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--p-text-muted-color);
    margin-left: auto;
  }

  .entry-sql {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--p-text-color);
    word-break: break-all;
    line-height: 1.4;
  }

  .entry-rows {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--p-text-muted-color);
    margin-top: var(--space-1);
  }

  .entry-error {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--danger);
    margin-top: var(--space-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-actions {
    display: none;
    gap: var(--space-1);
    margin-top: var(--space-2);
  }

  .history-entry:hover .entry-actions {
    display: flex;
  }
</style>
