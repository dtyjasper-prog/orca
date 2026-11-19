import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  normalizeWorkspaceBoardDrawerHeight,
  normalizeWorkspaceBoardDrawerWidth
} from '../../../../../../shared/workspace/status/workspace-board-layout'

/** 'width' drags the drawer's right edge; 'height' drags its bottom edge. */
export type WorkspaceKanbanDrawerResizeAxis = 'width' | 'height'

type UseWorkspaceKanbanDrawerResizeResult = {
  /** Committed size, or the in-flight drag size; null keeps the default. */
  size: number | null
  isResizing: boolean
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void
  onResizeReset: () => void
}

const AXES = {
  width: {
    normalize: normalizeWorkspaceBoardDrawerWidth,
    pointer: (event: { clientX: number }) => event.clientX,
    measure: (rect: DOMRect) => rect.width,
    cursor: 'col-resize'
  },
  height: {
    normalize: normalizeWorkspaceBoardDrawerHeight,
    pointer: (event: { clientY: number }) => event.clientY,
    measure: (rect: DOMRect) => rect.height,
    cursor: 'row-resize'
  }
} as const

export function useWorkspaceKanbanDrawerResize(
  axis: WorkspaceKanbanDrawerResizeAxis,
  committedSize: number | null,
  onCommitSize: (size: number | null) => void
): UseWorkspaceKanbanDrawerResizeResult {
  const [draftSize, setDraftSize] = useState<number | null>(null)
  const draftRef = useRef<number | null>(null)
  const startPointerRef = useRef(0)
  const startSizeRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const config = AXES[axis]

  const finish = useCallback(() => {
    if (draftRef.current === null) {
      return
    }
    const size = draftRef.current
    draftRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setDraftSize(null)
    onCommitSize(size)
  }, [onCommitSize])

  useEffect(() => {
    const handleMove = (event: PointerEvent): void => {
      if (draftRef.current === null) {
        return
      }
      draftRef.current =
        config.normalize(startSizeRef.current + config.pointer(event) - startPointerRef.current) ??
        draftRef.current
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null
          setDraftSize(draftRef.current)
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
  }, [config, finish])

  const onResizeStart = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const sheet = event.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]')
      const size = Math.round(sheet ? config.measure(sheet.getBoundingClientRect()) : 0)
      startPointerRef.current = config.pointer(event)
      startSizeRef.current = size
      draftRef.current = config.normalize(size)
      setDraftSize(draftRef.current)
      document.body.style.cursor = config.cursor
      document.body.style.userSelect = 'none'
    },
    [config]
  )

  const onResizeReset = useCallback(() => onCommitSize(null), [onCommitSize])

  return {
    size: draftSize ?? committedSize,
    isResizing: draftSize !== null,
    onResizeStart,
    onResizeReset
  }
}
