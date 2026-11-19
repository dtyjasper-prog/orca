import './assets/main.css'
import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmationDialogProvider } from './components/dismiss/confirmation/confirmation-dialog'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import { WorkspaceBoardWindowRoot } from './components/sidebar/workspace-board/window/WorkspaceBoardWindowRoot'
import { applyDocumentTheme } from './app-shell/appearance/document-theme'
import { getOrCreateRendererRoot } from './app-shell/startup/react-renderer-root'
import { I18nProvider } from './i18n/I18nProvider'
import { installBodyOverlayAttributes } from './lib/overlay-interaction/body-overlay-attributes'
import { markWorkspaceBoardWindowSurface } from './lib/workspace/activation/workspace-board-window-surface'

// Before any render: card activation must route to the main window from the first click.
markWorkspaceBoardWindowSurface()
const disposeBodyOverlayAttributes = installBodyOverlayAttributes()
import.meta.hot?.dispose(disposeBodyOverlayAttributes)
// Why before settings arrive: the window otherwise paints without a light or dark mode.
applyDocumentTheme('system', { disableTransitions: false })

function BoardWindowShell(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="workspace-board-window.root"
      surface="app-root"
      title={t('workspaceBoard.window.errorTitle', 'Workspace board hit an error.')}
      description={t(
        'workspaceBoard.window.errorDescription',
        'Close and reopen the window to try again.'
      )}
    >
      <TooltipProvider>
        <ConfirmationDialogProvider>
          <div className="app-layout">
            <WorkspaceBoardWindowRoot />
          </div>
        </ConfirmationDialogProvider>
        <Toaster closeButton toastOptions={{ className: 'font-sans text-sm' }} />
      </TooltipProvider>
    </RecoverableRenderErrorBoundary>
  )
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Workspace board window root not found.')
}
getOrCreateRendererRoot(root, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <BoardWindowShell />
    </I18nProvider>
  </StrictMode>
)
