import {
  Menu,
  Submenu,
  MenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { emit } from "@tauri-apps/api/event"

export type MenuAction =
  | "new-connection"
  | "new-tab"
  | "close-tab"
  | "toggle-dark-mode"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"

let menuActionHandler: ((action: MenuAction) => void) | null = null

export function setMenuActionHandler(handler: (action: MenuAction) => void) {
  menuActionHandler = handler
}

function triggerAction(action: MenuAction) {
  if (menuActionHandler) {
    menuActionHandler(action)
  }
  emit("menu-action", action)
}

export async function setupAppMenu() {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0

  const fileSubmenu = await Submenu.new({
    text: "File",
    items: [
      await MenuItem.new({
        text: "New Connection...",
        accelerator: isMac ? "Cmd+Shift+N" : "Ctrl+Shift+N",
        action: () => triggerAction("new-connection"),
      }),
      await MenuItem.new({
        text: "New SQL Tab",
        accelerator: isMac ? "Cmd+T" : "Ctrl+T",
        action: () => triggerAction("new-tab"),
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        text: "Close Tab",
        accelerator: isMac ? "Cmd+W" : "Ctrl+W",
        action: () => triggerAction("close-tab"),
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      ...(isMac
        ? []
        : [
            await MenuItem.new({
              text: "Exit",
              accelerator: "Alt+F4",
              action: async () => {
                const window = getCurrentWindow()
                await window.close()
              },
            }),
          ]),
    ],
  })

  const editSubmenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  })

  const viewSubmenu = await Submenu.new({
    text: "View",
    items: [
      await MenuItem.new({
        text: "Toggle Dark Mode",
        accelerator: isMac ? "Cmd+Shift+D" : "Ctrl+Shift+D",
        action: () => triggerAction("toggle-dark-mode"),
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        text: "Zoom In",
        accelerator: isMac ? "Cmd+=" : "Ctrl+=",
        action: () => triggerAction("zoom-in"),
      }),
      await MenuItem.new({
        text: "Zoom Out",
        accelerator: isMac ? "Cmd+-" : "Ctrl+-",
        action: () => triggerAction("zoom-out"),
      }),
      await MenuItem.new({
        text: "Reset Zoom",
        accelerator: isMac ? "Cmd+0" : "Ctrl+0",
        action: () => triggerAction("zoom-reset"),
      }),
    ],
  })

  const helpSubmenu = await Submenu.new({
    text: "Help",
    items: [
      await MenuItem.new({
        text: "About DB GUI",
        action: () => {
          emit("show-about")
        },
      }),
    ],
  })

  const menuItems = isMac
    ? [fileSubmenu, editSubmenu, viewSubmenu, helpSubmenu]
    : [fileSubmenu, editSubmenu, viewSubmenu, helpSubmenu]

  const menu = await Menu.new({
    items: menuItems,
  })

  await menu.setAsAppMenu()
}
