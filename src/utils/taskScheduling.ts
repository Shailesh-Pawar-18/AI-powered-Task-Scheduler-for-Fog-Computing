import { Task, FogNode } from '../types';

export interface NodeLoad {
  cpu: number;
  memory: number;
}

export function buildFogLoadMap(tasks: Task[], fogNodes: FogNode[]): Map<string, NodeLoad> {
  const load = new Map<string, NodeLoad>(
    fogNodes.map((n) => [n.id, { cpu: 0, memory: 0 }])
  );
  for (const task of tasks) {
    if (task.status === 'processing' && task.assignedTo && load.has(task.assignedTo)) {
      const entry = load.get(task.assignedTo)!;
      entry.cpu += task.cpuRequirement;
      entry.memory += task.memoryRequirement;
    }
  }
  return load;
}

export function canAssignToFog(
  task: Task,
  node: FogNode,
  load: NodeLoad
): boolean {
  return (
    node.isActive &&
    load.cpu + task.cpuRequirement <= node.maxCpu &&
    load.memory + task.memoryRequirement <= node.maxMemory
  );
}

export function fogNodesWithLoad(tasks: Task[], fogNodes: FogNode[]): FogNode[] {
  const loadMap = buildFogLoadMap(tasks, fogNodes);
  return fogNodes.map((node) => {
    const load = loadMap.get(node.id)!;
    return {
      ...node,
      currentCpu: load.cpu,
      currentMemory: load.memory,
      processingTasks: tasks.filter(
        (t) => t.assignedTo === node.id && t.status === 'processing'
      ),
    };
  });
}

/** Move a failed task back to the pending queue for another scheduling attempt. */
export function rescheduleFailedTask(task: Task): Task {
  if (task.status !== 'failed') return task;
  return {
    ...task,
    status: 'pending',
    assignedTo: undefined,
    completedAt: undefined,
    actualLatency: undefined,
    energyConsumed: undefined,
    retryCount: (task.retryCount ?? 0) + 1,
  };
}

/** True when every active fog node lacks capacity for this task. */
export function areAllFogNodesBusy(
  tasks: Task[],
  fogNodes: FogNode[],
  task: Task
): boolean {
  const loadMap = buildFogLoadMap(tasks, fogNodes);
  const activeNodes = fogNodes.filter((n) => n.isActive);
  if (activeNodes.length === 0) return true;
  return activeNodes.every(
    (node) => !canAssignToFog(task, node, loadMap.get(node.id)!)
  );
}

/** Detect overload on a fog node from currently processing tasks. */
export function isNodeOverloaded(
  tasks: Task[],
  node: FogNode
): boolean {
  const processing = tasks.filter(
    (t) => t.assignedTo === node.id && t.status === 'processing'
  );
  const cpu = processing.reduce((s, t) => s + t.cpuRequirement, 0);
  const memory = processing.reduce((s, t) => s + t.memoryRequirement, 0);
  return cpu > node.maxCpu || memory > node.maxMemory;
}
