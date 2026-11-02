import React, { useState } from 'react';
import { Eye, EyeOff, FileText, Activity, Factory, Zap, TrendingUp, Settings, Target } from 'lucide-react';
import { Task } from '../types';

interface DatasetViewerProps {
  tasks: Task[];
  stats: {
    total: number;
    healthcare: number;
    traffic: number;
    industrial: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const DatasetViewer: React.FC<DatasetViewerProps> = ({ tasks, stats }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'healthcare' | 'traffic' | 'industrial'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const filteredTasks = tasks.filter(task => {
    const typeMatch = filterType === 'all' || task.type === filterType;
    const priorityMatch = filterPriority === 'all' || task.priority === filterPriority;
    return typeMatch && priorityMatch;
  });

  const displayedTasks = isExpanded ? filteredTasks : filteredTasks.slice(0, 10);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 tabular-nums">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Eye className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Dataset Viewer</h3>
            <p className="text-gray-400 text-sm">
              {stats.total} tasks loaded • Showing {displayedTasks.length} {filteredTasks.length !== displayedTasks.length ? `of ${filteredTasks.length}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all flex items-center space-x-2"
        >
          {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
        </button>
      </div>

      {/* Statistics Cards - Only show cards with values > 0 */}
      {(() => {
        const cards = [];
        
        if (stats.healthcare > 0) {
          cards.push(
            <div key="healthcare" className="bg-red-900/20 border border-red-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Activity className="w-4 h-4 text-red-400" />
            <span className="text-sm text-gray-400">Healthcare</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.healthcare}</p>
        </div>
          );
        }
        
        if (stats.traffic > 0) {
          cards.push(
            <div key="traffic" className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-400">Traffic</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.traffic}</p>
        </div>
          );
        }
        
        if (stats.industrial > 0) {
          cards.push(
            <div key="industrial" className="bg-blue-900/20 border border-blue-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Factory className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Industrial</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.industrial}</p>
        </div>
          );
        }
        
        if (stats.critical > 0) {
          cards.push(
            <div key="critical" className="bg-purple-900/20 border border-purple-700/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">Critical</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{stats.critical}</p>
        </div>
          );
        }
        
        if (stats.high > 0) {
          cards.push(
            <div key="high" className="bg-orange-900/20 border border-orange-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-400">High</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">{stats.high}</p>
            </div>
          );
        }
        
        if (stats.medium > 0) {
          cards.push(
            <div key="medium" className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Settings className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Medium</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{stats.medium}</p>
            </div>
          );
        }
        
        if (stats.low > 0) {
          cards.push(
            <div key="low" className="bg-green-900/20 border border-green-700/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <FileText className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Low</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{stats.low}</p>
      </div>
          );
        }
        
        if (cards.length === 0) {
          return null;
        }
        
        // Dynamic grid based on number of cards
        const gridCols = cards.length <= 2 ? 'grid-cols-2' : 
                         cards.length <= 3 ? 'md:grid-cols-3' : 
                         cards.length <= 4 ? 'md:grid-cols-4' : 
                         'md:grid-cols-4';
        
        return (
          <div className={`grid grid-cols-2 ${gridCols} gap-3 mb-4`}>
            {cards}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Device Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="healthcare">Healthcare</option>
            <option value="traffic">Traffic</option>
            <option value="industrial">Industrial</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Priority</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {displayedTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tasks match the current filter</p>
          </div>
        ) : (
          displayedTasks.map((task, index) => {
            const getPriorityColor = (priority: string) => {
              switch (priority) {
                case 'critical': return 'text-red-400 bg-red-900/20 border-red-700/50';
                case 'high': return 'text-orange-400 bg-orange-900/20 border-orange-700/50';
                case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50';
                case 'low': return 'text-green-400 bg-green-900/20 border-green-700/50';
                default: return 'text-gray-400 bg-gray-900/20 border-gray-700/50';
              }
            };

            const getTypeIcon = (type: string) => {
              switch (type) {
                case 'healthcare': return <Activity className="w-4 h-4 text-red-400" />;
                case 'traffic': return <Zap className="w-4 h-4 text-yellow-400" />;
                case 'industrial': return <Factory className="w-4 h-4 text-blue-400" />;
                default: return <FileText className="w-4 h-4 text-gray-400" />;
              }
            };

            return (
              <div
                key={task.id}
                className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 flex items-center space-x-3 hover:bg-gray-700 transition-colors"
              >
                <div className="flex-shrink-0">
                  {getTypeIcon(task.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {task.type.charAt(0).toUpperCase() + task.type.slice(1)} Task #{index + 1}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>CPU: {task.cpuRequirement}%</span>
                    <span>Mem: {task.memoryRequirement}MB</span>
                    <span>Latency: {task.expectedLatency}ms</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredTasks.length > displayedTasks.length && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          Showing {displayedTasks.length} of {filteredTasks.length} tasks
        </div>
      )}
    </div>
  );
};

