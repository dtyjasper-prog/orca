import { useMemo } from 'react'
import { cn } from '@/lib/class-names'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import StatusIndicator from '@/components/sidebar/workspace-card/surface/StatusIndicator'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { formatCompactDuration } from '../../../../../shared/agent-status/presentation/agent-row-decay-state'
import type { WorktreeStatus } from '../../../../../shared/worktree/row-display/worktree-status-rollup'
import type {
  OrchestrationPartyTaskGraph,
  OrchestrationTaskGraphTask
} from '../../../../../shared/orchestration/orchestration-task-graph'
import {
  TASK_GRAPH_NODE_HEIGHT,
  TASK_GRAPH_NODE_WIDTH,
  layoutOrchestrationTaskGraph
} from './orchestration-task-graph-layout'

/** The live worker behind a dispatched task, when the crew lists it. */
export type TaskGraphWorker = { label: string; status: WorktreeStatus; open: () => void }

type Props = {
  graph: OrchestrationPartyTaskGraph
  /** When the graph was read; open tasks count their elapsed time up to it. */
  readAt: number
  workerByHandle: ReadonlyMap<string, TaskGraphWorker>
}

const TASK_STATUS_INDICATOR: Record<string, WorktreeStatus> = {
  pending: 'inactive',
  ready: 'unconfirmed',
  dispatched: 'working',
  completed: 'done',
  failed: 'failed',
  blocked: 'permission'
}

function taskStatusLabel(status: string, t: Translate): string {
  switch (status) {
    case 'pending':
      return t('components.orchestrationCrew.taskGraph.status.pending', 'Waiting on earlier tasks')
    case 'ready':
      return t('components.orchestrationCrew.taskGraph.status.ready', 'Ready to start')
    case 'dispatched':
      return t('components.orchestrationCrew.taskGraph.status.dispatched', 'In progress')
    case 'completed':
      return t('components.orchestrationCrew.taskGraph.status.completed', 'Done')
    case 'failed':
      return t('components.orchestrationCrew.taskGraph.status.failed', 'Failed')
    case 'blocked':
      return t('components.orchestrationCrew.taskGraph.status.blocked', 'Blocked')
    default:
      return status
  }
}

// Task timestamps come from SQLite as UTC `YYYY-MM-DD HH:MM:SS`.
function parseTaskTime(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(parsed) ? null : parsed
}

function TaskNode({
  task,
  worker,
  readAt,
  x,
  y
}: {
  task: OrchestrationTaskGraphTask
  worker: TaskGraphWorker | undefined
  readAt: number
  x: number
  y: number
}): React.JSX.Element {
  const t = useTranslate()
  const statusLabel = taskStatusLabel(task.status, t)
  // A dispatched task shows its worker's live state; finished tasks keep their own.
  const indicator =
    task.status === 'dispatched' && worker
      ? worker.status
      : (TASK_STATUS_INDICATOR[task.status] ?? 'inactive')
  const started = parseTaskTime(task.createdAt)
  const ended = parseTaskTime(task.completedAt)
  const elapsed = started === null ? null : formatCompactDuration((ended ?? readAt) - started)
  const subtitle = worker?.label || statusLabel
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-task-graph-node={task.id}
          data-task-status={task.status}
          aria-label={`${task.title}: ${statusLabel}`}
          aria-disabled={!worker}
          onClick={worker ? worker.open : undefined}
          className={cn(
            'absolute flex flex-col justify-center gap-0.5 overflow-hidden rounded-md border border-(--crew-border) bg-card px-2 text-left',
            worker ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
            task.status === 'completed' && 'opacity-70'
          )}
          style={{ left: x, top: y, width: TASK_GRAPH_NODE_WIDTH, height: TASK_GRAPH_NODE_HEIGHT }}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
            <StatusIndicator status={indicator} showTooltip={false} />
            <span className="truncate">{task.title}</span>
          </span>
          <span className="truncate pl-[18px] text-2xs text-muted-foreground">{subtitle}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="max-w-64">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{task.title}</span>
          <span>{statusLabel}</span>
          {worker?.label ? (
            <span>
              {t('components.orchestrationCrew.taskGraph.worker', 'Worker: {{name}}', {
                name: worker.label
              })}
            </span>
          ) : null}
          {elapsed ? (
            <span>
              {ended === null
                ? t('components.orchestrationCrew.taskGraph.elapsedRunning', 'Open for {{time}}', {
                    time: elapsed
                  })
                : t('components.orchestrationCrew.taskGraph.elapsedDone', 'Took {{time}}', {
                    time: elapsed
                  })}
            </span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/** The coordinator's Run as a dependency graph: each task one row below what it waits on. */
export function OrchestrationTaskGraph({
  graph,
  readAt,
  workerByHandle
}: Props): React.JSX.Element {
  const t = useTranslate()
  const layout = useMemo(() => layoutOrchestrationTaskGraph(graph.tasks), [graph.tasks])
  const statusById = useMemo(
    () => new Map(graph.tasks.map((task) => [task.id, task.status])),
    [graph.tasks]
  )
  const done = graph.tasks.filter((task) => task.status === 'completed').length
  return (
    <div className="flex min-h-0 flex-col" data-orchestration-task-graph="">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-3 text-2xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" title={graph.run?.objective}>
          {graph.run?.objective}
        </span>
        <span className="shrink-0 tabular-nums">
          {t('components.orchestrationCrew.taskGraph.progress', '{{done}}/{{total}} done', {
            done,
            total: graph.tasks.length
          })}
        </span>
      </div>
      <div className="scrollbar-sleek min-h-0 overflow-auto px-1 pb-2">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 text-muted-foreground"
            width={layout.width}
            height={layout.height}
          >
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.55}
                strokeWidth={1.25}
                // A dependency still open draws dashed; a met one draws solid.
                strokeDasharray={statusById.get(edge.from) === 'completed' ? undefined : '4 3'}
              />
            ))}
          </svg>
          {layout.nodes.map((node) => (
            <TaskNode
              key={node.task.id}
              task={node.task}
              worker={node.task.assignee ? workerByHandle.get(node.task.assignee) : undefined}
              readAt={readAt}
              x={node.x}
              y={node.y}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
