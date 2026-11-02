import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { loadDatasetAsTasks, generateSyntheticDatasetFromPattern, convertCSVToTasks } from '../utils/dataLoader';

interface UseRealDataSimulationProps {
  dataSource: 'sample' | 'synthetic' | 'file';
  filePath?: string;
  autoPlay?: boolean;
  playbackSpeed?: number; // milliseconds between tasks
}

/**
 * Hook for running simulation with real or synthetic datasets
 * 
 * @example
 * ```tsx
 * const { realDataTasks, loadNextTask, isComplete } = useRealDataSimulation({
 *   dataSource: 'sample',
 *   autoPlay: true,
 *   playbackSpeed: 1000
 * });
 * ```
 */
export const useRealDataSimulation = ({
  dataSource,
  filePath = '/data/sample_dataset.csv',
  autoPlay = false,
  playbackSpeed = 1000
}: UseRealDataSimulationProps) => {
  const [realDataTasks, setRealDataTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loadedTasks, setLoadedTasks] = useState<Task[]>([]);

  // Load dataset based on source
  useEffect(() => {
    const loadDataset = async () => {
      setIsLoading(true);
      try {
        let tasks: Task[] = [];

        switch (dataSource) {
          case 'sample':
            tasks = await loadDatasetAsTasks(filePath, 'csv');
            break;
          
          case 'synthetic':
            // Generate synthetic data for each device type
            const healthcare = generateSyntheticDatasetFromPattern('healthcare', 50);
            const traffic = generateSyntheticDatasetFromPattern('traffic', 50);
            const industrial = generateSyntheticDatasetFromPattern('industrial', 50);
            
            const allSynthetic = [...healthcare, ...traffic, ...industrial];
            // Sort by timestamp if available
            allSynthetic.sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              return timeA - timeB;
            });
            
            tasks = convertCSVToTasks(allSynthetic);
            break;
          
          case 'file':
            if (filePath) {
              const extension = filePath.split('.').pop()?.toLowerCase();
              tasks = await loadDatasetAsTasks(filePath, extension === 'json' ? 'json' : 'csv');
            }
            break;
        }

        setLoadedTasks(tasks);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading dataset:', error);
        setIsLoading(false);
      }
    };

    loadDataset();
  }, [dataSource, filePath]);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || isComplete || loadedTasks.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= loadedTasks.length) {
          setIsComplete(true);
          clearInterval(interval);
          return prev;
        }
        return next;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [autoPlay, loadedTasks.length, playbackSpeed, isComplete]);

  // Get current task
  const currentTask = loadedTasks[currentIndex];
  
  // Get all tasks up to current index
  const displayedTasks = loadedTasks.slice(0, currentIndex + 1);

  // Manually load next task
  const loadNextTask = useCallback(() => {
    if (currentIndex < loadedTasks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentIndex, loadedTasks.length]);

  // Reset to beginning
  const resetSimulation = useCallback(() => {
    setCurrentIndex(0);
    setIsComplete(false);
    setRealDataTasks([]);
  }, []);

  // Jump to specific index
  const jumpToIndex = useCallback((index: number) => {
    if (index >= 0 && index < loadedTasks.length) {
      setCurrentIndex(index);
      setIsComplete(index >= loadedTasks.length - 1);
    }
  }, [loadedTasks.length]);

  // Get progress percentage
  const progress = loadedTasks.length > 0 
    ? (currentIndex / loadedTasks.length) * 100 
    : 0;

  // Get statistics about loaded dataset
  const datasetStats = {
    total: loadedTasks.length,
    healthcare: loadedTasks.filter(t => t.type === 'healthcare').length,
    traffic: loadedTasks.filter(t => t.type === 'traffic').length,
    industrial: loadedTasks.filter(t => t.type === 'industrial').length,
    critical: loadedTasks.filter(t => t.priority === 'critical').length,
    high: loadedTasks.filter(t => t.priority === 'high').length,
    medium: loadedTasks.filter(t => t.priority === 'medium').length,
    low: loadedTasks.filter(t => t.priority === 'low').length,
  };

  return {
    // Data
    realDataTasks: displayedTasks,
    loadedTasks,
    currentTask,
    
    // State
    isLoading,
    isComplete,
    currentIndex,
    progress,
    datasetStats,
    
    // Controls
    loadNextTask,
    resetSimulation,
    jumpToIndex,
    setRealDataTasks
  };
};

export default useRealDataSimulation;

