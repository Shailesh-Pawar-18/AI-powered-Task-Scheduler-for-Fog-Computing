import { describe, it, expect } from 'vitest';
import {
  buildFogLoadMap,
  canAssignToFog,
  rescheduleFailedTask,
  isNodeOverloaded,
} from './taskScheduling';
import { Task, FogNode } from '../types';

const fogNode: FogNode = {
  id: 'fog_1',
  name: 'Fog Node 1',
  position: { x: 50, y: 50 },
  maxCpu: 100,
  maxMemory: 200,
  currentCpu: 0,
  currentMemory: 0,
  energyConsumption: 0,
  processingTasks: [],
  isActive: true,
  distance: 10,
};

const baseTask: Task = {
  id: 't1',
  deviceId: 'd1',
  type: 'healthcare',
  priority: 'medium',
  cpuRequirement: 40,
  memoryRequirement: 50,
  expectedLatency: 100,
  createdAt: Date.now(),
  status: 'pending',
};

describe('taskScheduling', () => {
  it('tracks load from processing tasks', () => {
    const tasks: Task[] = [
      { ...baseTask, id: 'a', status: 'processing', assignedTo: 'fog_1', cpuRequirement: 30, memoryRequirement: 40 },
      { ...baseTask, id: 'b', status: 'processing', assignedTo: 'fog_1', cpuRequirement: 20, memoryRequirement: 30 },
    ];
    const load = buildFogLoadMap(tasks, [fogNode]);
    expect(load.get('fog_1')).toEqual({ cpu: 50, memory: 70 });
  });

  it('rejects assignment when fog node lacks capacity', () => {
    const load = { cpu: 80, memory: 100 };
    expect(canAssignToFog({ ...baseTask, cpuRequirement: 30 }, fogNode, load)).toBe(false);
    expect(canAssignToFog({ ...baseTask, cpuRequirement: 10 }, fogNode, load)).toBe(true);
  });

  it('reschedules failed tasks back to pending with retry count', () => {
    const failed: Task = {
      ...baseTask,
      status: 'failed',
      assignedTo: 'fog_1',
      completedAt: Date.now(),
      retryCount: 1,
    };
    const rescheduled = rescheduleFailedTask(failed);
    expect(rescheduled.status).toBe('pending');
    expect(rescheduled.assignedTo).toBeUndefined();
    expect(rescheduled.completedAt).toBeUndefined();
    expect(rescheduled.retryCount).toBe(2);
  });

  it('detects overloaded fog nodes', () => {
    const tasks: Task[] = [
      { ...baseTask, id: 'a', status: 'processing', assignedTo: 'fog_1', cpuRequirement: 60 },
      { ...baseTask, id: 'b', status: 'processing', assignedTo: 'fog_1', cpuRequirement: 50 },
    ];
    expect(isNodeOverloaded(tasks, fogNode)).toBe(true);
  });
});
