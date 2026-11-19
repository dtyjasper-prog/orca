import React, { useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import { useRepoMap } from '@/store/repos/use-repository-catalog'
import { useWorkspaceStatusDocumentDrop } from '../../worktree-list/drag/use-workspace-status-drop'
import { useWorkspaceKanbanAreaSelection } from '../selection/use-workspace-kanban-area-selection'
import { useWorkspaceKanbanCardPointerDrag } from '../drag/use-workspace-kanban-card-pointer-drag'
import { useWorkspaceKanbanColumnResize } from '../viewport/use-workspace-kanban-column-resize'
import { useWorkspaceKanbanCreateWorktree } from './use-workspace-kanban-create-worktree'
import { useWorkspaceKanbanSelection } from '../selection/use-workspace-kanban-selection'
import { useWorkspaceKanbanShiftWheelScroll } from '../viewport/use-workspace-kanban-shift-wheel-scroll'
import { useWorkspaceKanbanOutsideDismiss } from './use-workspace-kanban-outside-dismiss'
import { useWorkspaceBoardTaskStatusSync } from '../projection/use-workspace-board-task-status-sync'
import { useWorkspaceKanbanStatusActions } from './use-workspace-kanban-status-actions'
import { useWorkspaceKanbanWorktreeActions } from './use-workspace-kanban-worktree-actions'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { useContextualTour } from '@/components/contextual-tours/use-contextual-tour'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import WorkspaceKanbanDrawerView from './WorkspaceKanbanDrawerView'
import type { WorkspaceBoardSurface } from './WorkspaceKanbanDrawerHeader'
import type { WorkspaceBoardWindowScreenPoint } from '../../../../../../shared/workspace/board-window/workspace-board-window-types'
import { useWorkspaceKanbanBoardProjection } from '../projection/use-workspace-kanban-board-projection'
import { useWorkspaceKanbanNativeDrag } from '../drag/use-workspace-kanban-native-drag'
import { useWorkspaceKanbanRenderLifecycle } from './use-workspace-kanban-render-lifecycle'
import { useWorkspaceKanbanDrawerLingering } from './use-workspace-kanban-drawer-lingering'
import { buildWorktreeManualOrderCatalog } from '../../worktree-list/drag/worktree-manual-order-catalog'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import { resolveWorkspaceBoardLaneWidth } from '../../../../../../shared/workspace/status/workspace-board-layout'
import {
  useAllOfferedWorkspaceStatuses,
  useWorkspaceBoardStatuses
} from '../../workspace-status/presentation/use-workspace-board-statuses'

const EMPTY_COLLAPSED_COLUMNS: ReadonlySet<string> = new Set()

type WorkspaceKanbanDrawerProps = {
  leftSidebarStyle?: React.CSSProperties
  open: boolean
  statusBarVisible: boolean
  dragPreview: boolean
  preserveOpenForMenu: boolean
  onOpenChange: (open: boolean) => void
  onMenuOpenChange: (open: boolean) => void
  surface?: WorkspaceBoardSurface
  /** Replaces the header's close; the pop-out window docks back instead. */
  onHeaderClose?: () => void
  onPopOut?: (at?: WorkspaceBoardWindowScreenPoint) => void
  alwaysOnTop?: boolean
  onAlwaysOnTopChange?: (alwaysOnTop: boolean) => void
}

export default function WorkspaceKanbanDrawer(
  props: WorkspaceKanbanDrawerProps
): React.JSX.Element | null {
  const lingering = useWorkspaceKanbanDrawerLingering(props.open)

  if (!props.open && !lingering) {
    return null
  }
  return <WorkspaceKanbanDrawerContent {...props} />
}

function WorkspaceKanbanDrawerContent({
  leftSidebarStyle,
  open,
  statusBarVisible,
  dragPreview,
  preserveOpenForMenu,
  onOpenChange,
  onMenuOpenChange,
  surface = 'drawer',
  onHeaderClose,
  onPopOut,
  alwaysOnTop,
  onAlwaysOnTopChange
}: WorkspaceKanbanDrawerProps): React.JSX.Element {
  const allWorktrees = useAllWorktrees()
  const folderWorkspaces = useAppStore((s) => selectFolderWorkspaces(s))
  const repoMap = useRepoMap()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorkspaceExecutionHostId = useAppStore((s) => s.activeWorkspaceExecutionHostId)
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const updateWorktreesMeta = useAppStore((s) => s.updateWorktreesMeta)
  const localWorkspaceStatuses = useAppStore((s) => s.workspaceStatuses)
  const boardStatuses = useWorkspaceBoardStatuses()
  const offeredStatuses = useAllOfferedWorkspaceStatuses()
  const setWorkspaceStatuses = useAppStore((s) => s.setWorkspaceStatuses)
  const syncTaskStatusFromWorkspaceBoard = useAppStore((s) => s.syncTaskStatusFromWorkspaceBoard)
  const setSyncTaskStatusFromWorkspaceBoard = useAppStore(
    (s) => s.setSyncTaskStatusFromWorkspaceBoard
  )
  const workspaceBoardColumnWidth = useAppStore((s) => s.workspaceBoardColumnWidth)
  const workspaceBoardColumnWidths = useAppStore((s) => s.workspaceBoardColumnWidths)
  const setWorkspaceBoardStatusColumnWidth = useAppStore(
    (s) => s.setWorkspaceBoardStatusColumnWidth
  )
  const workspaceBoardCollapsedColumns = useAppStore((s) => s.workspaceBoardCollapsedColumns)
  const workspaceBoardDrawerWidth = useAppStore((s) => s.workspaceBoardDrawerWidth)
  const setWorkspaceBoardDrawerWidth = useAppStore((s) => s.setWorkspaceBoardDrawerWidth)
  const toggleWorkspaceBoardColumnCollapsed = useAppStore(
    (s) => s.toggleWorkspaceBoardColumnCollapsed
  )
  const sortBy = useAppStore((s) => s.sortBy)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const boardRef = useRef<HTMLDivElement>(null)
  const laneScrollerRef = useRef<HTMLDivElement>(null)
  const areaSelectionOverlayRef = useRef<HTMLDivElement>(null)
  const { createWorktreeForStatus } = useWorkspaceKanbanCreateWorktree()
  const manualOrderCatalog = useMemo(
    () => buildWorktreeManualOrderCatalog({ worktrees: allWorktrees, folderWorkspaces }),
    [allWorktrees, folderWorkspaces]
  )
  const {
    activeWorktreeIdentity,
    boardDragGroups,
    boardWorktrees,
    laneFullWorktreeIds,
    laneViews,
    renderedBoardWorktrees,
    search: { query, setQuery, clearQuery, matchingWorktreeIds, hasQuery, isQueryTooLarge },
    worktreeById,
    worktreeByKey,
    worktreesByStatus
  } = useWorkspaceKanbanBoardProjection({
    activeWorktreeId,
    activeWorkspaceExecutionHostId,
    allWorktrees,
    open,
    repoMap,
    sortBy,
    workspaceStatuses: boardStatuses
  })
  const {
    selectedWorktreeIds,
    selectedWorktrees,
    selectionAnchorId,
    updateSelectionForGesture,
    updateSelectionForArea,
    clearSelection,
    selectForContextMenu
  } = useWorkspaceKanbanSelection(open, boardWorktrees, renderedBoardWorktrees)
  const { handleAreaSelectionPointerDown } = useWorkspaceKanbanAreaSelection({
    open,
    boardRef,
    overlayRef: areaSelectionOverlayRef,
    selectedWorktreeIds,
    selectionAnchorId,
    updateSelectionForArea
  })
  const resolveColumnWidth = useCallback(
    (statusId: string) =>
      resolveWorkspaceBoardLaneWidth(
        statusId,
        workspaceBoardColumnWidth,
        workspaceBoardColumnWidths,
        EMPTY_COLLAPSED_COLUMNS
      ),
    [workspaceBoardColumnWidth, workspaceBoardColumnWidths]
  )
  const resetColumnWidth = useCallback(
    (statusId: string) => setWorkspaceBoardStatusColumnWidth(statusId, null),
    [setWorkspaceBoardStatusColumnWidth]
  )
  const columnResize = useWorkspaceKanbanColumnResize({
    resolveWidth: resolveColumnWidth,
    onCommitWidth: setWorkspaceBoardStatusColumnWidth,
    onResetWidth: resetColumnWidth
  })
  const collapsedColumnIds = useMemo(
    () => new Set(workspaceBoardCollapsedColumns),
    [workspaceBoardCollapsedColumns]
  )
  const maybeSyncWorkspaceBoardTaskStatuses = useWorkspaceBoardTaskStatusSync({
    enabled: syncTaskStatusFromWorkspaceBoard,
    worktreesByKey: worktreeByKey,
    workspaceStatuses: offeredStatuses
  })
  const {
    dropPointerDraggedWorktreesInStatus,
    dropWorktreesAtEndOfStatus,
    moveWorktreeToStatus,
    moveWorktreesToStatus,
    pinWorktree,
    pinWorktrees,
    shouldWriteDropManualOrder
  } = useWorkspaceKanbanWorktreeActions({
    boardDragGroups,
    laneFullWorktreeIds,
    laneViews,
    maybeSyncTaskStatuses: maybeSyncWorkspaceBoardTaskStatuses,
    sortBy,
    updateWorktreeMeta,
    updateWorktreesMeta,
    workspaceStatuses: boardStatuses,
    worktreeById,
    worktreeByKey,
    manualOrderCatalog,
    worktreesByStatus
  })
  // Drag/context actions must exclude hidden selected cards while selection anchoring still retains the full set.
  const renderedSelectedWorktrees = useMemo(
    () =>
      matchingWorktreeIds
        ? selectedWorktrees.filter((worktree) =>
            matchingWorktreeIds.has(getWorktreeHostIdentity(worktree))
          )
        : selectedWorktrees,
    [matchingWorktreeIds, selectedWorktrees]
  )
  // Narrow the context-menu payload because its selection callback closes over unfiltered cards.
  const selectRenderedForContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, worktree: Worktree): readonly Worktree[] => {
      const selection = selectForContextMenu(event, worktree)
      return matchingWorktreeIds
        ? selection.filter((item) => matchingWorktreeIds.has(getWorktreeHostIdentity(item)))
        : selection
    },
    [matchingWorktreeIds, selectForContextMenu]
  )
  const {
    dragOverStatus,
    handleDragFinish,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePinDragLeave,
    handlePinDragOver,
    pinDragOver,
    setDragOverStatus,
    setPinDragOver
  } = useWorkspaceKanbanNativeDrag(dropWorktreesAtEndOfStatus)
  const { isPointerDragActiveRef, onCardPointerDownCapture } = useWorkspaceKanbanCardPointerDrag({
    open,
    boardRef,
    selectedWorktreeIds,
    selectedWorktrees: renderedSelectedWorktrees,
    onDropWorktreesInStatus: dropPointerDraggedWorktreesInStatus,
    onPinWorktrees: pinWorktrees,
    onDragTargetChange: setDragOverStatus,
    onShouldShowDropIndicator: shouldWriteDropManualOrder,
    onPinDragTargetChange: setPinDragOver
  })
  const handleWorktreeActivate = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])
  const handleHeaderClose = useCallback(() => {
    if (onHeaderClose) {
      onHeaderClose()
      return
    }
    // Only the board’s own close paths bypass its explicit drag/outside-dismiss rules.
    onOpenChange(false)
  }, [onHeaderClose, onOpenChange])
  const {
    handleRenameStatus,
    handleChangeStatusColor,
    handleChangeStatusIcon,
    handleMoveStatus,
    handleAddStatus,
    handleRemoveStatus
  } = useWorkspaceKanbanStatusActions({
    allWorktrees,
    workspaceStatuses: localWorkspaceStatuses,
    boardStatuses,
    setWorkspaceStatuses,
    updateWorktreeMeta
  })

  useWorkspaceStatusDocumentDrop(
    boardRef,
    moveWorktreeToStatus,
    pinWorktree,
    handleDragFinish,
    open,
    {
      onMoveWorktreesToStatus: dropWorktreesAtEndOfStatus,
      onPinWorktrees: pinWorktrees
    }
  )

  const renderCards = useWorkspaceKanbanRenderLifecycle({
    boardRef,
    clearSelection,
    open,
    selectedCount: selectedWorktreeIds.size
  })

  useWorkspaceKanbanShiftWheelScroll(boardRef, laneScrollerRef, open, isPointerDragActiveRef)
  useWorkspaceKanbanOutsideDismiss({ open, boardRef, preserveOpenForMenu, onOpenChange })
  useContextualTour('workspace-board', open && !dragPreview, 'workspace_board_visible')

  return (
    <WorkspaceKanbanDrawerView
      areaSelectionOverlayRef={areaSelectionOverlayRef}
      boardRef={boardRef}
      dragPreview={dragPreview}
      drawerWidth={workspaceBoardDrawerWidth}
      onDrawerWidthChange={setWorkspaceBoardDrawerWidth}
      leftSidebarStyle={leftSidebarStyle}
      onAreaSelectionPointerDown={handleAreaSelectionPointerDown}
      onCardPointerDownCapture={onCardPointerDownCapture}
      onOpenChange={onOpenChange}
      onPinDragLeave={handlePinDragLeave}
      onPinDragOver={handlePinDragOver}
      open={open}
      pinDragOver={pinDragOver}
      preserveOpenForMenu={preserveOpenForMenu}
      sidebarOpen={sidebarOpen}
      sidebarWidth={sidebarWidth}
      statusBarVisible={statusBarVisible}
      surface={surface}
      headerProps={{
        surface,
        onPopOut,
        alwaysOnTop,
        onAlwaysOnTopChange,
        selectedCount: renderedSelectedWorktrees.length,
        query,
        isFiltering: hasQuery,
        isTooLarge: isQueryTooLarge,
        matchCount: matchingWorktreeIds?.size ?? boardWorktrees.length,
        totalCount: boardWorktrees.length,
        onQueryChange: setQuery,
        onClearQuery: clearQuery,
        workspaceStatuses: localWorkspaceStatuses,
        syncTaskStatusFromWorkspaceBoard,
        onSyncTaskStatusFromWorkspaceBoardChange: setSyncTaskStatusFromWorkspaceBoard,
        onRenameStatus: handleRenameStatus,
        onChangeStatusColor: handleChangeStatusColor,
        onChangeStatusIcon: handleChangeStatusIcon,
        onMoveStatus: handleMoveStatus,
        onRemoveStatus: handleRemoveStatus,
        onAddStatus: handleAddStatus,
        onFilterMenuOpenChange: onMenuOpenChange,
        onClose: handleHeaderClose
      }}
      laneGridProps={{
        laneScrollerRef,
        statuses: boardStatuses,
        laneViews,
        laneFullWorktreeIds,
        hasQuery,
        repoMap,
        activeWorktreeIdentity,
        columnResize,
        collapsedColumnIds,
        onToggleColumnCollapsed: toggleWorkspaceBoardColumnCollapsed,
        dragOverStatus,
        renderCards,
        selectedWorktreeIds,
        selectedWorktrees: renderedSelectedWorktrees,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onActivate: handleWorktreeActivate,
        onSelectionGesture: updateSelectionForGesture,
        onContextMenuSelect: selectRenderedForContextMenu,
        onAssignWorkspaceStatus: moveWorktreesToStatus,
        onCreateWorktree: createWorktreeForStatus
      }}
    />
  )
}
