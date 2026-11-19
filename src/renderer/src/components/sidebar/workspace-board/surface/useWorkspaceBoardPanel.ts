import { useCallback, useEffect, useRef, useState } from 'react'
import { isEditableTarget } from '@/lib/text-input/focus/editable-target'
import { useAppStore } from '@/store'
import { isXtermHelperTextarea } from '../../../terminal-pane/input/focus/regular-terminal-focus-ownership'
import type { WorkspaceBoardWindowScreenPoint } from '../../../../../../shared/workspace/board-window/workspace-board-window-types'

const WORKSPACE_BOARD_SHEET_SELECTOR = '[data-workspace-board-sheet]'

// Document capture precedes React; let board text fields own Escape before dismissing the panel.
function isWorkspaceBoardEditableTarget(target: EventTarget | null): boolean {
  return (
    isEditableTarget(target) &&
    target instanceof HTMLElement &&
    target.closest(WORKSPACE_BOARD_SHEET_SELECTOR) !== null
  )
}

const WORKSPACE_BOARD_ESCAPE_BLOCKING_OVERLAY_SELECTOR = [
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="context-menu-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[role="dialog"][data-state="open"]:not([data-workspace-board-sheet])',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]'
].join(', ')

export const TOGGLE_WORKSPACE_BOARD_EVENT = 'orca:toggle-workspace-board'

export type WorkspaceBoardPanelState = {
  workspaceBoardOpen: boolean
  workspaceBoardRenderedOpen: boolean
  workspaceBoardDragPreviewOpen: boolean
  workspaceBoardMenuOpen: boolean
  openWorkspaceBoard: () => void
  closeWorkspaceBoard: () => void
  toggleWorkspaceBoard: () => void
  handleWorkspaceBoardOpenChange: (open: boolean) => void
  setWorkspaceBoardMenuOpen: (open: boolean) => void
  previewWorkspaceBoardFromDrag: () => void
  solidifyWorkspaceBoardFromDrag: () => void
  cancelWorkspaceBoardDragPreview: () => void
  /** While popped out the sidebar drawer stays closed and the trigger focuses the window. */
  workspaceBoardWindowOpen: boolean
  /** Absent where the host has no pop-out windows (web, mobile). */
  popOutWorkspaceBoard: ((at?: WorkspaceBoardWindowScreenPoint) => void) | undefined
}

function workspaceBoardWindowApi(): typeof window.api.workspaceBoardWindow | undefined {
  return typeof window === 'undefined' ? undefined : window.api?.workspaceBoardWindow
}

