import { useEffect, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  EMPTY_PARTY_TASK_GRAPH,
  PartyTaskGraph,
  type OrchestrationPartyTaskGraph
} from '../../../../../shared/orchestration/orchestration-task-graph'

const ACTIVE_POLL_MS = 3_000
const IDLE_POLL_MS = 15_000
// Older or remote runtimes without the method answer with an error; ask rarely after one.
const FAILED_POLL_MS = 60_000

/** A graph and when it was read, so elapsed times render without reading the clock. */
export type TaskGraphReading = { graph: OrchestrationPartyTaskGraph; readAt: number }

const EMPTY_READING: TaskGraphReading = { graph: EMPTY_PARTY_TASK_GRAPH, readAt: 0 }

/** Reads now, then again after each settle; skips while the window is hidden. Returns stop. */
function pollPartyTaskGraph(
  target: RuntimeClientTarget,
  party: string,
  intervalMs: number,
  onReading: (reading: TaskGraphReading) => void
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = (delay: number): void => {
    if (!stopped) {
      timer = setTimeout(read, delay)
    }
  }
  function read(): void {
    timer = null
    if (document.visibilityState === 'hidden') {
      schedule(intervalMs)
      return
    }
    callRuntimeRpc<unknown>(
      target,
      'orchestration.partyTaskGraph',
      { party },
      { suppressFeatureInteraction: true, timeoutMs: 5_000 }
    ).then(
      (result) => {
        const parsed = PartyTaskGraph.safeParse(result)
        if (!stopped && parsed.success) {
          onReading({ graph: parsed.data, readAt: Date.now() })
        }
        schedule(parsed.success ? intervalMs : FAILED_POLL_MS)
      },
      () => schedule(FAILED_POLL_MS)
    )
  }
  read()
  return () => {
    stopped = true
    if (timer !== null) {
      clearTimeout(timer)
    }
  }
}

/**
 * The party's newest coordinated Run and its tasks. `active` (graph on screen) refreshes every few
 * seconds; otherwise it only checks now and then whether the party coordinates any tasks.
 */
export function useOrchestrationTaskGraph(
  target: RuntimeClientTarget,
  party: string | null,
  active: boolean
): TaskGraphReading {
  const kind = target.kind
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  const key = party ? JSON.stringify([kind, environmentId, party]) : null
  const [state, setState] = useState<{ key: string | null; reading: TaskGraphReading }>({
    key,
    reading: EMPTY_READING
  })

  useEffect(() => {
    if (!party || !key) {
      return
    }
    const runtimeTarget: RuntimeClientTarget =
      kind === 'environment' && environmentId ? { kind, environmentId } : { kind: 'local' }
    return pollPartyTaskGraph(
      runtimeTarget,
      party,
      active ? ACTIVE_POLL_MS : IDLE_POLL_MS,
      (reading) => setState({ key, reading })
    )
  }, [active, environmentId, key, kind, party])

  return state.key === key ? state.reading : EMPTY_READING
}
