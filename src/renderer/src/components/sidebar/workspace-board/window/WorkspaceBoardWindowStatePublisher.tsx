import { useEffect } from 'react'
import { useAppStore } from '@/store/index'
import { activateWorktreeFromSidebar } from '@/lib/workspace/activation/sidebar-worktree-activation'
import {
  createWorkspaceBoardMirrorEncoder,
  isWorkspaceBoardRelayedAction
} from './workspace-board-window-mirror'

const PUBLISH_DELAY_MS = 100

/** Main window: mirrors store data into the pop-out board and runs the actions it relays back. */
export function WorkspaceBoardWindowStatePublisher(): null {
  useEffect(() => {
    const api = window.api.workspaceBoardWindow
    if (!api) {
      return
    }
    const encoder = createWorkspaceBoardMirrorEncoder()
    let windowOpen = false
    let published: ReturnType<typeof useAppStore.getState> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let offStore: (() => void) | null = null

    const publish = (): void => {
      timer = null
      if (!windowOpen) {
        return
      }
      const next = useAppStore.getState()
      const patch = encoder.pick(next, published)
      published = next
      if (Object.keys(patch).length === 0) {
        return
      }
      void api.publishState(patch).catch(() => {
        // Resend everything once the offending keys are out, or the pop-out keeps a stale copy.
        if (encoder.excludeUncloneable(patch)) {
          published = null
          queuePublish()
        }
      })
    }
    const queuePublish = (): void => {
      if (windowOpen && timer === null) {
        timer = setTimeout(publish, PUBLISH_DELAY_MS)
      }
    }
    const stop = (): void => {
      windowOpen = false
      published = null
      offStore?.()
      offStore = null
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const offRequested = api.onStateRequested(() => {
      windowOpen = true
      published = null
      offStore ??= useAppStore.subscribe(queuePublish)
      publish()
    })
    const offOpenChanged = api.onOpenChanged((open) => {
      if (!open) {
        stop()
      }
    })
    const offAction = api.onAction((name, args) => {
      if (!isWorkspaceBoardRelayedAction(name)) {
        return
      }
      const action: unknown = Reflect.get(useAppStore.getState(), name)
      if (typeof action === 'function') {
        void Promise.resolve(Reflect.apply(action, undefined, args)).catch((error: unknown) => {
          console.error(`[workspace-board-window] ${name} failed`, error)
        })
      }
    })
    const offReveal = api.onRevealWorktree((worktreeId, executionHostId) => {
      void activateWorktreeFromSidebar(worktreeId, executionHostId)
    })
    void api.restore()

    return () => {
      stop()
      offRequested()
      offOpenChanged()
      offAction()
      offReveal()
    }
  }, [])
  return null
}
