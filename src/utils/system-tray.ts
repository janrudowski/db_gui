import { TrayIcon } from "@tauri-apps/api/tray"
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { defaultWindowIcon } from "@tauri-apps/api/app"

let trayIcon: TrayIcon | null = null

export async function setupSystemTray() {
  const window = getCurrentWindow()

  const showItem = await MenuItem.new({
    text: "Show Window",
    action: async () => {
      await window.show()
      await window.setFocus()
    },
  })

  const hideItem = await MenuItem.new({
    text: "Hide Window",
    action: async () => {
      await window.hide()
    },
  })

  const separator = await PredefinedMenuItem.new({ item: "Separator" })

  const quitItem = await MenuItem.new({
    text: "Quit",
    action: async () => {
      await window.close()
    },
  })

  const menu = await Menu.new({
    items: [showItem, hideItem, separator, quitItem],
  })

  const icon = await defaultWindowIcon()

  trayIcon = await TrayIcon.new({
    id: "db-gui-tray",
    menu,
    tooltip: "DB GUI",
    icon: icon || undefined,
    menuOnLeftClick: false,
    action: async (event) => {
      if (event.type === "Click") {
        const isVisible = await window.isVisible()
        if (isVisible) {
          await window.hide()
        } else {
          await window.show()
          await window.setFocus()
        }
      }
    },
  })
}

export async function destroySystemTray() {
  if (trayIcon) {
    await trayIcon.close()
    trayIcon = null
  }
}
