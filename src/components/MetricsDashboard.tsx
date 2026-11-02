import React from 'react';
import { Metrics } from '../types';
import { TrendingUp, Zap, Clock, Server, Cloud, CheckCircle, XCircle } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: Metrics;
  className?: string;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics, className = '' }) => {
  const completionRate = metrics.totalTasks > 0 ? (metrics.completedTasks / metrics.totalTasks) * 100 : 0;

  const formatNumber = (num: number, decimals = 1) => {
    if (isNaN(num) || !isFinite(num)) return '0.0';
    return num.toFixed(decimals);
  };

  const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Only show cards with non-zero values (except Total Tasks which should always show if > 0)
  const shouldShowCard = (value: number, alwaysShow: boolean = false) => {
    return alwaysShow || value > 0;
  };

  const cards = [];

  // Total Tasks - Always show if > 0
  if (shouldShowCard(metrics.totalTasks, true)) {
    cards.push(
      <div key="total-tasks" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Total Tasks</p>
            <p className="text-2xl font-bold text-white">{metrics.totalTasks}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-blue-400" />
        </div>
      </div>
    );
  }

  // Completed Tasks
  if (shouldShowCard(metrics.completedTasks)) {
    cards.push(
      <div key="completed-tasks" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400">{metrics.completedTasks}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
      </div>
    );
  }

  // Failed Tasks (rescheduled automatically when nodes recover)
  if (shouldShowCard(metrics.failedTasks)) {
    cards.push(
      <div key="failed-tasks" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Failed (awaiting retry)</p>
            <p className="text-2xl font-bold text-red-400">{metrics.failedTasks}</p>
          </div>
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
      </div>
    );
  }

  // Completion Rate - Only show if there are tasks
  if (shouldShowCard(metrics.totalTasks)) {
    cards.push(
      <div key="completion-rate" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Completion Rate</p>
            <p className={`text-2xl font-bold ${getMetricColor(completionRate, { good: 90, warning: 70 })}`}>
              {formatNumber(completionRate)}%
            </p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
      </div>
    );
  }

  // Average Latency - Only show if > 0
  if (shouldShowCard(metrics.avgLatency)) {
    cards.push(
      <div key="avg-latency" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Avg Latency</p>
            <p className={`text-2xl font-bold ${getMetricColor(200 - metrics.avgLatency, { good: 100, warning: 50 })}`}>
              {formatNumber(metrics.avgLatency)}ms
            </p>
          </div>
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>
      </div>
    );
  }

  // Energy Consumption - Only show if > 0
  if (shouldShowCard(metrics.totalEnergyConsumed)) {
    cards.push(
      <div key="energy" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Energy Used</p>
            <p className="text-2xl font-bold text-orange-400">
              {formatNumber(metrics.totalEnergyConsumed)}kW
            </p>
          </div>
          <Zap className="w-8 h-8 text-orange-400" />
        </div>
      </div>
    );
  }

  // Fog Utilization - Only show if > 0
  if (shouldShowCard(metrics.fogUtilization)) {
    cards.push(
      <div key="fog-utilization" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Fog Utilization</p>
            <p className={`text-2xl font-bold ${getMetricColor(metrics.fogUtilization, { good: 60, warning: 30 })}`}>
              {formatNumber(metrics.fogUtilization)}%
            </p>
          </div>
          <Server className="w-8 h-8 text-purple-400" />
        </div>
      </div>
    );
  }

  // Cloud Offload Rate - Only show if there are tasks
  if (shouldShowCard(metrics.totalTasks)) {
    cards.push(
      <div key="cloud-offload" className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Cloud Offload</p>
            <p className={`text-2xl font-bold ${getMetricColor(100 - metrics.cloudOffloadRate, { good: 70, warning: 40 })}`}>
              {formatNumber(metrics.cloudOffloadRate)}%
            </p>
          </div>
          <Cloud className="w-8 h-8 text-blue-400" />
        </div>
      </div>
    );
  }

  // If no cards to show, return empty or a message
  if (cards.length === 0) {
    return (
      <div className={`bg-gray-800 p-6 rounded-lg border border-gray-700 text-center ${className}`}>
        <p className="text-gray-400">No metrics available. Start the simulation to see performance data.</p>
      </div>
    );
  }

  // Dynamic grid columns based on number of cards
  const gridCols = cards.length <= 2 ? 'grid-cols-2' : 
                   cards.length <= 3 ? 'md:grid-cols-3' : 
                   cards.length <= 4 ? 'md:grid-cols-4' : 
                   cards.length <= 5 ? 'md:grid-cols-5' : 
                   'md:grid-cols-6';

  return (
    <div className={`grid grid-cols-2 ${gridCols} gap-4 tabular-nums ${className}`}>
      {cards}
    </div>
  );
};
