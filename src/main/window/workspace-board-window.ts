import { mainI18n, translateMain } from '../i18n/main-i18n'
import { app, BrowserWindow, nativeTheme, screen, type Event, type WebContents } from 'electron'
import { join } from 'node:path'
import type { Store } from '../persistence/loading-store/store'
import {
  isBackgroundLaunch,
  showWindowWithoutStealingFocus
} from './activation/foreground-activation-policy'
import { rectHasVisibleAreaOnAnyDisplay } from './presentation/window-bounds-validation'
import { installPrivilegedWindowNavigationPolicy } from './security/privileged-window-navigation'
import { getTrustedUIRendererWindow, sendToTrustedUIRenderer } from '../ipc/ui'
import {
  stepUIZoomLevel,
  type UIZoomDirection
} from '../../shared/app-lifecycle/windows/ui-zoom-level'
import { wslHostsWindowArguments } from '../wsl/host-lifecycle/wsl-host-gate'

const MIN_WIDTH = 480
const MIN_HEIGHT = 360
const DEFAULT_WIDTH = 1180
const DEFAULT_HEIGHT = 780
// Where a window dragged out of the main window lands relative to the cursor.
const DRAG_OUT_CURSOR_OFFSET = { x: 160, y: 18 }

type Bounds = { x: number; y: number; width: number; height: number }

let boardWindow: BrowserWindow | null = null

export function getWorkspaceBoardWindow(): BrowserWindow | null {
  return boardWindow && !boardWindow.isDestroyed() && !boardWindow.webContents.isDestroyed()
    ? boardWindow
    : null
}

export function isWorkspaceBoardWindowRenderer(sender: WebContents): boolean {
  return getWorkspaceBoardWindow()?.webContents === sender
}

export function zoomWorkspaceBoardWindowIfFocused(direction: UIZoomDirection): boolean {
  const window = getWorkspaceBoardWindow()
  if (!window || !window.isFocused()) {
    return false
  }
  const contents = window.webContents
  contents.setZoomLevel(stepUIZoomLevel(contents.getZoomLevel(), direction))
  return true
}

function resolveRestoredBounds(store: Store): Bounds | null {
  const raw = store.getUI().workspaceBoardWindowBounds ?? null
  if (
    raw &&
    raw.width >= MIN_WIDTH &&
    raw.height >= MIN_HEIGHT &&
    rectHasVisibleAreaOnAnyDisplay(raw, MIN_WIDTH / 2, MIN_HEIGHT / 2)
  ) {
    return raw
  }
  return null
}

function resolveInitialBounds(store: Store, at: { x: number; y: number } | null): Bounds | null {
  const saved = resolveRestoredBounds(store)
  if (!at) {
    return saved
  }
  const width = saved?.width ?? DEFAULT_WIDTH
  const height = saved?.height ?? DEFAULT_HEIGHT
  const area = screen.getDisplayNearestPoint(at).workArea
  const x = Math.min(Math.max(at.x - DRAG_OUT_CURSOR_OFFSET.x, area.x), area.x + area.width - width)
  const y = Math.min(
    Math.max(at.y - DRAG_OUT_CURSOR_OFFSET.y, area.y),
    area.y + area.height - height
  )
  return { x: Math.round(x), y: Math.round(y), width, height }
}

/** True when the cursor sits over the main window's sidebar, where a dragged board docks back. */
function isCursorOverMainSidebar(store: Store): boolean {
  const main = getTrustedUIRendererWindow()
  const ui = store.getUI()
  if (!main || main.isDestroyed() || main.isMinimized() || ui.sidebarOpen === false) {
    return false
  }
  const content = main.getContentBounds()
  const sidebarWidth = (ui.sidebarWidth ?? 0) * main.webContents.getZoomFactor()
  const cursor = screen.getCursorScreenPoint()
  return (
    cursor.x >= content.x &&
    cursor.x <= content.x + sidebarWidth &&
    cursor.y >= content.y &&
    cursor.y <= content.y + content.height
  )
}

function notifyOpenChanged(open: boolean): void {
  sendToTrustedUIRenderer('workspaceBoardWindow:openChanged', open)
}

export function setWorkspaceBoardWindowAlwaysOnTop(store: Store, alwaysOnTop: boolean): void {
  store.updateUI({ workspaceBoardWindowAlwaysOnTop: alwaysOnTop })
  const window = getWorkspaceBoardWindow()
  if (window) {
    window.setAlwaysOnTop(alwaysOnTop)
    window.webContents.send('workspaceBoardWindow:alwaysOnTopChanged', alwaysOnTop)
  }
}

/** Close the pop-out and hand the board back to the main window's sidebar drawer. */
export function dockWorkspaceBoardWindow(store: Store): void {
  const window = getWorkspaceBoardWindow()
  store.updateUI({ workspaceBoardWindowOpen: false })
  window?.close()
  sendToTrustedUIRenderer('workspaceBoardWindow:docked', null)
}

