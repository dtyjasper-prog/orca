import { useCallback, useMemo, useState } from 'react'
import { openOrchestrationCrewAgent } from '@/lib/agent-session/open/open-agent-message-sender'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { OrchestrationCrewRow } from '../../../../../shared/orchestration/orchestration-crew'
import type { OrchestrationTaskGraphTask } from '../../../../../shared/orchestration/orchestration-task-graph'
import type { CrewRowLook } from '../CrewAgentIcons'
import type { TaskGraphWorker } from './OrchestrationTaskGraph'
import { useOrchestrationTaskGraph } from './use-orchestration-task-graph'

export type CrewPanelView = 'list' | 'graph'

/** Workers keyed by every handle a task's assignee may name: the send address and the terminal. */
function workersByHandle(
  managing: readonly OrchestrationCrewRow[],
  lookByParty: ReadonlyMap<string, CrewRowLook | undefined>,
  target: RuntimeClientTarget
): Map<string, TaskGraphWorker> {
  const workers = new Map<string, TaskGraphWorker>()
  for (const row of managing) {
    const worker: TaskGraphWorker = {
      label: row.label,
      status: lookByParty.get(row.partyKey)?.status ?? 'inactive',
      open: () => {
        void openOrchestrationCrewAgent(row, target)
      }
    }
    for (const handle of [
      row.sendAddress,
      row.openTarget?.kind === 'terminal' ? row.openTarget.handle : undefined
    ]) {
      if (handle) {
        workers.set(handle, worker)
      }
    }
  }
  return workers
}

/**
 * Without a crew row (the crew subscription is off, or the worker left it) a dispatched task still
 * opens its assignee terminal by handle; it has no name or live state to show.
 */
function addAssigneeTerminals(
  workers: Map<string, TaskGraphWorker>,
  tasks: readonly OrchestrationTaskGraphTask[],
  target: RuntimeClientTarget
): Map<string, TaskGraphWorker> {
  for (const task of tasks) {
    const handle = task.assignee
    if (!handle || workers.has(handle)) {
      continue
    }
    const row: OrchestrationCrewRow = {
      partyKey: handle,
      role: 'worker',
      label: task.title,
      agentKind: '',
      status: 'working',
      openTarget: { kind: 'terminal', handle }
    }
    workers.set(handle, {
      label: '',
      status: 'working',
      open: () => {
        void openOrchestrationCrewAgent(row, target)
      }
    })
  }
  return workers
}

/** The crew panel's list/graph switch; the graph polls fast only while it is on screen. */
export function useCrewTaskGraphView({
  target,
  party,
  isVisible,
  open,
  managing,
  lookByParty
}: {
  target: RuntimeClientTarget
  party: string
  isVisible: boolean
  open: boolean
  managing: readonly OrchestrationCrewRow[]
  lookByParty: ReadonlyMap<string, CrewRowLook | undefined>
}) {
  const [chosenView, setChosenView] = useState<CrewPanelView>('list')
  const { graph, readAt } = useOrchestrationTaskGraph(
    target,
    isVisible ? party : null,
    open && chosenView === 'graph'
  )
  const hasGraph = graph.tasks.length > 0
  const workerByHandle = useMemo(
    () => addAssigneeTerminals(workersByHandle(managing, lookByParty, target), graph.tasks, target),
    [graph.tasks, managing, lookByParty, target]
  )
  const toggleView = useCallback(() => {
    setChosenView((current) => (current === 'list' ? 'graph' : 'list'))
  }, [])
  const view: CrewPanelView = hasGraph ? chosenView : 'list'
  return {
    view,
    hasGraph,
    graph,
    readAt,
    workerByHandle,
    toggleView
  }
}
