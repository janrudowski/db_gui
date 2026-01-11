import { createApp } from "vue"
import { createPinia } from "pinia"
import PrimeVue from "primevue/config"
import Aura from "@primevue/themes/aura"
import { definePreset } from "@primevue/themes"
import Tooltip from "primevue/tooltip"
import ToastService from "primevue/toastservice"
import ConfirmationService from "primevue/confirmationservice"
import "primeicons/primeicons.css"
import "./styles/theme.css"

import App from "./App.vue"
import { router } from "./router"
import { setupAppMenu } from "./utils/app-menu"
import { setupSystemTray } from "./utils/system-tray"

const ObsidianPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
    colorScheme: {
      light: {
        surface: {
          0: "#ffffff",
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        primary: {
          color: "#d97706",
          inverseColor: "#ffffff",
          hoverColor: "#b45309",
          activeColor: "#92400e",
        },
        highlight: {
          background: "rgba(245, 158, 11, 0.16)",
          focusBackground: "rgba(245, 158, 11, 0.24)",
          color: "#b45309",
          focusColor: "#92400e",
        },
      },
      dark: {
        surface: {
          0: "#18181c",
          50: "#1c1c21",
          100: "#26262d",
          200: "#32323b",
          300: "#4a4a56",
          400: "#6b6b7a",
          500: "#9090a0",
          600: "#b8b8c5",
          700: "#d4d4dc",
          800: "#e8e8ed",
          900: "#f4f4f6",
          950: "#fafafa",
        },
        primary: {
          color: "#f59e0b",
          inverseColor: "#050506",
          hoverColor: "#fbbf24",
          activeColor: "#fcd34d",
        },
        highlight: {
          background: "rgba(245, 158, 11, 0.16)",
          focusBackground: "rgba(245, 158, 11, 0.24)",
          color: "#fbbf24",
          focusColor: "#fcd34d",
        },
      },
    },
  },
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(PrimeVue, {
  theme: {
    preset: ObsidianPreset,
    options: {
      darkModeSelector: ".dark-mode",
    },
  },
  ripple: true,
})
app.use(ToastService)
app.use(ConfirmationService)
app.use(router)
app.directive("tooltip", Tooltip)

app.mount("#app")

setupAppMenu().catch(console.error)
setupSystemTray().catch(console.error)
