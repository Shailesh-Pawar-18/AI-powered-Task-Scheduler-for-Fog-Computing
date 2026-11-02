import React from 'react';
import { Task } from '../types';
import { Clock, Zap, CheckCircle, XCircle, Activity, Factory, Smartphone } from 'lucide-react';

interface TaskQueueProps {
  tasks: Task[];
  title: string;
  maxDisplay?: number;
}

export const TaskQueue: React.FC<TaskQueueProps> = ({ tasks, title, maxDisplay = 10 }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'processing': return <Zap className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-500/5';
      case 'high': return 'border-l-orange-500 bg-orange-500/5';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'low': return 'border-l-green-500 bg-green-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'healthcare': return <Activity className="w-4 h-4 text-red-400" />;
      case 'traffic': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'industrial': return <Factory className="w-4 h-4 text-blue-400" />;
      default: return <Smartphone className="w-4 h-4 text-gray-400" />;
    }
  };

  const displayTasks = tasks.slice(0, maxDisplay);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-gray-400">({tasks.length})</span>
        </h3>
      </div>
      
      <div className="max-h-80 overflow-y-auto scrollbar-thin">
        {displayTasks.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No tasks in queue
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-lg border-l-4 ${getPriorityColor(task.priority)} bg-gray-900/50`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-800 shrink-0">{getTypeIcon(task.type)}</span>
                    <span className="text-sm font-medium text-white font-mono">
                      {task.id.slice(-8)}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300 capitalize">
                      {task.priority}
                    </span>
                  </div>
                  {getStatusIcon(task.status)}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                  <div>CPU: {task.cpuRequirement}%</div>
                  <div>RAM: {task.memoryRequirement}MB</div>
                  <div>
                    {task.status === 'completed' && task.actualLatency
                      ? `${task.actualLatency}ms`
                      : `~${task.expectedLatency}ms`
                    }
                  </div>
                </div>
                
                {task.assignedTo && (
                  <div className="mt-2 text-xs text-blue-400">
                    Assigned to: {task.assignedTo}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};