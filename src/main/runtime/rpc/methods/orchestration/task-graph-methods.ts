import { PartyTaskGraphParams } from '../../../../../shared/orchestration/orchestration-task-graph'
import { readPartyTaskGraph } from '../../../orchestration/crew/party-task-graph'
import { defineOrchestrationMethod } from './access/orchestration-method-access'

export const ORCHESTRATION_TASK_GRAPH_METHODS = [
  defineOrchestrationMethod({
    name: 'orchestration.partyTaskGraph',
    // Read by this Orca's own crew panel, keyed by the same party the crew subscription uses.
    access: { kind: 'localOnly', targets: { party: 'party' } },
    permission: 'workspace',
    params: PartyTaskGraphParams,
    handler: ({ party }, { runtime }) =>
      readPartyTaskGraph(runtime.getOrchestrationDb(), party, (handle) =>
        runtime.getTerminalPaneKey(handle)
      )
  })
]
