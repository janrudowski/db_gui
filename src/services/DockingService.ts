import { reactive } from "vue"
import type { Tab } from "../types"

export type DockPosition = "left" | "right" | "top" | "bottom" | "center" | null

export interface DragState {
  isDragging: boolean
  draggedTab: Tab | null
  sourcePaneId: string | null
  targetPaneId: string | null
  dropPosition: DockPosition
}

export interface PaneRect {
  x: number
  y: number
  width: number
  height: number
}

const EDGE_THRESHOLD = 0.2

const dragState = reactive<DragState>({
  isDragging: false,
  draggedTab: null,
  sourcePaneId: null,
  targetPaneId: null,
  dropPosition: null,
})

const paneRects = new Map<string, PaneRect>()

export function useDockingService() {
  function registerPane(paneId: string, rect: PaneRect) {
    paneRects.set(paneId, rect)
  }

  function unregisterPane(paneId: string) {
    paneRects.delete(paneId)
  }

  function updatePaneRect(paneId: string, rect: PaneRect) {
    paneRects.set(paneId, rect)
  }

  function startDrag(tab: Tab, sourcePaneId: string) {
    dragState.isDragging = true
    dragState.draggedTab = tab
    dragState.sourcePaneId = sourcePaneId
    dragState.targetPaneId = null
    dragState.dropPosition = null
  }

  function endDrag() {
    const result = {
      tab: dragState.draggedTab,
      sourcePaneId: dragState.sourcePaneId,
      targetPaneId: dragState.targetPaneId,
      dropPosition: dragState.dropPosition,
    }

    dragState.isDragging = false
    dragState.draggedTab = null
    dragState.sourcePaneId = null
    dragState.targetPaneId = null
    dragState.dropPosition = null

    return result
  }

  function calculateDropPosition(
    mouseX: number,
    mouseY: number,
    paneId: string
  ): DockPosition {
    const rect = paneRects.get(paneId)
    if (!rect) return "center"

    const relX = (mouseX - rect.x) / rect.width
    const relY = (mouseY - rect.y) / rect.height

    if (relX < EDGE_THRESHOLD) return "left"
    if (relX > 1 - EDGE_THRESHOLD) return "right"
    if (relY < EDGE_THRESHOLD) return "top"
    if (relY > 1 - EDGE_THRESHOLD) return "bottom"

    return "center"
  }

  function handleDragOver(event: DragEvent, paneId: string): DockPosition {
    if (!dragState.isDragging) return null

    const position = calculateDropPosition(event.clientX, event.clientY, paneId)
    dragState.targetPaneId = paneId
    dragState.dropPosition = position

    return position
  }

  function getDropIndicatorStyle(
    position: DockPosition
  ): Record<string, string> | null {
    if (!position || position === "center") return null

    const baseStyle = {
      position: "absolute",
      background: "rgba(59, 130, 246, 0.3)",
      border: "2px dashed rgba(59, 130, 246, 0.8)",
      borderRadius: "4px",
      pointerEvents: "none",
      zIndex: "1000",
    }

    switch (position) {
      case "left":
        return {
          ...baseStyle,
          left: "0",
          top: "0",
          width: "50%",
          height: "100%",
        }
      case "right":
        return {
          ...baseStyle,
          right: "0",
          top: "0",
          width: "50%",
          height: "100%",
        }
      case "top":
        return {
          ...baseStyle,
          left: "0",
          top: "0",
          width: "100%",
          height: "50%",
        }
      case "bottom":
        return {
          ...baseStyle,
          left: "0",
          bottom: "0",
          width: "100%",
          height: "50%",
        }
      default:
        return null
    }
  }

  return {
    dragState,
    registerPane,
    unregisterPane,
    updatePaneRect,
    startDrag,
    endDrag,
    handleDragOver,
    calculateDropPosition,
    getDropIndicatorStyle,
  }
}

export const dockingService = useDockingService()
