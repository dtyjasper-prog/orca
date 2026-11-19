import { BrowserWindow, ipcMain } from 'electron'
import { getTrustedUIRendererWebContents, isTrustedUIRenderer } from '../ui'
import {
  createOrFocusWorkspaceBoardWindow,
  dockWorkspaceBoardWindow,
  getWorkspaceBoardWindow,
  isWorkspaceBoardWindowRenderer,
  setWorkspaceBoardWindowAlwaysOnTop
} from '../../window/workspace-board-window'
import { safelyRevealWindow } from '../../window/activation/focus-existing-window'
import { isBackgroundLaunch } from '../../window/activation/foreground-activation-policy'
import { normalizeExecutionHostId } from '../../../shared/execution-host/execution-host'
import type { Store } from '../../persistence/loading-store/store'

const CHANNELS = [
  'workspaceBoardWindow:open',
  'workspaceBoardWindow:restore',
  'workspaceBoardWindow:isOpen',
  'workspaceBoardWindow:dock',
  'workspaceBoardWindow:publishState',
  'workspaceBoardWindow:requestState',
  'workspaceBoardWindow:invokeAction',
  'workspaceBoardWindow:revealWorktree',
  'workspaceBoardWindow:getAlwaysOnTop',
  'workspaceBoardWindow:setAlwaysOnTop'
]

function readScreenPoint(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const x = 'x' in value ? value.x : undefined
  const y = 'y' in value ? value.y : undefined
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    ? { x, y }
    : null
}

export function registerWorkspaceBoardWindowHandlers(store: Store): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel)
  }

  ipcMain.handle('workspaceBoardWindow:open', (event, at: unknown): void => {
    if (isTrustedUIRenderer(event.sender)) {
      createOrFocusWorkspaceBoardWindow(store, { at: readScreenPoint(at) })
    }
  })
  // The main renderer asks once it mounts, so a board left popped out at quit comes back.
  ipcMain.handle('workspaceBoardWindow:restore', (event): void => {
    if (isTrustedUIRenderer(event.sender) && store.getUI().workspaceBoardWindowOpen === true) {
      createOrFocusWorkspaceBoardWindow(store)
    }
  })
  ipcMain.handle('workspaceBoardWindow:isOpen', (event): boolean =>
    isTrustedUIRenderer(event.sender) ? getWorkspaceBoardWindow() !== null : false
  )
  ipcMain.handle('workspaceBoardWindow:dock', (event): void => {
    if (isWorkspaceBoardWindowRenderer(event.sender) || isTrustedUIRenderer(event.sender)) {
      dockWorkspaceBoardWindow(store)
    }
  })
  ipcMain.handle('workspaceBoardWindow:publishState', (event, state: unknown): void => {
    if (isTrustedUIRenderer(event.sender) && state && typeof state === 'object') {
      getWorkspaceBoardWindow()?.webContents.send('workspaceBoardWindow:state', state)
    }
  })
  ipcMain.handle('workspaceBoardWindow:requestState', (event): void => {
    if (isWorkspaceBoardWindowRenderer(event.sender)) {
      getTrustedUIRendererWebContents()?.send('workspaceBoardWindow:stateRequested')
    }
  })
  // Store actions run in the main renderer, which owns the data; results return through the next state push.
  ipcMain.handle(
    'workspaceBoardWindow:invokeAction',
    (event, name: unknown, args: unknown): void => {
      if (
        !isWorkspaceBoardWindowRenderer(event.sender) ||
        typeof name !== 'string' ||
        !Array.isArray(args)
      ) {
        return
      }
      getTrustedUIRendererWebContents()?.send('workspaceBoardWindow:action', name, args)
    }
  )
  ipcMain.handle(
    'workspaceBoardWindow:revealWorktree',
    (event, worktreeId: unknown, hostId: unknown): void => {
      if (!isWorkspaceBoardWindowRenderer(event.sender) || typeof worktreeId !== 'string') {
        return
      }
      if (hostId !== undefined && typeof hostId !== 'string') {
        return
      }
      const executionHostId = normalizeExecutionHostId(hostId)
      if (hostId !== undefined && executionHostId === null) {
        return
      }
      const main = getTrustedUIRendererWebContents()
      if (!main) {
        return
      }
      if (!isBackgroundLaunch()) {
        const window = BrowserWindow.fromWebContents(main)
        if (window) {
          safelyRevealWindow(window)
        }
      }
      main.send('workspaceBoardWindow:revealWorktree', worktreeId, executionHostId ?? undefined)
    }
  )
  ipcMain.handle('workspaceBoardWindow:getAlwaysOnTop', (event): boolean =>
    isWorkspaceBoardWindowRenderer(event.sender)
      ? store.getUI().workspaceBoardWindowAlwaysOnTop === true
      : false
  )
  ipcMain.handle('workspaceBoardWindow:setAlwaysOnTop', (event, value: unknown): void => {
    if (isWorkspaceBoardWindowRenderer(event.sender) && typeof value === 'boolean') {
      setWorkspaceBoardWindowAlwaysOnTop(store, value)
    }
  })
}
