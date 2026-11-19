import type { OrchestrationTaskGraphTask } from '../../../../../shared/orchestration/orchestration-task-graph'

export const TASK_GRAPH_NODE_WIDTH = 148
export const TASK_GRAPH_NODE_HEIGHT = 40
const GAP_X = 14
const GAP_Y = 34
const PADDING = 10

export type TaskGraphNodeLayout = { task: OrchestrationTaskGraphTask; x: number; y: number }
export type TaskGraphEdgeLayout = { id: string; from: string; to: string; path: string }
export type TaskGraphLayout = {
  width: number
  height: number
  nodes: TaskGraphNodeLayout[]
  edges: TaskGraphEdgeLayout[]
}

/** Longest dependency chain above each task; a cycle (bad data) counts its members as roots. */
function computeDepths(tasks: readonly OrchestrationTaskGraphTask[]): Map<string, number> {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const depths = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (id: string): number => {
    const known = depths.get(id)
    if (known !== undefined) {
      return known
    }
    if (visiting.has(id)) {
      return 0
    }
    visiting.add(id)
    const deps = byId.get(id)?.deps ?? []
    const depth = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(depthOf))
    visiting.delete(id)
    depths.set(id, depth)
    return depth
  }
  for (const task of tasks) {
    depthOf(task.id)
  }
  return depths
}

/** Layered top-to-bottom layout: a task sits one row below the deepest task it waits on. */
export function layoutOrchestrationTaskGraph(
  tasks: readonly OrchestrationTaskGraphTask[]
): TaskGraphLayout {
  if (tasks.length === 0) {
    return { width: 0, height: 0, nodes: [], edges: [] }
  }
  const depths = computeDepths(tasks)
  const layers: OrchestrationTaskGraphTask[][] = []
  for (const task of tasks) {
    const depth = depths.get(task.id) ?? 0
    const layer = layers[depth]
    if (layer) {
      layer.push(task)
    } else {
      layers[depth] = [task]
    }
  }
  const columnOf = new Map<string, number>()
  // Order each row by where its dependencies sit above (barycenter), so edges cross less.
  const rows = layers.map((layer, depth) => {
    const ordered =
      depth === 0
        ? layer
        : layer
            .map((task, index) => {
              const columns = task.deps.flatMap((dep) => {
                const column = columnOf.get(dep)
                return column === undefined ? [] : [column]
              })
              const center =
                columns.length > 0
                  ? columns.reduce((sum, column) => sum + column, 0) / columns.length
                  : index
              return { task, center, index }
            })
            .sort((a, b) => a.center - b.center || a.index - b.index)
            .map(({ task }) => task)
    ordered.forEach((task, column) => columnOf.set(task.id, column))
    return ordered
  })
  const widest = Math.max(...rows.map((row) => row.length))
  const width = PADDING * 2 + widest * TASK_GRAPH_NODE_WIDTH + (widest - 1) * GAP_X
  const height = PADDING * 2 + rows.length * TASK_GRAPH_NODE_HEIGHT + (rows.length - 1) * GAP_Y
  const nodes: TaskGraphNodeLayout[] = []
  const position = new Map<string, { x: number; y: number }>()
  rows.forEach((row, depth) => {
    const rowWidth = row.length * TASK_GRAPH_NODE_WIDTH + (row.length - 1) * GAP_X
    const left = (width - rowWidth) / 2
    const y = PADDING + depth * (TASK_GRAPH_NODE_HEIGHT + GAP_Y)
    row.forEach((task, column) => {
      const x = left + column * (TASK_GRAPH_NODE_WIDTH + GAP_X)
      position.set(task.id, { x, y })
      nodes.push({ task, x, y })
    })
  })
  const edges: TaskGraphEdgeLayout[] = []
  for (const task of tasks) {
    const to = position.get(task.id)
    for (const dep of task.deps) {
      const from = position.get(dep)
      if (!from || !to) {
        continue
      }
      const startX = from.x + TASK_GRAPH_NODE_WIDTH / 2
      const startY = from.y + TASK_GRAPH_NODE_HEIGHT
      const endX = to.x + TASK_GRAPH_NODE_WIDTH / 2
      const endY = to.y
      const bend = (endY - startY) / 2
      edges.push({
        id: `${dep}->${task.id}`,
        from: dep,
        to: task.id,
        path: `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`
      })
    }
  }
  return { width, height, nodes, edges }
}