export function useWorkspaceBoardPanel(): WorkspaceBoardPanelState {
  const [workspaceBoardOpen, setWorkspaceBoardOpen] = useState(false)
  const [workspaceBoardDragPreviewOpen, setWorkspaceBoardDragPreviewOpen] = useState(false)
  const [workspaceBoardMenuOpen, setWorkspaceBoardMenuOpen] = useState(false)
  const workspaceBoardOpenRef = useRef(workspaceBoardOpen)
  const workspaceBoardDragPreviewOpenRef = useRef(workspaceBoardDragPreviewOpen)
  const [workspaceBoardWindowOpen, setWorkspaceBoardWindowOpen] = useState(false)
  const workspaceBoardWindowOpenRef = useRef(workspaceBoardWindowOpen)
  workspaceBoardOpenRef.current = workspaceBoardOpen
  workspaceBoardDragPreviewOpenRef.current = workspaceBoardDragPreviewOpen

  const openWorkspaceBoard = useCallback(() => {
    if (workspaceBoardWindowOpenRef.current) {
      void workspaceBoardWindowApi()?.open()
      return
    }
    if (workspaceBoardOpenRef.current) {
      if (workspaceBoardDragPreviewOpenRef.current) {
        workspaceBoardDragPreviewOpenRef.current = false
        setWorkspaceBoardDragPreviewOpen(false)
      }
      return
    }
    workspaceBoardOpenRef.current = true
    workspaceBoardDragPreviewOpenRef.current = false
    // Record the opening action here rather than in a post-render drawer effect.
    useAppStore.getState().recordFeatureInteraction('workspace-board')
    setWorkspaceBoardOpen(true)
    setWorkspaceBoardDragPreviewOpen(false)
  }, [])

  const closeWorkspaceBoard = useCallback(() => {
    workspaceBoardOpenRef.current = false
    workspaceBoardDragPreviewOpenRef.current = false
    setWorkspaceBoardOpen(false)
    setWorkspaceBoardDragPreviewOpen(false)
    setWorkspaceBoardMenuOpen(false)
  }, [])

  const handleWorkspaceBoardOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openWorkspaceBoard()
        return
      }
      closeWorkspaceBoard()
    },
    [closeWorkspaceBoard, openWorkspaceBoard]
  )

  const toggleWorkspaceBoard = useCallback(() => {
    if (workspaceBoardOpenRef.current) {
      closeWorkspaceBoard()
      return
    }
    openWorkspaceBoard()
  }, [closeWorkspaceBoard, openWorkspaceBoard])

  const previewWorkspaceBoardFromDrag = useCallback(() => {
    if (
      workspaceBoardWindowOpenRef.current ||
      workspaceBoardOpenRef.current ||
      workspaceBoardDragPreviewOpenRef.current
    ) {
      return
    }
    workspaceBoardDragPreviewOpenRef.current = true
    setWorkspaceBoardDragPreviewOpen(true)
  }, [])

  const solidifyWorkspaceBoardFromDrag = useCallback(() => {
    if (workspaceBoardWindowOpenRef.current) {
      return
    }
    if (workspaceBoardOpenRef.current) {
      if (workspaceBoardDragPreviewOpenRef.current) {
        workspaceBoardDragPreviewOpenRef.current = false
        setWorkspaceBoardDragPreviewOpen(false)
      }
      return
    }
    workspaceBoardOpenRef.current = true
    workspaceBoardDragPreviewOpenRef.current = false
    useAppStore.getState().recordFeatureInteraction('workspace-board')
    setWorkspaceBoardOpen(true)
    setWorkspaceBoardDragPreviewOpen(false)
  }, [])

  const cancelWorkspaceBoardDragPreview = useCallback(() => {
    if (!workspaceBoardDragPreviewOpenRef.current) {
      return
    }
    workspaceBoardDragPreviewOpenRef.current = false
    setWorkspaceBoardDragPreviewOpen(false)
  }, [])

  useEffect(() => {
    if (!workspaceBoardOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }
      if (workspaceBoardMenuOpen) {
        return
      }
      if (isWorkspaceBoardEditableTarget(event.target)) {
        return
      }
      // Dismiss interactive nested overlays first; tooltips must not trap Escape.
      if (document.querySelector(WORKSPACE_BOARD_ESCAPE_BLOCKING_OVERLAY_SELECTOR)) {
        return
      }
      event.preventDefault()
      // xterm ignores defaultPrevented; stop only its Escape so other targets keep theirs (rename/drag cancel).
      if (isXtermHelperTextarea(event.target)) {
        event.stopPropagation()
      }
      closeWorkspaceBoard()
    }

    // The board is non-modal, so Escape can dismiss it while focus is outside the sheet.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [closeWorkspaceBoard, workspaceBoardMenuOpen, workspaceBoardOpen])

  useEffect(() => {
    const api = workspaceBoardWindowApi()
    if (!api) {
      return
    }
    const applyWindowOpen = (open: boolean): void => {
      workspaceBoardWindowOpenRef.current = open
      setWorkspaceBoardWindowOpen(open)
    }
    const offOpenChanged = api.onOpenChanged(applyWindowOpen)
    const offDocked = api.onDocked(() => {
      applyWindowOpen(false)
      openWorkspaceBoard()
    })
    void api.isOpen().then(applyWindowOpen, () => {})
    return () => {
      offOpenChanged()
      offDocked()
    }
  }, [openWorkspaceBoard])

  const popOutWorkspaceBoard = useCallback(
    (at?: WorkspaceBoardWindowScreenPoint) => {
      const api = workspaceBoardWindowApi()
      if (!api) {
        return
      }
      closeWorkspaceBoard()
      workspaceBoardWindowOpenRef.current = true
      setWorkspaceBoardWindowOpen(true)
      useAppStore.getState().recordFeatureInteraction('workspace-board')
      void api.open(at)
    },
    [closeWorkspaceBoard]
  )

  useEffect(() => {
    window.addEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggleWorkspaceBoard)
    return () => window.removeEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggleWorkspaceBoard)
  }, [toggleWorkspaceBoard])

  return {
    workspaceBoardOpen,
    workspaceBoardRenderedOpen:
      !workspaceBoardWindowOpen && (workspaceBoardOpen || workspaceBoardDragPreviewOpen),
    workspaceBoardDragPreviewOpen: workspaceBoardDragPreviewOpen && !workspaceBoardOpen,
    workspaceBoardMenuOpen,
    openWorkspaceBoard,
    closeWorkspaceBoard,
    toggleWorkspaceBoard,
    handleWorkspaceBoardOpenChange,
    setWorkspaceBoardMenuOpen,
    previewWorkspaceBoardFromDrag,
    solidifyWorkspaceBoardFromDrag,
    cancelWorkspaceBoardDragPreview,
    workspaceBoardWindowOpen,
    popOutWorkspaceBoard: workspaceBoardWindowApi() ? popOutWorkspaceBoard : undefined
  }
}
