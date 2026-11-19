import { ipcRenderer } from 'electron'
import type { ExecutionHostId } from '../../../shared/execution-host/execution-host'
import type { PreloadApi } from '../../api-types'

function subscribe<Args extends unknown[]>(
  channel: string,
  callback: (...args: Args) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: Args): void => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

export const workspaceBoardWindowApi = {
  open: (at) => ipcRenderer.invoke('workspaceBoardWindow:open', at),
  restore: () => ipcRenderer.invoke('workspaceBoardWindow:restore'),
  isOpen: () => ipcRenderer.invoke('workspaceBoardWindow:isOpen'),
  publishState: (state) => ipcRenderer.invoke('workspaceBoardWindow:publishState', state),
  onOpenChanged: (callback) =>
    subscribe('workspaceBoardWindow:openChanged', (open: boolean) => callback(open)),
  onDocked: (callback) => subscribe('workspaceBoardWindow:docked', () => callback()),
  onStateRequested: (callback) =>
    subscribe('workspaceBoardWindow:stateRequested', () => callback()),
  onAction: (callback) =>
    subscribe('workspaceBoardWindow:action', (name: string, args: unknown[]) =>
      callback(name, args)
    ),
  onRevealWorktree: (callback) =>
    subscribe(
      'workspaceBoardWindow:revealWorktree',
      (worktreeId: string, executionHostId?: ExecutionHostId) =>
        callback(worktreeId, executionHostId)
    ),
  dock: () => ipcRenderer.invoke('workspaceBoardWindow:dock'),
  requestState: () => ipcRenderer.invoke('workspaceBoardWindow:requestState'),
  onState: (callback) =>
    subscribe('workspaceBoardWindow:state', (state: Record<string, unknown>) => callback(state)),
  invokeAction: (name, args) => ipcRenderer.invoke('workspaceBoardWindow:invokeAction', name, args),
  revealWorktree: (worktreeId, executionHostId) =>
    ipcRenderer.invoke('workspaceBoardWindow:revealWorktree', worktreeId, executionHostId),
  getAlwaysOnTop: () => ipcRenderer.invoke('workspaceBoardWindow:getAlwaysOnTop'),
  setAlwaysOnTop: (alwaysOnTop) =>
    ipcRenderer.invoke('workspaceBoardWindow:setAlwaysOnTop', alwaysOnTop),
  onAlwaysOnTopChanged: (callback) =>
    subscribe('workspaceBoardWindow:alwaysOnTopChanged', (value: boolean) => callback(value))
} satisfies PreloadApi['workspaceBoardWindow']
