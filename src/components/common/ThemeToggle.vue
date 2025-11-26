<script setup lang="ts">
  import { useThemeStore } from "../../stores/theme"
  import Button from "primevue/button"

  const themeStore = useThemeStore()
</script>

<template>
  <Button
    :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
    text
    rounded
    size="small"
    @click="themeStore.toggleTheme()"
    v-tooltip="
      themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'
    "
  />
</template>
