import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import type { PersistedUIState } from '../../../../../shared/orca-profiles/persisted-ui-state-types'
import { clampWorkspaceBoardColumnWidth } from '../../../../../shared/workspace/status/workspace-statuses'
import {
  normalizeWorkspaceBoardCollapsedColumns,
  normalizeWorkspaceBoardColumnWidths,
  normalizeWorkspaceBoardDrawerHeight,
  normalizeWorkspaceBoardDrawerWidth
} from '../../../../../shared/workspace/status/workspace-board-layout'

type WorkspaceBoardLayoutState = Pick<
  UISlice,
  | 'workspaceBoardColumnWidths'
  | 'workspaceBoardCollapsedColumns'
  | 'workspaceBoardDrawerWidth'
  | 'workspaceBoardDrawerHeight'
>

export function hydrateWorkspaceBoardLayout(
  ui: Partial<PersistedUIState>
): WorkspaceBoardLayoutState {
  return {
    workspaceBoardColumnWidths: normalizeWorkspaceBoardColumnWidths(ui.workspaceBoardColumnWidths),
    workspaceBoardCollapsedColumns: normalizeWorkspaceBoardCollapsedColumns(
      ui.workspaceBoardCollapsedColumns
    ),
    workspaceBoardDrawerWidth: normalizeWorkspaceBoardDrawerWidth(ui.workspaceBoardDrawerWidth),
    workspaceBoardDrawerHeight: normalizeWorkspaceBoardDrawerHeight(ui.workspaceBoardDrawerHeight)
  }
}

/** Per-column widths, collapsed columns and the dragged drawer size of the workspace board. */
export function createWorkspaceBoardLayoutActions(
  set: UISliceSet,
  get: UISliceGet
): WorkspaceBoardLayoutState &
  Pick<
    UISlice,
    | 'setWorkspaceBoardStatusColumnWidth'
    | 'toggleWorkspaceBoardColumnCollapsed'
    | 'setWorkspaceBoardDrawerWidth'
    | 'setWorkspaceBoardDrawerHeight'
  > {
  return {
    workspaceBoardColumnWidths: {},
    setWorkspaceBoardStatusColumnWidth: (statusId, width) => {
      const next: Record<string, number> = { ...get().workspaceBoardColumnWidths }
      if (width === null) {
        delete next[statusId]
      } else {
        next[statusId] = clampWorkspaceBoardColumnWidth(width)
      }
      const normalized = normalizeWorkspaceBoardColumnWidths(next)
      window.api.ui.set({ workspaceBoardColumnWidths: normalized }).catch(console.error)
      set({ workspaceBoardColumnWidths: normalized })
    },

    workspaceBoardCollapsedColumns: [],
    toggleWorkspaceBoardColumnCollapsed: (statusId) => {
      const current = get().workspaceBoardCollapsedColumns
      const normalized = normalizeWorkspaceBoardCollapsedColumns(
        current.includes(statusId)
          ? current.filter((id) => id !== statusId)
          : [...current, statusId]
      )
      window.api.ui.set({ workspaceBoardCollapsedColumns: normalized }).catch(console.error)
      set({ workspaceBoardCollapsedColumns: normalized })
    },

    workspaceBoardDrawerWidth: null,
    setWorkspaceBoardDrawerWidth: (width) => {
      const normalized = normalizeWorkspaceBoardDrawerWidth(width)
      window.api.ui.set({ workspaceBoardDrawerWidth: normalized }).catch(console.error)
      set({ workspaceBoardDrawerWidth: normalized })
    },

    workspaceBoardDrawerHeight: null,
    setWorkspaceBoardDrawerHeight: (height) => {
      const normalized = normalizeWorkspaceBoardDrawerHeight(height)
      window.api.ui.set({ workspaceBoardDrawerHeight: normalized }).catch(console.error)
      set({ workspaceBoardDrawerHeight: normalized })
    }
  }
}
