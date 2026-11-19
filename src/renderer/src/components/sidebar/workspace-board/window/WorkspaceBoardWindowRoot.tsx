import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/index'
import { useAppThemePaint } from '@/app-shell/appearance/use-app-theme-paint'
import { buildAppFontFamily } from '@/app-shell/appearance/app-font-family'
import { useReduceVisualEffects } from '@/hooks/theme/use-reduce-visual-effects'
import WorkspaceKanbanDrawer from '../surface/WorkspaceKanbanDrawer'
import {
  buildWorkspaceBoardActionRelays,
  createWorkspaceBoardMirrorApplier
} from './workspace-board-window-mirror'

function ignoreOpenChange(): void {
  // The window is the board; card activation and outside clicks never close it.
}

export function WorkspaceBoardWindowRoot(): React.JSX.Element | null {
  const settings = useAppStore((state) => state.settings)
  const [mirrorReady, setMirrorReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  useReduceVisualEffects(settings?.reduceVisualEffects)
  useAppThemePaint()

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--app-font-family',
      buildAppFontFamily(settings?.appFontFamily)
    )
  }, [settings?.appFontFamily])

  useEffect(() => {
    const api = window.api.workspaceBoardWindow
    useAppStore.setState(buildWorkspaceBoardActionRelays(useAppStore.getState(), api.invokeAction))
    const applyMirror = createWorkspaceBoardMirrorApplier((patch) => useAppStore.setState(patch))
    const offState = api.onState((patch) => {
      applyMirror(patch)
      setMirrorReady(true)
    })
    const offAlwaysOnTop = api.onAlwaysOnTopChanged(setAlwaysOnTop)
    void api.getAlwaysOnTop().then(setAlwaysOnTop, () => {})
    void api.requestState()
    return () => {
      offState()
      offAlwaysOnTop()
    }
  }, [])

  const dock = useCallback(() => {
    void window.api.workspaceBoardWindow.dock()
  }, [])
  const changeAlwaysOnTop = useCallback((next: boolean) => {
    setAlwaysOnTop(next)
    void window.api.workspaceBoardWindow.setAlwaysOnTop(next)
  }, [])

  if (!mirrorReady) {
    return null
  }
  return (
    <WorkspaceKanbanDrawer
      surface="window"
      open
      statusBarVisible={false}
      dragPreview={false}
      preserveOpenForMenu={menuOpen}
      onOpenChange={ignoreOpenChange}
      onMenuOpenChange={setMenuOpen}
      onHeaderClose={dock}
      alwaysOnTop={alwaysOnTop}
      onAlwaysOnTopChange={changeAlwaysOnTop}
    />
  )
}
