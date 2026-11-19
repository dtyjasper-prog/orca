import React from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { isWorkspaceBoardKeepOpenTarget } from './use-workspace-kanban-outside-dismiss'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../../../../app-shell/chrome/workspace-chrome-metrics'
import { trackSidebarLiveWidth } from '../../chrome/sidebar-live-width'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { useWorkspaceKanbanDrawerResize } from './use-workspace-kanban-drawer-resize'

const WORKSPACE_BOARD_DEFAULT_DRAWER_MAX_WIDTH = 1294

type WorkspaceKanbanSheetProps = {
  boardRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
  dragPreview: boolean
  /** Saved drawer width; null keeps the default. */
  drawerWidth: number | null
  onDrawerWidthChange: (width: number | null) => void
  leftSidebarStyle?: React.CSSProperties
  onOpenChange: (open: boolean) => void
  open: boolean
  preserveOpenForMenu: boolean
  sidebarOpen: boolean
  sidebarWidth: number
  statusBarVisible: boolean
}

export default function WorkspaceKanbanSheet({
  boardRef,
  children,
  dragPreview,
  drawerWidth: savedDrawerWidth,
  onDrawerWidthChange,
  leftSidebarStyle,
  onOpenChange,
  open,
  preserveOpenForMenu,
  sidebarOpen,
  sidebarWidth,
  statusBarVisible
}: WorkspaceKanbanSheetProps): React.JSX.Element {
  const drawerLeft = sidebarOpen ? sidebarWidth : 0
  const drawerLeftCss = sidebarOpen
    ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)`
    : '0px'
  const drawerBottom = `${statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0}px`
  const t = useTranslate()
  const { drawerWidth, isResizingDrawer, onDrawerResizeStart, onDrawerResizeReset } =
    useWorkspaceKanbanDrawerResize(savedDrawerWidth, onDrawerWidthChange)
  const drawerMaxWidth = drawerWidth ?? WORKSPACE_BOARD_DEFAULT_DRAWER_MAX_WIDTH
  const keepOpenForOutsideEvent = (event: {
    preventDefault: () => void
    detail: { originalEvent: Event }
  }): void => {
    const originalEvent = event.detail.originalEvent
    const target = originalEvent.target
    if (preserveOpenForMenu || isWorkspaceBoardKeepOpenTarget(target)) {
      event.preventDefault()
      return
    }
    const liveDrawerLeft =
      boardRef.current?.closest<HTMLElement>('[data-slot="sheet-content"]')?.getBoundingClientRect()
        .left ?? drawerLeft
    const pointerX =
      'clientX' in originalEvent && typeof originalEvent.clientX === 'number'
        ? originalEvent.clientX
        : null
    if (pointerX !== null && pointerX < liveDrawerLeft) {
      event.preventDefault()
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true)
        }
      }}
      modal={false}
    >
      <SheetContent
        side="left"
        showCloseButton={false}
        ref={trackSidebarLiveWidth}
        className="workspace-kanban-sheet-content bg-worktree-sidebar p-0 sm:max-w-none"
        overlayStyle={{
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: drawerBottom,
          left: drawerLeftCss,
          pointerEvents: 'none'
        }}
        style={{
          ...leftSidebarStyle,
          left: drawerLeftCss,
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: drawerBottom,
          height: 'auto',
          width: `min(calc(100vw - ${drawerLeftCss}), ${drawerMaxWidth}px)`
        }}
        data-contextual-tour-target="workspace-board-surface"
        data-workspace-board-sheet=""
        data-workspace-board-drag-preview={dragPreview ? 'true' : undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={keepOpenForOutsideEvent}
        onInteractOutside={keepOpenForOutsideEvent}
      >
        {children}
        <div
          data-workspace-board-drawer-resize-handle=""
          role="separator"
          aria-orientation="vertical"
          aria-label={t(
            'auto.components.sidebar.WorkspaceKanbanSheet.resizeBoard',
            'Resize workspace board. Double-click to reset.'
          )}
          className="group absolute inset-y-0 right-0 z-30 w-1.5 cursor-col-resize"
          onPointerDown={onDrawerResizeStart}
          onDoubleClick={onDrawerResizeReset}
        >
          <span
            className={cn(
              'absolute inset-y-0 right-0 w-px bg-transparent transition-colors',
              'group-hover:bg-worktree-sidebar-ring/55',
              isResizingDrawer && 'bg-worktree-sidebar-ring'
            )}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
