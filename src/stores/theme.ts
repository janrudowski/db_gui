import { defineStore } from "pinia"
import { ref, watch } from "vue"

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false)

  function loadTheme() {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") {
      isDark.value = true
    } else if (saved === "light") {
      isDark.value = false
    } else {
      isDark.value = true
    }
    applyTheme()
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem("theme", isDark.value ? "dark" : "light")
    applyTheme()
  }

  function setTheme(dark: boolean) {
    isDark.value = dark
    localStorage.setItem("theme", dark ? "dark" : "light")
    applyTheme()
  }

  function applyTheme() {
    if (isDark.value) {
      document.documentElement.classList.add("dark-mode")
    } else {
      document.documentElement.classList.remove("dark-mode")
    }
  }

  watch(isDark, applyTheme)

  return {
    isDark,
    loadTheme,
    toggleTheme,
    setTheme,
  }
})
