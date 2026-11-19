import { useCallback, useRef } from 'react'
import type React from 'react'
import type { WorkspaceBoardWindowScreenPoint } from '../../../../../../shared/workspace/board-window/workspace-board-window-types'

const DRAG_THRESHOLD_PX = 8
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [role="button"], [role="menuitem"]'

type DragState = { pointerId: number; startX: number; startY: number; moved: boolean }

function isOutsideViewport(event: PointerEvent): boolean {
  return (
    event.clientX < 0 ||
    event.clientY < 0 ||
    event.clientX > window.innerWidth ||
    event.clientY > window.innerHeight
  )
}

/**
 * Releasing a press outside the main window pops the board out at that screen point.
 * Pointer capture keeps the events flowing while the cursor is past the window edge.
 */
export function useWorkspaceBoardDragOut(
  onPopOut: ((at: WorkspaceBoardWindowScreenPoint) => void) | undefined,
  options: { allowInteractiveTarget?: boolean } = {}
): {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  isDraggingRef: React.RefObject<boolean>
} {
  const isDraggingRef = useRef(false)
  const allowInteractiveTarget = options.allowInteractiveTarget === true

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!onPopOut || event.button !== 0 || event.pointerType !== 'mouse') {
        return
      }
      const target = event.target
      if (
        !allowInteractiveTarget &&
        target instanceof Element &&
        target.closest(INTERACTIVE_SELECTOR)
      ) {
        return
      }
      const element = event.currentTarget
      const state: DragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      }
      element.setPointerCapture(event.pointerId)

      const handleMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== state.pointerId || state.moved) {
          return
        }
        if (
          Math.hypot(moveEvent.clientX - state.startX, moveEvent.clientY - state.startY) >=
          DRAG_THRESHOLD_PX
        ) {
          state.moved = true
          isDraggingRef.current = true
          document.body.style.cursor = 'grabbing'
        }
      }
      const finish = (endEvent: PointerEvent): void => {
        if (endEvent.pointerId !== state.pointerId) {
          return
        }
        element.removeEventListener('pointermove', handleMove)
        element.removeEventListener('pointerup', finish)
        element.removeEventListener('pointercancel', finish)
        if (element.hasPointerCapture(state.pointerId)) {
          element.releasePointerCapture(state.pointerId)
        }
        document.body.style.cursor = ''
        const poppedOut =
          state.moved && endEvent.type === 'pointerup' && isOutsideViewport(endEvent)
        // Keep the flag through the click that follows pointerup so a drag never also toggles.
        window.setTimeout(() => {
          isDraggingRef.current = false
        }, 0)
        if (poppedOut) {
          onPopOut({ x: Math.round(endEvent.screenX), y: Math.round(endEvent.screenY) })
        }
      }
      element.addEventListener('pointermove', handleMove)
      element.addEventListener('pointerup', finish)
      element.addEventListener('pointercancel', finish)
    },
    [allowInteractiveTarget, onPopOut]
  )

  return { onPointerDown, isDraggingRef }
}
