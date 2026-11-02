import { Task } from '../types';

export interface CSVDataRow {
  timestamp: string;
  device_type: string;
  priority: string;
  cpu: number;
  memory: number;
  latency: number;
  sensor_id?: string;
}

export interface JSONDatasetRow {
  id?: string;
  timestamp: string | number;
  device_type: 'healthcare' | 'traffic' | 'industrial';
  priority: 'low' | 'medium' | 'high' | 'critical';
  cpu_requirement: number;
  memory_requirement: number;
  latency_requirement: number;
  sensor_id?: string;
}

/**
 * Bean CSV data from a local file or URL
 * @param filePath - Path to CSV file or URL
 * @returns Parsed CSV data as array of objects
 */
export const loadCSVDataset = async (filePath: string): Promise<CSVDataRow[]> => {
  try {
    const response = await fetch(filePath);
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.warn('CSV file appears to be empty or has no data rows');
      return [];
    }
    
    // Parse header
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Parse data rows
    const data: CSVDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== headers.length) continue;
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index].trim();
      });
      
      // Convert numeric fields
      data.push({
        timestamp: row.timestamp || '',
        device_type: row.device_type || row.deviceType || 'healthcare',
        priority: row.priority || 'medium',
        cpu: parseFloat(row.cpu || row.cpu_requirement || '0'),
        memory: parseFloat(row.memory || row.memory_requirement || '0'),
        latency: parseFloat(row.latency || row.latency_requirement || '0'),
        sensor_id: row.sensor_id || row.sensorId
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error loading CSV dataset:', error);
    return [];
  }
};

/**
 * Load JSON data from a local file or URL
 * @param filePath - Path to JSON file or URL
 * @returns Parsed JSON data
 */
export const loadJSONDataset = async (filePath: string): Promise<JSONDatasetRow[]> => {
  try {
    const response = await fetch(filePath);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading JSON dataset:', error);
    return [];
  }
};

/**
 * Convert CSV simplified tasks to Task objects
 * @param csvData - Parsed CSV data
 * @returns Array of Task objects
 */
export const convertCSVToTasks = (csvData: CSVDataRow[]): Task[] => {
  return csvData.map((row, index) => ({
    id: `task_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    deviceId: row.sensor_id || `device_${row.device_type}_${index}`,
    type: row.device_type as 'healthcare' | 'traffic' | 'industrial',
    priority: row.priority as 'low' | 'medium' | 'high' | 'critical',
    cpuRequirement: row.cpu,
    memoryRequirement: row.memory,
    expectedLatency: row.latency,
    createdAt: Date.now(),
    status: 'pending'
  }));
};

/**
 * Convert JSON dataset to Task objects
 * @param jsonData - Parsed JSON data
 * @returns Array of Task objects
 */
export const convertJSONToTasks = (jsonData: JSONDatasetRow[]): Task[] => {
  return jsonData.map((row, index) => ({
    id: row.id || `task_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    deviceId: row.sensor_id || `device_${row.device_type}_${index}`,
    type: row.device_type,
    priority: row.priority,
    cpuRequirement: row.cpu_requirement,
    memoryRequirement: row.memory_requirement,
    expectedLatency: row.latency_requirement,
    createdAt: typeof row.timestamp === 'string' ? new Date(row.timestamp).getTime() : row.timestamp,
    status: 'pending'
  }));
};

/**
 * Load and convert dataset to tasks (handles both CSV and JSON)
 * @param filePath - Path to dataset file
 * @param format - File format ('csv' or 'json')
 * @returns Array of Task objects
 */
export const loadDatasetAsTasks = async (
  filePath: string, 
  format: 'csv' | 'json' = 'csv'
): Promise<Task[]> => {
  if (format === 'json') {
    const jsonData = await loadJSONDataset(filePath);
    return convertJSONToTasks(jsonData);
  } else {
    const csvData = await loadCSVDataset(filePath);
    return convertCSVToTasks(csvData);
  }
};

/**
 * Generate synthetic dataset based on real data patterns
 * This is useful for demonstrations when you don't have access to full datasets
 */
export const generateSyntheticDatasetFromPattern = (
  deviceType: 'healthcare' | 'traffic' | 'industrial',
  count: number
): CSVDataRow[] => {
  const patterns = {
    healthcare: {
      priorities: { critical: 0.3, high: 0.4, medium: 0.2, low: 0.1 },
      cpuRange: [20, 60],
      memoryRange: [15, 40],
      latencyRange: [50, 200]
    },
    traffic: {
      priorities: { critical: 0.1, high: 0.4, medium: 0.3, low: 0.2 },
      cpuRange: [10, 40],
      memoryRange: [10, 30],
      latencyRange: [20, 100]
    },
    industrial: {
      priorities: { critical: 0.1, high: 0.2, medium: 0.4, low: 0.3 },
      cpuRange: [30, 80],
      memoryRange: [25, 60],
      latencyRange: [100, 500]
    }
  };

  const pattern = patterns[deviceType];
  const data: CSVDataRow[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    const priority = weightedRandom(pattern.priorities);
    const cpu = randomBetween(pattern.cpuRange[0], pattern.cpuRange[1]);
    const memory = randomBetween(pattern.memoryRange[0], pattern.memoryRange[1]);
    const latency = randomBetween(pattern.latencyRange[0], pattern.latencyRange[1]);

    data.push({
      timestamp: new Date(baseTime + i * 1000).toISOString(),
      device_type: deviceType,
      priority,
      cpu,
      memory,
      latency,
      sensor_id: `sensor_${deviceType}_${i}`
    });
  }

  return data;
};

/**
 * Helper function for weighted random selection
 */
function weightedRandom(weights: { [key: string]: number }): string {
  const random = Math.random();
  let sum = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    sum += weight;
    if (random <= sum) return key;
  }
  
  return Object.keys(weights)[0];
}

/**
 * Helper function to generate random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Export dataset to CSV format for sharing
 */
export const exportTasksToCSV = (tasks: Task[]): string => {
  const headers = 'timestamp,device_type,priority,cpu,memory,latency,status\n';
  const rows = tasks.map(task => {
    const timestamp = new Date(task.createdAt).toISOString();
    return `${timestamp},${task.type},${task.priority},${task.cpuRequirement},${task.memoryRequirement},${task.expectedLatency},${task.status}`;
  });
  return headers + rows.join('\n');
};

/**
 * Download dataset as CSV file
 */
export const downloadDatasetAsCSV = (tasks: Task[], filename: string = 'dataset.csv') => {
  const csv = exportTasksToCSV(tasks);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

