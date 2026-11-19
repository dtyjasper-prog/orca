import type { ExecutionHostId } from '../../../shared/execution-host/execution-host'
import type { WorkspaceBoardWindowScreenPoint } from '../../../shared/workspace/board-window/workspace-board-window-types'

export type WorkspaceBoardWindowApi = {
  // Main renderer side.
  open: (at?: WorkspaceBoardWindowScreenPoint) => Promise<void>
  restore: () => Promise<void>
  isOpen: () => Promise<boolean>
  publishState: (state: Record<string, unknown>) => Promise<void>
  onOpenChanged: (callback: (open: boolean) => void) => () => void
  onDocked: (callback: () => void) => () => void
  onStateRequested: (callback: () => void) => () => void
  onAction: (callback: (name: string, args: unknown[]) => void) => () => void
  onRevealWorktree: (
    callback: (worktreeId: string, executionHostId?: ExecutionHostId) => void
  ) => () => void
  // Pop-out window side.
  dock: () => Promise<void>
  requestState: () => Promise<void>
  onState: (callback: (state: Record<string, unknown>) => void) => () => void
  invokeAction: (name: string, args: unknown[]) => Promise<void>
  revealWorktree: (worktreeId: string, executionHostId?: ExecutionHostId) => Promise<void>
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  onAlwaysOnTopChanged: (callback: (alwaysOnTop: boolean) => void) => () => void
}
