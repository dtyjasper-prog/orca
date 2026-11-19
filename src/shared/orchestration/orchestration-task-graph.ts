import { z } from 'zod'
import { CrewParty } from './orchestration-crew'

export const PartyTaskGraphParams = z.object({ party: CrewParty })

export const TaskGraphTask = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  /** Task ids this one waits on; ids outside the Run are dropped by the reader. */
  deps: z.array(z.string()),
  /** Terminal handle of the worker a dispatched task went to. */
  assignee: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
})
export type OrchestrationTaskGraphTask = z.infer<typeof TaskGraphTask>

export const PartyTaskGraph = z.object({
  run: z.object({ id: z.string(), objective: z.string() }).nullable(),
  tasks: z.array(TaskGraphTask)
})
export type OrchestrationPartyTaskGraph = z.infer<typeof PartyTaskGraph>

export const EMPTY_PARTY_TASK_GRAPH: OrchestrationPartyTaskGraph = { run: null, tasks: [] }
