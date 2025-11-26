<script setup lang="ts">
  import { onMounted } from "vue"
  import ConfirmDialog from "primevue/confirmdialog"
  import { useThemeStore } from "./stores/theme"

  const themeStore = useThemeStore()

  onMounted(() => {
    themeStore.loadTheme()
  })

  function preventContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.closest("[data-allow-context-menu]")) {
      return
    }
    event.preventDefault()
  }
</script>

<template>
  <div id="app-root" @contextmenu="preventContextMenu">
    <ConfirmDialog />
    <router-view />
  </div>
</template>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
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
</style>
