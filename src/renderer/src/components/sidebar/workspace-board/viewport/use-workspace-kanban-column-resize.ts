import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  WORKSPACE_BOARD_COLUMN_WIDTH_STEP,
  clampWorkspaceBoardColumnWidth
} from '../../../../../../shared/workspace/status/workspace-statuses'

type ColumnResizeDraft = { statusId: string; width: number }

type UseWorkspaceKanbanColumnResizeOptions = {
  /** Committed width of one status column, before any in-flight drag. */
  resolveWidth: (statusId: string) => number
  onCommitWidth: (statusId: string, width: number) => void
  onResetWidth: (statusId: string) => void
}

export type WorkspaceKanbanColumnResize = {
  /** Status column being dragged, or null. */
  resizingStatusId: string | null
  /** Rendered width of a column, including an in-flight drag draft. */
  getColumnWidth: (statusId: string) => number
  onColumnResizeStart: (event: React.PointerEvent<HTMLElement>, statusId: string) => void
  onColumnResizeKeyDown: (event: React.KeyboardEvent<HTMLElement>, statusId: string) => void
  onColumnResizeReset: (statusId: string) => void
}

export function useWorkspaceKanbanColumnResize({
  resolveWidth,
  onCommitWidth,
  onResetWidth
}: UseWorkspaceKanbanColumnResizeOptions): WorkspaceKanbanColumnResize {
  const [draft, setDraft] = useState<ColumnResizeDraft | null>(null)
  const draftRef = useRef<ColumnResizeDraft | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const resolveWidthRef = useRef(resolveWidth)
  const commitWidthRef = useRef(onCommitWidth)
  resolveWidthRef.current = resolveWidth
  commitWidthRef.current = onCommitWidth

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const resetDocumentStyles = useCallback(() => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const publishDraft = useCallback((statusId: string, width: number) => {
    const nextWidth = clampWorkspaceBoardColumnWidth(width)
    const current = draftRef.current
    if (current?.statusId === statusId && current.width === nextWidth) {
      return
    }
    draftRef.current = { statusId, width: nextWidth }
    if (frameRef.current !== null) {
      return
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      setDraft(draftRef.current)
    })
  }, [])

  const commitDraft = useCallback(() => {
    const current = draftRef.current
    draftRef.current = null
    cancelFrame()
    setDraft(null)
    if (current && current.width !== resolveWidthRef.current(current.statusId)) {
      commitWidthRef.current(current.statusId, current.width)
    }
  }, [cancelFrame])

  const stopResize = useCallback(() => {
    if (!draftRef.current) {
      return
    }
    resetDocumentStyles()
    commitDraft()
  }, [commitDraft, resetDocumentStyles])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const current = draftRef.current
      if (!current) {
        return
      }
      publishDraft(current.statusId, startWidthRef.current + event.clientX - startXRef.current)
    },
    [publishDraft]
  )

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    window.addEventListener('blur', stopResize)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      window.removeEventListener('blur', stopResize)
      cancelFrame()
      draftRef.current = null
      resetDocumentStyles()
    }
  }, [cancelFrame, handlePointerMove, resetDocumentStyles, stopResize])

  const onColumnResizeStart = useCallback(
    (event: React.PointerEvent<HTMLElement>, statusId: string) => {
      if (event.button !== 0) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const width = resolveWidthRef.current(statusId)
      startXRef.current = event.clientX
      startWidthRef.current = width
      draftRef.current = { statusId, width }
      setDraft(draftRef.current)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    []
  )

  const onColumnResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, statusId: string) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const step = WORKSPACE_BOARD_COLUMN_WIDTH_STEP * (event.shiftKey ? 2 : 1)
      draftRef.current = {
        statusId,
        width: clampWorkspaceBoardColumnWidth(resolveWidthRef.current(statusId) + direction * step)
      }
      commitDraft()
    },
    [commitDraft]
  )

  const getColumnWidth = useCallback(
    (statusId: string) => (draft?.statusId === statusId ? draft.width : resolveWidth(statusId)),
    [draft, resolveWidth]
  )

  return {
    resizingStatusId: draft?.statusId ?? null,
    getColumnWidth,
    onColumnResizeStart,
    onColumnResizeKeyDown,
    onColumnResizeReset: onResetWidth
  }
}
