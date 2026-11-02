import React, { useState } from 'react';
import { Upload, Database, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { loadDatasetAsTasks, generateSyntheticDatasetFromPattern, convertCSVToTasks } from '../utils/dataLoader';
import { Task } from '../types';
import { importDataset, ApiError, type DatasetRow } from '../api/client';

interface DatasetLoaderProps {
  onTasksLoaded: (tasks: Task[]) => void;
  onStatsUpdate: (stats: DatasetStats) => void;
}

interface DatasetStats {
  total: number;
  healthcare: number;
  traffic: number;
  industrial: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export const DatasetLoader: React.FC<DatasetLoaderProps> = ({ onTasksLoaded, onStatsUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'sample' | 'synthetic' | 'file'>('sample');
  const [persistNote, setPersistNote] = useState<string | null>(null);

  const persist = async (source: string, tasks: Task[]) => {
    const rows: DatasetRow[] = tasks.map((t) => ({
      timestamp: new Date(t.createdAt).toISOString(),
      device_type: t.type,
      priority: t.priority,
      cpu: t.cpuRequirement,
      memory: t.memoryRequirement,
      latency: t.expectedLatency,
      sensor_id: t.deviceId,
    }));
    try {
      const { batch } = await importDataset(source, rows);
      setPersistNote(`Saved to database: ${batch.rowsStored} stored, ${batch.duplicatesRemoved} duplicates removed, ${batch.rowsInvalid} invalid.`);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 503
        ? 'Database offline — running in demo mode (data not saved).'
        : 'Could not save to database — running in demo mode.';
      setPersistNote(msg);
    }
  };

  const calculateStats = (tasks: Task[]): DatasetStats => {
    return {
      total: tasks.length,
      healthcare: tasks.filter(t => t.type === 'healthcare').length,
      traffic: tasks.filter(t => t.type === 'traffic').length,
      industrial: tasks.filter(t => t.type === 'industrial').length,
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };
  };

  const handleLoadSample = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPersistNote(null);

    try {
      const tasks = await loadDatasetAsTasks('/data/sample_dataset.csv', 'csv');
      const stats = calculateStats(tasks);
      
      onTasksLoaded(tasks);
      onStatsUpdate(stats);
      await persist('sample', tasks);
      setSuccess(`Loaded ${tasks.length} tasks from sample dataset`);
    } catch (err) {
      setError('Failed to load sample dataset');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSynthetic = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPersistNote(null);

    try {
      const healthcare = generateSyntheticDatasetFromPattern('healthcare', 50);
      const traffic = generateSyntheticDatasetFromPattern('traffic', 50);
      const industrial = generateSyntheticDatasetFromPattern('industrial', 50);
      
      const allData = [...healthcare, ...traffic, ...industrial];
      const tasks = convertCSVToTasks(allData);
      const stats = calculateStats(tasks);
      
      onTasksLoaded(tasks);
      onStatsUpdate(stats);
      await persist('synthetic', tasks);
      setSuccess(`Generated ${tasks.length} synthetic tasks`);
    } catch (err) {
      setError('Failed to generate synthetic data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setPersistNote(null);

    try {
      const text = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension !== 'csv') {
        throw new Error('Only CSV files are supported');
      }

      // Parse CSV
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue;
        
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index].trim();
        });
        
        data.push({
          timestamp: row.timestamp || '',
          device_type: row.device_type || row.devicetype || 'healthcare',
          priority: row.priority || 'medium',
          cpu: parseFloat(row.cpu || row.cpu_requirement || '0'),
          memory: parseFloat(row.memory || row.memory_requirement || '0'),
          latency: parseFloat(row.latency || row.latency_requirement || '0'),
        });
      }

      const tasks = convertCSVToTasks(data);
      const stats = calculateStats(tasks);
      
      onTasksLoaded(tasks);
      onStatsUpdate(stats);
      await persist('upload', tasks);
      setSuccess(`Loaded ${tasks.length} tasks from uploaded file`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Database className="w-6 h-6 text-blue-400" />
        <div>
          <h3 className="text-xl font-bold text-white">Dataset Loader</h3>
          <p className="text-gray-400 text-sm">Load real or synthetic datasets to run simulations</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400">{success}</span>
        </div>
      )}

      {persistNote && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm text-blue-300">
          {persistNote}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sample Dataset */}
        <button
          onClick={handleLoadSample}
          disabled={loading}
          className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-center mb-3">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <h4 className="font-semibold text-white mb-2">Sample Dataset</h4>
          <p className="text-gray-400 text-sm">
            Load pre-configured sample data (30 tasks across all device types)
          </p>
        </button>

        {/* Synthetic Dataset */}
        <button
          onClick={handleLoadSynthetic}
          disabled={loading}
          className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-center mb-3">
            <Database className="w-8 h-8 text-green-400" />
          </div>
          <h4 className="font-semibold text-white mb-2">Generate Synthetic Data</h4>
          <p className="text-gray-400 text-sm">
            Create realistic synthetic dataset (150 tasks)
          </p>
        </button>

        {/* File Upload */}
        <label className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-all cursor-pointer">
          <div className="flex items-center justify-center mb-3">
            <Upload className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="font-semibold text-white mb-2">Upload CSV File</h4>
          <p className="text-gray-400 text-sm mb-2">
            Load your own dataset file
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
          <span className="text-xs text-gray-500">CSV format only</span>
        </label>
      </div>

      {loading && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-blue-400">
          <Loader className="w-5 h-5 animate-spin" />
          <span>Loading dataset...</span>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
        <p className="text-sm text-gray-400">
          <strong>CSV Format:</strong> timestamp,device_type,priority,cpu,memory,latency
        </p>
      </div>
    </div>
  );
};

