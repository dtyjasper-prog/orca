import type { OrchestrationDb } from '../db/orchestration-db'
import type { RunRow } from '../db/orchestration-records'
import { parseOrcaSessionAddress } from '../../../../shared/agent-session/identity/orca-session-address'
import {
  EMPTY_PARTY_TASK_GRAPH,
  type OrchestrationPartyTaskGraph
} from '../../../../shared/orchestration/orchestration-task-graph'

function parseDeps(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((dep): dep is string => typeof dep === 'string')
      : []
  } catch {
    return []
  }
}

/** Runs this crew party coordinates: a chat by its Orca session id, a terminal by its handle or
 *  its pane, since a terminal gets a new handle when Orca restarts but keeps its pane. */
function coordinatedRuns(
  db: OrchestrationDb,
  party: string,
  paneKeyForHandle: (handle: string) => string | null
): RunRow[] {
  const orcaSessionId = parseOrcaSessionAddress(party)
  if (orcaSessionId) {
    return db.runsBoundToCoordinator({ orcaSessionId, paneKey: null, terminalHandle: null })
  }
  const byHandle = db.getRunMailboxOwnerIdsForHandle(party).flatMap((id) => {
    const run = db.getRun(id)
    return run ? [run] : []
  })
  const paneKey = paneKeyForHandle(party)
  return paneKey ? [...byHandle, ...db.runsBoundToPane(paneKey)] : byHandle
}

/** The newest Run the party coordinates, with every task and the dependency edges between them. */
export function readPartyTaskGraph(
  db: OrchestrationDb,
  party: string,
  paneKeyForHandle: (handle: string) => string | null
): OrchestrationPartyTaskGraph {
  const run = coordinatedRuns(db, party, paneKeyForHandle)
    .filter((candidate) => candidate.legacy === 0)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id))[0]
  if (!run) {
    return EMPTY_PARTY_TASK_GRAPH
  }
  const rows = db.listTasksWithDispatch({ runId: run.id })
  const ids = new Set(rows.map((row) => row.id))
  return {
    run: { id: run.id, objective: run.objective },
    tasks: rows.map((row) => ({
      id: row.id,
      title: row.display_name || row.task_title || row.spec.slice(0, 80),
      status: row.status,
      deps: parseDeps(row.deps).filter((dep) => ids.has(dep) && dep !== row.id),
      assignee: row.assignee_handle,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }))
  }
}
