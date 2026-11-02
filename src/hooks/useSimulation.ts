import { useState, useEffect, useCallback, useRef } from 'react';
import { IoTDevice, Task, FogNode, CloudNode, SchedulingStrategy, Metrics } from '../types';
import { generateTask } from '../utils/taskGenerator';
import { AIScheduler } from '../utils/scheduler';
import { buildFogNodes } from '../utils/fogNodes';
import {
  buildFogLoadMap,
  canAssignToFog,
  fogNodesWithLoad,
  isNodeOverloaded,
  rescheduleFailedTask,
} from '../utils/taskScheduling';

/** Default topology: 9 fog nodes (9000-record plan). */
const DEFAULT_NODE_RECORD_COUNT = 9000;

const INITIAL_IOT_DEVICES: IoTDevice[] = [
  {
    id: 'device_1',
    name: 'Healthcare Monitor',
    type: 'healthcare',
    position: { x: 20, y: 70 },
    taskGenerationRate: 2000,
    isActive: true
  },
  {
    id: 'device_2',
    name: 'Traffic Sensor',
    type: 'traffic',
    position: { x: 30, y: 30 },
    taskGenerationRate: 1500,
    isActive: true
  },
  {
    id: 'device_3',
    name: 'Industrial Controller',
    type: 'industrial',
    position: { x: 70, y: 80 },
    taskGenerationRate: 3000,
    isActive: true
  }
];

const INITIAL_FOG_NODES: FogNode[] = buildFogNodes(DEFAULT_NODE_RECORD_COUNT);

const INITIAL_CLOUD_NODE: CloudNode = {
  id: 'cloud_1',
  name: 'Cloud Data Center',
  latency: 150,
  processingTasks: []
};

const SCHEDULING_STRATEGIES: SchedulingStrategy[] = [
  {
    id: 'drl_optimized',
    name: 'Weighted Score (DRL-inspired)',
    description: 'Hand-weighted multi-factor score inspired by DRL research (no trained model)'
  },
  {
    id: 'modrl',
    name: 'MODRL (3×DQN + NSGA-II)',
    description: 'Three trained DQN agents (load, distance, priority) combined by NSGA-II selection'
  },
  {
    id: 'priority_aware',
    name: 'Priority Aware',
    description: 'Schedule based on task priority and urgency'
  },
  {
    id: 'load_balanced',
    name: 'Load Balanced',
    description: 'Distribute tasks evenly across fog nodes'
  },
  {
    id: 'energy_efficient',
    name: 'Energy Efficient',
    description: 'Minimize energy consumption across the network'
  }
];

