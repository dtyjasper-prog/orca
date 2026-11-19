import React from 'react'
import WorkspaceKanbanAreaSelectionOverlay from '../selection/WorkspaceKanbanAreaSelectionOverlay'
import WorkspaceKanbanDrawerHeader, {
  type WorkspaceBoardSurface
} from './WorkspaceKanbanDrawerHeader'
import WorkspaceKanbanLaneGrid from '../viewport/WorkspaceKanbanLaneGrid'
import WorkspaceKanbanPinDropTarget from '../drag/WorkspaceKanbanPinDropTarget'
import WorkspaceKanbanSheet from './WorkspaceKanbanSheet'

type WorkspaceKanbanDrawerViewProps = {
  areaSelectionOverlayRef: React.RefObject<HTMLDivElement | null>
  boardRef: React.RefObject<HTMLDivElement | null>
  dragPreview: boolean
  drawerWidth: number | null
  onDrawerWidthChange: (width: number | null) => void
  drawerHeight: number | null
  onDrawerHeightChange: (height: number | null) => void
  headerProps: React.ComponentProps<typeof WorkspaceKanbanDrawerHeader>
  laneGridProps: React.ComponentProps<typeof WorkspaceKanbanLaneGrid>
  leftSidebarStyle?: React.CSSProperties
  onAreaSelectionPointerDown: React.PointerEventHandler<HTMLDivElement>
  onCardPointerDownCapture: React.PointerEventHandler<HTMLDivElement>
  onOpenChange: (open: boolean) => void
  onPinDragLeave: (event: React.DragEvent) => void
  onPinDragOver: (event: React.DragEvent) => void
  open: boolean
  pinDragOver: boolean
  preserveOpenForMenu: boolean
  sidebarOpen: boolean
  sidebarWidth: number
  statusBarVisible: boolean
  surface: WorkspaceBoardSurface
}

/** The pop-out window fills its own frame; it keeps the sheet marker so board-scoped selectors still match. */
function WorkspaceBoardWindowFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="workspace-kanban-sheet-content relative flex h-full min-h-0 w-full flex-col bg-worktree-sidebar"
      data-workspace-board-sheet=""
      data-workspace-board-window=""
    >
      {children}
    </div>
  )
}

export default function WorkspaceKanbanDrawerView(
  props: WorkspaceKanbanDrawerViewProps
): React.JSX.Element {
  const content = (
    <>
      <WorkspaceKanbanDrawerHeader {...props.headerProps} />
      <div
        ref={props.boardRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-3"
        data-workspace-board-selection-surface=""
        onPointerDownCapture={props.onCardPointerDownCapture}
        onPointerDown={props.onAreaSelectionPointerDown}
      >
        <WorkspaceKanbanAreaSelectionOverlay ref={props.areaSelectionOverlayRef} />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2"
          data-contextual-tour-target="workspace-board-center"
        />
        <WorkspaceKanbanPinDropTarget
          isDragOver={props.pinDragOver}
          onDragOver={props.onPinDragOver}
          onDragLeave={props.onPinDragLeave}
        />
        <div
          ref={props.laneGridProps.laneScrollerRef}
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-sleek"
        >
          <WorkspaceKanbanLaneGrid {...props.laneGridProps} />
        </div>
      </div>
    </>
  )
  if (props.surface === 'window') {
    return <WorkspaceBoardWindowFrame>{content}</WorkspaceBoardWindowFrame>
  }
  return (
    <WorkspaceKanbanSheet
      boardRef={props.boardRef}
      dragPreview={props.dragPreview}
      drawerWidth={props.drawerWidth}
      onDrawerWidthChange={props.onDrawerWidthChange}
      drawerHeight={props.drawerHeight}
      onDrawerHeightChange={props.onDrawerHeightChange}
      leftSidebarStyle={props.leftSidebarStyle}
      onOpenChange={props.onOpenChange}
      open={props.open}
      preserveOpenForMenu={props.preserveOpenForMenu}
      sidebarOpen={props.sidebarOpen}
      sidebarWidth={props.sidebarWidth}
      statusBarVisible={props.statusBarVisible}
    >
      {content}
    </WorkspaceKanbanSheet>
  )
}
