<script setup lang="ts">
  import { onMounted } from "vue"
  import ConfirmDialog from "primevue/confirmdialog"
  import { useThemeStore } from "./stores/theme"

  const themeStore = useThemeStore()

  onMounted(() => {
    themeStore.loadTheme()

    document.addEventListener("contextmenu", (e) => {
      const target = e.target as HTMLElement
      if (
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest('[contenteditable="true"]') ||
        target.closest(".monaco-editor")
      ) {
        return
      }
      e.preventDefault()
    })
  })
</script>

<template>
  <div id="app-root">
    <ConfirmDialog />
    <router-view />
  </div>
</template>

<style>
  *,
  *::before,
  *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    user-select: none !important;
    -webkit-user-select: none !important;
  }

  html,
  body,
  #app,
  #app-root {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
  }

  body {
    background: var(--p-surface-ground);
    color: var(--p-text-color);
  }

  html.dark-mode {
    color-scheme: dark;
  }

  input,
  textarea,
  [contenteditable="true"],
  .monaco-editor,
  .monaco-editor *,
  .p-datatable-tbody td,
  .p-datatable-tbody .cell-value,
  pre,
  code {
    user-select: text !important;
    -webkit-user-select: text !important;
  }
</style>