export function createOrFocusWorkspaceBoardWindow(
  store: Store,
  options: { at?: { x: number; y: number } | null } = {}
): BrowserWindow {
  const existing = getWorkspaceBoardWindow()
  if (existing) {
    if (existing.webContents.isCrashed()) {
      existing.webContents.reload()
    }
    if (existing.isMinimized()) {
      existing.restore()
    }
    if (!isBackgroundLaunch()) {
      existing.focus()
    }
    return existing
  }

  const bounds = resolveInitialBounds(store, options.at ?? null)
  const alwaysOnTop = store.getUI().workspaceBoardWindowAlwaysOnTop === true
  // Serve-only: this window lists saved WSL hosts and their Connect, as the main window does.
  const wslArguments = wslHostsWindowArguments()
  const window = new BrowserWindow({
    width: bounds?.width ?? DEFAULT_WIDTH,
    height: bounds?.height ?? DEFAULT_HEIGHT,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    alwaysOnTop,
    title: translateMain('native.dialog.workspaceBoardTitle', 'Orca Workspace Board'),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      partition: 'orca-workspace-board-window',
      webviewTag: false,
      ...(wslArguments.length > 0 ? { additionalArguments: wslArguments } : {})
    }
  })
  boardWindow = window
  store.updateUI({ workspaceBoardWindowOpen: true })
  installPrivilegedWindowNavigationPolicy(window.webContents)
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.webContents.on('dom-ready', () => {
    if (!window.isDestroyed()) {
      window.webContents.setZoomLevel(store.getUI().uiZoomLevel ?? 0)
    }
  })
  let lastFollowedZoomLevel = store.getUI().uiZoomLevel ?? 0
  const offUIChanged = store.onUIChanged((ui) => {
    const level = ui.uiZoomLevel ?? 0
    if (level !== lastFollowedZoomLevel && !window.isDestroyed()) {
      lastFollowedZoomLevel = level
      window.webContents.setZoomLevel(level)
    }
  })
  window.on('page-title-updated', (event) => {
    event.preventDefault()
  })
  const updateTitle = (): void => {
    if (!window.isDestroyed()) {
      window.setTitle(translateMain('native.dialog.workspaceBoardTitle', 'Orca Workspace Board'))
    }
  }
  mainI18n.on('languageChanged', updateTitle)

  // Debounced so resize bursts and teardown cannot replace the remembered bounds with a transient size.
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  let windowClosing = false
  const saveBounds = (): void => {
    if (boundsTimer) {
      clearTimeout(boundsTimer)
    }
    boundsTimer = setTimeout(() => {
      boundsTimer = null
      if (windowClosing || window.isDestroyed() || window.isMinimized() || window.isFullScreen()) {
        return
      }
      const next = window.getBounds()
      if (next.width >= MIN_WIDTH && next.height >= MIN_HEIGHT) {
        store.updateUI({ workspaceBoardWindowBounds: next })
      }
    }, 500)
  }
  window.on('resize', saveBounds)
  window.on('move', saveBounds)
  window.once('ready-to-show', () => showWindowWithoutStealingFocus(window))
  // A board dropped outside the main window should reopen where it landed, even if never moved.
  saveBounds()
  // 'moved' fires once when a user drag ends (macOS/Windows), which is when a drop on the sidebar docks.
  window.on('moved', () => {
    if (!windowClosing && isCursorOverMainSidebar(store)) {
      dockWorkspaceBoardWindow(store)
    }
  })

  const freezeBounds = (event?: Event): void => {
    if (event?.defaultPrevented) {
      return
    }
    windowClosing = true
    if (boundsTimer) {
      clearTimeout(boundsTimer)
      boundsTimer = null
    }
  }
  // Quitting keeps workspaceBoardWindowOpen so the pop-out comes back on the next launch.
  let appQuitting = false
  const markQuitting = (event: Event): void => {
    appQuitting = true
    freezeBounds(event)
  }
  window.on('close', (event) => {
    freezeBounds(event)
    if (!appQuitting && !event.defaultPrevented) {
      store.updateUI({ workspaceBoardWindowOpen: false })
    }
  })
  app.on('before-quit', markQuitting)

  window.on('closed', () => {
    mainI18n.off('languageChanged', updateTitle)
    app.removeListener('before-quit', markQuitting)
    offUIChanged()
    if (boardWindow === window) {
      boardWindow = null
      notifyOpenChanged(false)
    }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/board.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/board.html'))
  }
  notifyOpenChanged(true)
  return window
}

/** Closes with the main window; the open flag survives so the next launch restores it. */
export function closeWorkspaceBoardWindowWithMainWindow(): void {
  const window = getWorkspaceBoardWindow()
  if (!window) {
    return
  }
  window.removeAllListeners('close')
  window.close()
}

export function closeWorkspaceBoardWindow(): void {
  getWorkspaceBoardWindow()?.close()
}
