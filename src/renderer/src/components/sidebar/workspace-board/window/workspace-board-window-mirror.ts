import type { useAppStore } from '@/store'
import {
  AcceptedAgentStatuses,
  acceptedAgentStatuses
} from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'

type StoreState = ReturnType<typeof useAppStore.getState>
type MirrorPatch = Record<string, unknown>

const AGENT_STATUSES_KIND = 'workspace-board-mirror/agent-statuses'
/** AcceptedAgentStatuses is a class; it crosses IPC as its rows and is rebuilt on the other side. */
type EncodedAgentStatuses = { kind: typeof AGENT_STATUSES_KIND; rows: unknown }
type StoreAction = (...args: unknown[]) => unknown
// Reads answer from the pop-out's mirrored state; every other store function runs in the main window.
const LOCAL_FUNCTION_NAME = /^(get|select|has|is|resolve|find|compute|lookup|read)[A-Z]/

const PLAIN_PROTOTYPES: ReadonlySet<object | null> = new Set([
  Object.prototype,
  Array.prototype,
  Map.prototype,
  Set.prototype,
  Date.prototype,
  null
])

/** First class instance found in a value; such values lose their methods across IPC. */
function findClassInstance(value: unknown, depth = 0): string | null {
  if (value === null || typeof value !== 'object' || depth > 3) {
    return null
  }
  const prototype: object | null = Object.getPrototypeOf(value)
  if (!PLAIN_PROTOTYPES.has(prototype)) {
    return prototype?.constructor?.name || 'unknown'
  }
  const children =
    value instanceof Map
      ? Array.from(value.values()).slice(0, 20)
      : value instanceof Set
        ? Array.from(value).slice(0, 20)
        : Object.values(value).slice(0, 50)
  for (const child of children) {
    const found = findClassInstance(child, depth + 1)
    if (found) {
      return found
    }
  }
  return null
}

function encodeValue(value: unknown): unknown {
  if (value instanceof AcceptedAgentStatuses) {
    const encoded: EncodedAgentStatuses = {
      kind: AGENT_STATUSES_KIND,
      rows: Array.from(value.entries())
    }
    return encoded
  }
  return value
}

function isEncodedAgentStatuses(value: unknown): value is EncodedAgentStatuses {
  return (
    !!value &&
    typeof value === 'object' &&
    'kind' in value &&
    value.kind === AGENT_STATUSES_KIND &&
    'rows' in value
  )
}

function decodeValue(value: unknown): unknown {
  if (isEncodedAgentStatuses(value)) {
    // A fresh owner makes the store's ownership boundary resync every pane key.
    return acceptedAgentStatuses(
      Array.isArray(value.rows) ? value.rows.filter(isAgentStatusRow) : []
    )
  }
  return value
}

function isStoreAction(value: unknown): value is StoreAction {
  return typeof value === 'function'
}

/** Main-window side: the store action a pop-out relayed, if the name is one it may relay. */
export function readRelayedStoreAction(state: StoreState, name: string): StoreAction | null {
  if (!isWorkspaceBoardRelayedAction(name)) {
    return null
  }
  const action = new Map<string, unknown>(Object.entries(state)).get(name)
  return isStoreAction(action) ? action : null
}

function isAgentStatusRow(row: unknown): row is readonly [string, AgentStatusEntry] {
  return Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && !!row[1]
}

/** Main-window side: picks changed data keys and keeps out values that cannot cross IPC intact. */
export function createWorkspaceBoardMirrorEncoder(): {
  pick: (next: StoreState, previous: StoreState | null) => MirrorPatch
  excludeUncloneable: (patch: MirrorPatch) => boolean
} {
  const excluded = new Set<string>()
  const checked = new Set<string>()
  const exclude = (key: string, reason: string): void => {
    excluded.add(key)
    if (import.meta.env.DEV) {
      console.warn(`[workspace-board-window] not mirroring ${key}: ${reason}`)
    }
  }
  return {
    pick(next, previous) {
      const patch: MirrorPatch = {}
      const before = previous ? new Map<string, unknown>(Object.entries(previous)) : null
      for (const [key, value] of Object.entries(next)) {
        if (typeof value === 'function' || excluded.has(key)) {
          continue
        }
        if (before && Object.is(before.get(key), value)) {
          continue
        }
        if (!(value instanceof AcceptedAgentStatuses) && !checked.has(key)) {
          checked.add(key)
          const instance = findClassInstance(value)
          if (instance) {
            exclude(key, `holds ${instance}`)
            continue
          }
        }
        patch[key] = encodeValue(value)
      }
      return patch
    },
    // A rejected publish names no key, so probe each one; returns whether anything new was dropped.
    excludeUncloneable(patch) {
      let dropped = false
      for (const [key, value] of Object.entries(patch)) {
        try {
          structuredClone(value)
        } catch {
          exclude(key, 'not structured-cloneable')
          dropped = true
        }
      }
      return dropped
    }
  }
}

function decodeWorkspaceBoardMirrorPatch(patch: MirrorPatch): MirrorPatch {
  const decoded: MirrorPatch = {}
  for (const [key, value] of Object.entries(patch)) {
    decoded[key] = decodeValue(value)
  }
  return decoded
}

/**
 * Pop-out side: applies a mirrored patch. Store write policies may refuse a raw copy of the keys they
 * own (browser page handles, editor buffers); those keys are skipped from then on, the rest still land.
 */
export function createWorkspaceBoardMirrorApplier(
  setState: (patch: MirrorPatch) => void
): (patch: MirrorPatch) => void {
  const refused = new Set<string>()
  return (patch) => {
    const decoded = decodeWorkspaceBoardMirrorPatch(patch)
    for (const key of refused) {
      delete decoded[key]
    }
    try {
      setState(decoded)
      return
    } catch {
      // Fall through and isolate the keys a write policy refuses.
    }
    for (const [key, value] of Object.entries(decoded)) {
      try {
        setState({ [key]: value })
      } catch (error) {
        refused.add(key)
        if (import.meta.env.DEV) {
          console.warn(`[workspace-board-window] store refused mirrored ${key}`, error)
        }
      }
    }
  }
}

export function isWorkspaceBoardRelayedAction(name: string): boolean {
  return !LOCAL_FUNCTION_NAME.test(name)
}

/** Pop-out side: replaces store actions with relays into the main window's store. */
export function buildWorkspaceBoardActionRelays(
  state: StoreState,
  invoke: (name: string, args: unknown[]) => Promise<void>
): MirrorPatch {
  const relays: MirrorPatch = {}
  for (const [name, value] of Object.entries(state)) {
    if (typeof value !== 'function' || !isWorkspaceBoardRelayedAction(name)) {
      continue
    }
    relays[name] = (...args: unknown[]): Promise<void> =>
      invoke(name, args).catch((error: unknown) => {
        console.warn(`[workspace-board-window] could not relay ${name}`, error)
      })
  }
  return relays
}
