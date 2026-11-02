import { Task, FogNode, CloudNode, SchedulingStrategy } from '../types';
import { modrlSchedule } from './modrl';

export class AIScheduler {
  private strategy: SchedulingStrategy;

  constructor(strategy: SchedulingStrategy) {
    this.strategy = strategy;
  }

  scheduleTask(task: Task, fogNodes: FogNode[], cloudNode: CloudNode): string {
    switch (this.strategy.id) {
      case 'modrl':
        return modrlSchedule(task, fogNodes, cloudNode, (node) => this.canProcessTask(task, node));
      case 'drl_optimized':
        return this.deepReinforcementLearningScheduling(task, fogNodes, cloudNode);
      case 'priority_aware':
        return this.priorityAwareScheduling(task, fogNodes, cloudNode);
      case 'load_balanced':
        return this.loadBalancedScheduling(task, fogNodes, cloudNode);
      case 'energy_efficient':
        return this.energyEfficientScheduling(task, fogNodes, cloudNode);
      default:
        return this.deepReinforcementLearningScheduling(task, fogNodes, cloudNode);
    }
  }

  private deepReinforcementLearningScheduling(task: Task, fogNodes: FogNode[], cloudNode: CloudNode): string {
    // Simplified DRL-inspired scoring system
    const availableNodes = fogNodes.filter(node => node.isActive);
    
    if (availableNodes.length === 0) {
      return cloudNode.id;
    }

    let bestScore = -Infinity;
    let bestNodeId = cloudNode.id;

    // Evaluate fog nodes
    for (const node of availableNodes) {
      if (this.canProcessTask(task, node)) {
        const score = this.calculateDRLScore(task, node);
        if (score > bestScore) {
          bestScore = score;
          bestNodeId = node.id;
        }
      }
    }

    // Consider cloud if no suitable fog node or if cloud is better for low priority tasks
    const cloudScore = this.calculateCloudScore(task);
    if (cloudScore > bestScore) {
      bestNodeId = cloudNode.id;
    }

    return bestNodeId;
  }

  private calculateDRLScore(task: Task, node: FogNode): number {
    const priorityMultiplier = { low: 1, medium: 1.5, high: 2, critical: 3 }[task.priority];
    
    // Resource availability score (0-1)
    const cpuAvailability = (node.maxCpu - node.currentCpu) / node.maxCpu;
    const memoryAvailability = (node.maxMemory - node.currentMemory) / node.maxMemory;
    const resourceScore = (cpuAvailability + memoryAvailability) / 2;
    
    // Distance penalty (closer is better)
    const distanceScore = 1 / (1 + node.distance / 100);
    
    // Energy efficiency score (lower consumption is better)
    const energyScore = 1 / (1 + node.energyConsumption / 100);
    
    // Load balancing score
    const loadScore = 1 - (node.processingTasks.length / 10); // Assume max 10 concurrent tasks
    
    // Combine scores with weights
    return (resourceScore * 0.3 + distanceScore * 0.2 + energyScore * 0.2 + loadScore * 0.3) * priorityMultiplier;
  }

  private calculateCloudScore(task: Task): number {
    // Cloud always has resources but higher latency
    const priorityPenalty = { low: 0.8, medium: 0.6, high: 0.4, critical: 0.1 }[task.priority];
    return 0.7 * priorityPenalty; // Base cloud score adjusted by priority
  }

  private priorityAwareScheduling(task: Task, fogNodes: FogNode[], cloudNode: CloudNode): string {
    const availableNodes = fogNodes.filter(node => node.isActive && this.canProcessTask(task, node));
    
    if (task.priority === 'critical' || task.priority === 'high') {
      // Find the node with lowest latency for high priority tasks
      const bestNode = availableNodes.reduce((best, current) => 
        current.distance < best.distance ? current : best, availableNodes[0]);
      return bestNode ? bestNode.id : cloudNode.id;
    }
    
    return availableNodes.length > 0 ? availableNodes[0].id : cloudNode.id;
  }

  private loadBalancedScheduling(task: Task, fogNodes: FogNode[], cloudNode: CloudNode): string {
    const availableNodes = fogNodes.filter(node => node.isActive && this.canProcessTask(task, node));
    
    if (availableNodes.length === 0) {
      return cloudNode.id;
    }
    
    // Find node with least current load
    const leastLoadedNode = availableNodes.reduce((best, current) =>
      current.processingTasks.length < best.processingTasks.length ? current : best);
    
    return leastLoadedNode.id;
  }

  private energyEfficientScheduling(task: Task, fogNodes: FogNode[], cloudNode: CloudNode): string {
    const availableNodes = fogNodes.filter(node => node.isActive && this.canProcessTask(task, node));
    
    if (availableNodes.length === 0) {
      return cloudNode.id;
    }
    
    // Find node with lowest energy consumption
    const mostEfficientNode = availableNodes.reduce((best, current) =>
      current.energyConsumption < best.energyConsumption ? current : best);
    
    return mostEfficientNode.id;
  }

  private canProcessTask(task: Task, node: FogNode): boolean {
    return (node.currentCpu + task.cpuRequirement <= node.maxCpu) &&
           (node.currentMemory + task.memoryRequirement <= node.maxMemory);
  }
}