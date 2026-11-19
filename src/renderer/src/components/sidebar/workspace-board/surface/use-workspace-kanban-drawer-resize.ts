import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { normalizeWorkspaceBoardDrawerWidth } from '../../../../../../shared/workspace/status/workspace-board-layout'

type UseWorkspaceKanbanDrawerResizeResult = {
  /** Committed width, or the in-flight drag width; null keeps the default. */
  drawerWidth: number | null
  isResizingDrawer: boolean
  onDrawerResizeStart: (event: React.PointerEvent<HTMLElement>) => void
  onDrawerResizeReset: () => void
}

export function useWorkspaceKanbanDrawerResize(
  committedWidth: number | null,
  onCommitWidth: (width: number | null) => void
): UseWorkspaceKanbanDrawerResizeResult {
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const draftRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const frameRef = useRef<number | null>(null)

  const finish = useCallback(() => {
    if (draftRef.current === null) {
      return
    }
    const width = draftRef.current
    draftRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setDraftWidth(null)
    onCommitWidth(width)
  }, [onCommitWidth])

  useEffect(() => {
    const handleMove = (event: PointerEvent): void => {
      if (draftRef.current === null) {
        return
      }
      draftRef.current =
        normalizeWorkspaceBoardDrawerWidth(
          startWidthRef.current + event.clientX - startXRef.current
        ) ?? draftRef.current
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null
          setDraftWidth(draftRef.current)
        })
      }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
    }
  }, [finish])

  const onDrawerResizeStart = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const sheet = event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]')
    const width = Math.round(sheet?.getBoundingClientRect().width ?? 0)
    startXRef.current = event.clientX
    startWidthRef.current = width
    draftRef.current = normalizeWorkspaceBoardDrawerWidth(width)
    setDraftWidth(draftRef.current)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const onDrawerResizeReset = useCallback(() => onCommitWidth(null), [onCommitWidth])

  return {
    drawerWidth: draftWidth ?? committedWidth,
    isResizingDrawer: draftWidth !== null,
    onDrawerResizeStart,
    onDrawerResizeReset
  }
}
