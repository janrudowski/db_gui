<script setup lang="ts">
  import { onMounted } from "vue"

  onMounted(() => {
    document.documentElement.classList.add("dark-mode")
  })
</script>

<template>
  <router-view />
</template>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html,
  body,
  #app {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
  }

  html.dark-mode {
    color-scheme: dark;
  }

  .dark-mode body {
    background: var(--p-surface-ground);
    color: var(--p-text-color);
  }
</style>
