import { IoTDevice, Task } from '../types';

export const generateTask = (device: IoTDevice): Task => {
  const taskTypes = ['healthcare', 'traffic', 'industrial'] as const;
  const priorities = ['low', 'medium', 'high', 'critical'] as const;
  
  // Different task characteristics based on device type
  const taskProfiles = {
    healthcare: {
      cpuRange: [20, 60],
      memoryRange: [15, 40],
      latencyRange: [50, 200],
      priorityWeights: [0.1, 0.2, 0.4, 0.3] // Favor higher priorities
    },
    traffic: {
      cpuRange: [10, 40],
      memoryRange: [10, 30],
      latencyRange: [20, 100],
      priorityWeights: [0.2, 0.3, 0.4, 0.1] // Favor medium-high priorities
    },
    industrial: {
      cpuRange: [30, 80],
      memoryRange: [25, 60],
      latencyRange: [100, 500],
      priorityWeights: [0.3, 0.4, 0.2, 0.1] // Favor lower priorities
    }
  };

  const profile = taskProfiles[device.type];
  const priorityIndex = weightedRandom(profile.priorityWeights);
  
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    deviceId: device.id,
    type: device.type,
    priority: priorities[priorityIndex],
    cpuRequirement: randomBetween(profile.cpuRange[0], profile.cpuRange[1]),
    memoryRequirement: randomBetween(profile.memoryRange[0], profile.memoryRange[1]),
    expectedLatency: randomBetween(profile.latencyRange[0], profile.latencyRange[1]),
    createdAt: Date.now(),
    status: 'pending'
  };
};

function weightedRandom(weights: number[]): number {
  const random = Math.random();
  let sum = 0;
  
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (random <= sum) return i;
  }
  
  return weights.length - 1;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}