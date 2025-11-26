import { createApp } from "vue"
import { createPinia } from "pinia"
import PrimeVue from "primevue/config"
import Aura from "@primevue/themes/aura"
import Tooltip from "primevue/tooltip"
import ToastService from "primevue/toastservice"
import ConfirmationService from "primevue/confirmationservice"
import "primeicons/primeicons.css"

import App from "./App.vue"
import { router } from "./router"
import { setupAppMenu } from "./utils/app-menu"
import { setupSystemTray } from "./utils/system-tray"

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".dark-mode",
    },
  },
})
app.use(ToastService)
app.use(ConfirmationService)
app.use(router)
app.directive("tooltip", Tooltip)

app.mount("#app")

setupAppMenu().catch(console.error)
setupSystemTray().catch(console.error)
