import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export interface ContextMenuItem {
  id: string
  label: string
  disabled?: boolean
  separator?: boolean
  items?: ContextMenuItem[]
}

type MenuEventHandler = (menuId: string) => void

let unlistenFn: UnlistenFn | null = null
let currentHandler: MenuEventHandler | null = null

async function setupListener() {
  if (unlistenFn) return

  unlistenFn = await listen<string>("menu-event", (event) => {
    if (currentHandler && typeof event.payload === "string") {
      currentHandler(event.payload)
    }
  })
}

async function buildMenuItems(
  items: ContextMenuItem[]
): Promise<(MenuItem | PredefinedMenuItem | Submenu)[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.separator) {
        return PredefinedMenuItem.new({ item: "Separator" })
      }
      if (item.items && item.items.length > 0) {
        const subItems = await buildMenuItems(item.items)
        return Submenu.new({
          text: item.label,
          enabled: !item.disabled,
          items: subItems,
        })
      }
      return MenuItem.new({
        id: item.id,
        text: item.label,
        enabled: !item.disabled,
      })
    })
  )
}

export async function showContextMenu(
  items: ContextMenuItem[],
  onSelect: MenuEventHandler
): Promise<void> {
  await setupListener()
  currentHandler = onSelect

  const menuItems = await buildMenuItems(items)
  const menu = await Menu.new({ items: menuItems })
  await menu.popup()
}

export function cleanupContextMenu() {
  if (unlistenFn) {
    unlistenFn()
    unlistenFn = null
  }
  currentHandler = null
}
