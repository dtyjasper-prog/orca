import { clampWorkspaceBoardColumnWidth } from './workspace-statuses'

export const WORKSPACE_BOARD_COLLAPSED_COLUMN_WIDTH = 40
export const WORKSPACE_BOARD_DRAWER_WIDTH_MIN = 480
export const WORKSPACE_BOARD_DRAWER_WIDTH_MAX = 8192
export const WORKSPACE_BOARD_DRAWER_HEIGHT_MIN = 320
export const WORKSPACE_BOARD_DRAWER_HEIGHT_MAX = 8192
const MAX_PER_COLUMN_ENTRIES = 64

export type WorkspaceBoardColumnWidths = Readonly<Record<string, number>>

/** Per-status width overrides; statuses without one use the shared column width. */
export function normalizeWorkspaceBoardColumnWidths(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const result: Record<string, number> = {}
  for (const [statusId, width] of Object.entries(value).slice(0, MAX_PER_COLUMN_ENTRIES)) {
    if (statusId && typeof width === 'number' && Number.isFinite(width)) {
      result[statusId] = clampWorkspaceBoardColumnWidth(width)
    }
  }
  return result
}

export function normalizeWorkspaceBoardCollapsedColumns(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return Array.from(new Set(ids)).slice(0, MAX_PER_COLUMN_ENTRIES)
}

/** null keeps the drawer's default width. */
export function normalizeWorkspaceBoardDrawerWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return Math.min(
    WORKSPACE_BOARD_DRAWER_WIDTH_MAX,
    Math.max(WORKSPACE_BOARD_DRAWER_WIDTH_MIN, Math.round(value))
  )
}

/** null keeps the drawer's full height, from the top chrome down to the status bar. */
export function normalizeWorkspaceBoardDrawerHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return Math.min(
    WORKSPACE_BOARD_DRAWER_HEIGHT_MAX,
    Math.max(WORKSPACE_BOARD_DRAWER_HEIGHT_MIN, Math.round(value))
  )
}

export function resolveWorkspaceBoardLaneWidth(
  statusId: string,
  sharedWidth: number,
  columnWidths: WorkspaceBoardColumnWidths,
  collapsedColumns: ReadonlySet<string>
): number {
  if (collapsedColumns.has(statusId)) {
    return WORKSPACE_BOARD_COLLAPSED_COLUMN_WIDTH
  }
  return columnWidths[statusId] ?? clampWorkspaceBoardColumnWidth(sharedWidth)
}