export const useSimulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<SchedulingStrategy>(SCHEDULING_STRATEGIES[0]);
  const [iotDevices, setIoTDevices] = useState<IoTDevice[]>(INITIAL_IOT_DEVICES);
  const [fogNodes, setFogNodes] = useState<FogNode[]>(INITIAL_FOG_NODES);
  const [cloudNode, setCloudNode] = useState<CloudNode>(INITIAL_CLOUD_NODE);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    avgLatency: 0,
    totalEnergyConsumed: 0,
    fogUtilization: 0,
    cloudOffloadRate: 0
  });
  const [performanceData, setPerformanceData] = useState<Array<{
    timestamp: number;
    latency: number;
    energy: number;
    utilization: number;
  }>>([]);

  // Dataset mode state
  const [useDatasetMode, setUseDatasetMode] = useState(false);
  const [datasetTasks, setDatasetTasks] = useState<Task[]>([]);
  const [datasetIndex, setDatasetIndex] = useState(0);
  // The simulation interval captures generateTasks once at start, so reading
  // datasetIndex from that closure goes stale and progress runs past 100%.
  // A ref always reflects the live index, keeping the dataset cursor correct.
  const datasetIndexRef = useRef(0);
  useEffect(() => {
    datasetIndexRef.current = datasetIndex;
  }, [datasetIndex]);

  const schedulerRef = useRef<AIScheduler | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appliedRecordCountRef = useRef(DEFAULT_NODE_RECORD_COUNT);

  useEffect(() => {
    schedulerRef.current = new AIScheduler(currentStrategy);
  }, [currentStrategy]);

  const generateTasks = useCallback(() => {
    // If using dataset mode, inject tasks from loaded dataset
    if (useDatasetMode && datasetTasks.length > 0) {
      // Read the live cursor from the ref so the captured interval callback
      // never advances past the end of the dataset.
      const currentIndex = datasetIndexRef.current;
      if (currentIndex < datasetTasks.length) {
        // Add up to 10 tasks per interval from dataset for better visibility
        const batchSize = Math.min(10, datasetTasks.length - currentIndex);
        const newTasks = datasetTasks.slice(currentIndex, currentIndex + batchSize).map((task, idx) => ({
          ...task,
          id: `task_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`, // Ensure unique ID
          createdAt: Date.now(),
          status: 'pending' as const
        }));

        if (newTasks.length > 0) {
          const nextIndex = currentIndex + batchSize;
          // Advance the ref immediately so back-to-back ticks stay in sync
          // before the state update commits.
          datasetIndexRef.current = nextIndex;
          console.log(`[GenerateTasks] Adding ${newTasks.length} tasks from dataset (index ${currentIndex} -> ${nextIndex}/${datasetTasks.length})`);
          setTasks(prevTasks => [...prevTasks, ...newTasks]);
          setDatasetIndex(nextIndex);
        }
      } else {
        console.log('[GenerateTasks] Dataset exhausted - all tasks processed');
      }
    } else {
      // Original random task generation
      const newTasks: Task[] = [];
      
      iotDevices.forEach(device => {
        if (device.isActive && Math.random() < 0.3) { // 30% chance per interval
          const task = generateTask(device);
          newTasks.push(task);
        }
      });

      if (newTasks.length > 0) {
        setTasks(prevTasks => [...prevTasks, ...newTasks]);
      }
    }
  }, [iotDevices, useDatasetMode, datasetTasks]);

  const scheduleTasks = useCallback(() => {
    if (!schedulerRef.current) return;

    setTasks(prevTasks => {
      const otherTasks = prevTasks.filter((task) => task.status !== 'pending');
      const pendingTasks = prevTasks.filter((task) => task.status === 'pending');
      const loadMap = buildFogLoadMap(prevTasks, fogNodes);
      const nodesWithLoad = fogNodesWithLoad(prevTasks, fogNodes);
      const scheduled: Task[] = [];

      for (const task of pendingTasks) {
        const assignedNodeId = schedulerRef.current!.scheduleTask(
          task,
          nodesWithLoad,
          cloudNode
        );
        const isCloud = assignedNodeId === cloudNode.id;

        if (isCloud) {
          scheduled.push({
            ...task,
            status: 'processing' as const,
            assignedTo: assignedNodeId,
          });
          continue;
        }

        const node = fogNodes.find((n) => n.id === assignedNodeId);
        const load = loadMap.get(assignedNodeId);
        if (node && load && canAssignToFog(task, node, load)) {
          scheduled.push({
            ...task,
            status: 'processing' as const,
            assignedTo: assignedNodeId,
          });
          load.cpu += task.cpuRequirement;
          load.memory += task.memoryRequirement;
          const refreshed = nodesWithLoad.find((n) => n.id === assignedNodeId);
          if (refreshed) {
            refreshed.currentCpu = load.cpu;
            refreshed.currentMemory = load.memory;
          }
        } else {
          // All fog nodes busy — keep pending instead of forcing assignment/failure
          scheduled.push(task);
        }
      }

      return [...otherTasks, ...scheduled];
    });
  }, [fogNodes, cloudNode]);

  const rescheduleFailedTasks = useCallback(() => {
    setTasks((prevTasks) => {
      const hasFailed = prevTasks.some((t) => t.status === 'failed');
      if (!hasFailed) return prevTasks;
      return prevTasks.map(rescheduleFailedTask);
    });
  }, []);

  const processTasks = useCallback(() => {
    setTasks((prevTasks) => {
      return prevTasks.map((task) => {
        if (task.status !== 'processing') return task;

        // Overloaded fog node — fail now; rescheduled on the next tick
        if (task.assignedTo && task.assignedTo !== cloudNode.id) {
          const node = fogNodes.find((n) => n.id === task.assignedTo);
          if (node && isNodeOverloaded(prevTasks, node)) {
            return { ...task, status: 'failed' as const, completedAt: Date.now() };
          }
        }

        const completionChance = useDatasetMode ? 0.4 : 0.2;
        if (Math.random() < completionChance) {
          const processingTime = Date.now() - task.createdAt;
          return {
            ...task,
            status: 'completed' as const,
            completedAt: Date.now(),
            actualLatency: processingTime,
            energyConsumed:
              (task.cpuRequirement * 0.5 + task.memoryRequirement * 0.1) *
              (processingTime / 1000),
          };
        }

        return task;
      });
    });
  }, [useDatasetMode, fogNodes, cloudNode]);

  const updateNodeStates = useCallback(() => {
    setFogNodes(prevNodes => {
      return prevNodes.map(node => {
        const processingTasks = tasks.filter(
          task => task.assignedTo === node.id && task.status === 'processing'
        );
        
        const currentCpu = processingTasks.reduce((sum, task) => sum + task.cpuRequirement, 0);
        const currentMemory = processingTasks.reduce((sum, task) => sum + task.memoryRequirement, 0);
        const energyConsumption = currentCpu * 0.5 + currentMemory * 0.1;

        return {
          ...node,
          currentCpu: Math.min(currentCpu, node.maxCpu),
          currentMemory: Math.min(currentMemory, node.maxMemory),
          energyConsumption,
          processingTasks
        };
      });
    });

    setCloudNode(prevCloud => ({
      ...prevCloud,
      processingTasks: tasks.filter(
        task => task.assignedTo === prevCloud.id && task.status === 'processing'
      )
    }));
  }, [tasks]);

  const calculateMetrics = useCallback(() => {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const failedTasks = tasks.filter(task => task.status === 'failed');
    const processingTasks = tasks.filter(task => task.status === 'processing');
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    
    // Calculate average latency from completed tasks
    // If no completed tasks yet, use expected latency from processing tasks
    let avgLatency = 0;
    if (completedTasks.length > 0) {
      avgLatency = completedTasks.reduce((sum, task) => sum + (task.actualLatency || task.expectedLatency || 0), 0) / completedTasks.length;
    } else if (processingTasks.length > 0) {
      // Show expected latency for processing tasks
      avgLatency = processingTasks.reduce((sum, task) => sum + (task.expectedLatency || 0), 0) / processingTasks.length;
    }

    // Calculate total energy consumed
    const totalEnergyConsumed = fogNodes.reduce((sum, node) => sum + node.energyConsumption, 0);
    
    // Calculate fog utilization
    const totalFogCapacity = fogNodes.reduce((sum, node) => sum + node.maxCpu, 0);
    const totalFogUsage = fogNodes.reduce((sum, node) => sum + node.currentCpu, 0);
    const fogUtilization = totalFogCapacity > 0 ? (totalFogUsage / totalFogCapacity) * 100 : 0;

    // Calculate cloud offload rate
    const cloudTasks = tasks.filter(task => task.assignedTo === cloudNode.id);
    const cloudOffloadRate = tasks.length > 0 ? (cloudTasks.length / tasks.length) * 100 : 0;

    // Calculate completion rate
    const completionRate = tasks.length > 0 
      ? ((completedTasks.length / tasks.length) * 100) 
      : 0;

    const newMetrics = {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgLatency: Math.round(avgLatency * 10) / 10, // Round to 1 decimal
      totalEnergyConsumed: Math.round(totalEnergyConsumed * 10) / 10,
      fogUtilization: Math.round(fogUtilization * 10) / 10,
      cloudOffloadRate: Math.round(cloudOffloadRate * 10) / 10
    };

    // Always log to help debug
    if (tasks.length > 0 || newMetrics.totalTasks !== metrics.totalTasks) {
      console.log('[CalculateMetrics]', {
        totalTasks: tasks.length,
        pending: pendingTasks.length,
        processing: processingTasks.length,
        completed: completedTasks.length,
        failed: failedTasks.length,
        metrics: newMetrics
      });
    }

    setMetrics(newMetrics);

    // Update performance data
    setPerformanceData(prevData => {
      const newDataPoint = {
        timestamp: Date.now(),
        latency: avgLatency,
        energy: totalEnergyConsumed,
        utilization: fogUtilization
      };
      
      const updatedData = [...prevData, newDataPoint];
      return updatedData.slice(-50); // Keep last 50 data points
    });
  }, [tasks, fogNodes, cloudNode, metrics.totalTasks]);

  const simulationLoop = useCallback(() => {
    generateTasks();
    rescheduleFailedTasks();
    scheduleTasks();
    processTasks();
    updateNodeStates();
    calculateMetrics();
  }, [generateTasks, rescheduleFailedTasks, scheduleTasks, processTasks, updateNodeStates, calculateMetrics]);

  // Keep the interval pointed at the freshest loop so each tick runs against
  // current state (fixes frozen metrics + fog node status).
  const loopRef = useRef(simulationLoop);
  useEffect(() => {
    loopRef.current = simulationLoop;
  }, [simulationLoop]);

  const startSimulation = () => {
    console.log('[StartSimulation] Starting simulation...', {
      useDatasetMode,
      datasetTasksLength: datasetTasks.length,
      datasetIndex
    });
    setIsRunning(true);
    // Run immediately once, then set interval. Call through loopRef so the
    // interval always invokes the latest loop (current state), not a stale one.
    loopRef.current();
    intervalRef.current = setInterval(() => loopRef.current(), 1000); // Run every second
    console.log('[StartSimulation] Simulation started, interval set');
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const resetSimulation = () => {
    stopSimulation();
    setTasks([]);
    setFogNodes(buildFogNodes(appliedRecordCountRef.current));
    setCloudNode(INITIAL_CLOUD_NODE);
    setMetrics({
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgLatency: 0,
      totalEnergyConsumed: 0,
      fogUtilization: 0,
      cloudOffloadRate: 0
    });
    setPerformanceData([]);
    setDatasetIndex(0); // Reset dataset index
  };

  const changeStrategy = (strategy: SchedulingStrategy) => {
    setCurrentStrategy(strategy);
  };

  const loadDataset = (tasks: Task[]) => {
    console.log('[LoadDataset] Loading dataset:', tasks.length, 'tasks');
    if (tasks.length === 0) {
      console.warn('[LoadDataset] Warning: Empty dataset provided!');
      return;
    }
    setDatasetTasks(tasks);
    setDatasetIndex(0);
    setUseDatasetMode(true);
    // Reset simulation state when loading new dataset
    setTasks([]);
    setMetrics({
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgLatency: 0,
      totalEnergyConsumed: 0,
      fogUtilization: 0,
      cloudOffloadRate: 0
    });
    console.log('[LoadDataset] Dataset loaded, dataset mode enabled, simulation reset');
  };

  const applyRecordCount = (count: number) => {
    const nodeCount = Math.max(count, DEFAULT_NODE_RECORD_COUNT);
    appliedRecordCountRef.current = nodeCount;
    setFogNodes(buildFogNodes(nodeCount));
  };

  const toggleDatasetMode = (enabled: boolean) => {
    setUseDatasetMode(enabled);
    if (enabled) {
      setDatasetIndex(0);
    }
  };

  // Ensure metrics are calculated whenever tasks change
  useEffect(() => {
    // Recalculate metrics when tasks array changes
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const failedTasks = tasks.filter(task => task.status === 'failed');
    const processingTasks = tasks.filter(task => task.status === 'processing');
    
    const avgLatency = completedTasks.length > 0
      ? completedTasks.reduce((sum, task) => sum + (task.actualLatency || task.expectedLatency || 0), 0) / completedTasks.length
      : processingTasks.length > 0
      ? processingTasks.reduce((sum, task) => sum + (task.expectedLatency || 0), 0) / processingTasks.length
      : 0;

    const totalEnergyConsumed = fogNodes.reduce((sum, node) => sum + node.energyConsumption, 0);
    const totalFogCapacity = fogNodes.reduce((sum, node) => sum + node.maxCpu, 0);
    const totalFogUsage = fogNodes.reduce((sum, node) => sum + node.currentCpu, 0);
    const fogUtilization = totalFogCapacity > 0 ? (totalFogUsage / totalFogCapacity) * 100 : 0;
    const cloudTasks = tasks.filter(task => task.assignedTo === cloudNode.id);
    const cloudOffloadRate = tasks.length > 0 ? (cloudTasks.length / tasks.length) * 100 : 0;

    setMetrics({
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgLatency: Math.round(avgLatency * 10) / 10,
      totalEnergyConsumed: Math.round(totalEnergyConsumed * 10) / 10,
      fogUtilization: Math.round(fogUtilization * 10) / 10,
      cloudOffloadRate: Math.round(cloudOffloadRate * 10) / 10
    });
  }, [tasks, fogNodes, cloudNode]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const processingTasks = tasks.filter(task => task.status === 'processing');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  return {
    isRunning,
    currentStrategy,
    schedulingStrategies: SCHEDULING_STRATEGIES,
    iotDevices,
    fogNodes,
    cloudNode,
    tasks,
    pendingTasks,
    processingTasks,
    completedTasks,
    metrics,
    performanceData,
    startSimulation,
    stopSimulation,
    resetSimulation,
    changeStrategy,
    // Dataset mode
    useDatasetMode,
    datasetTasks,
    datasetProgress: datasetTasks.length > 0 ? Math.min(100, (datasetIndex / datasetTasks.length) * 100) : 0,
    loadDataset,
    applyRecordCount,
    toggleDatasetMode
  };
};