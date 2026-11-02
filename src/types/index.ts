export interface IoTDevice {
  id: string;
  name: string;
  type: 'healthcare' | 'traffic' | 'industrial';
  position: { x: number; y: number };
  taskGenerationRate: number;
  isActive: boolean;
}

export interface Task {
  id: string;
  deviceId: string;
  type: 'healthcare' | 'traffic' | 'industrial';
  priority: 'low' | 'medium' | 'high' | 'critical';
  cpuRequirement: number;
  memoryRequirement: number;
  expectedLatency: number;
  createdAt: number;
  assignedTo?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: number;
  actualLatency?: number;
  energyConsumed?: number;
  retryCount?: number;
}

export interface FogNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  maxCpu: number;
  maxMemory: number;
  currentCpu: number;
  currentMemory: number;
  energyConsumption: number;
  processingTasks: Task[];
  isActive: boolean;
  distance: number;
}

export interface CloudNode {
  id: string;
  name: string;
  latency: number;
  processingTasks: Task[];
}

export interface SchedulingStrategy {
  id: string;
  name: string;
  description: string;
}

export interface Metrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgLatency: number;
  totalEnergyConsumed: number;
  fogUtilization: number;
  cloudOffloadRate: number;
}