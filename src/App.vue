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
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
  /* User select rules */
  *:not(input):not(textarea):not([contenteditable="true"]):not(
      .monaco-editor *
    ):not(.p-datatable-tbody td):not(.p-datatable-tbody .cell-value):not(
      pre
    ):not(code) {
    user-select: none !important;
    -webkit-user-select: none !important;
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

  html.dark-mode {
    color-scheme: dark;
  }

  /* Page transition */
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .page-enter-from {
    opacity: 0;
    transform: translateY(4px);
  }

  .page-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
