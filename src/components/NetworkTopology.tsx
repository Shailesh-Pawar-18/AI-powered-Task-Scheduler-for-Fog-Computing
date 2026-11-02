import React from 'react';
import { IoTDevice, FogNode, CloudNode, Task } from '../types';
import { Cpu, Cloud, Smartphone, Activity, Zap, Factory } from 'lucide-react';

interface NetworkTopologyProps {
  iotDevices: IoTDevice[];
  fogNodes: FogNode[];
  cloudNode: CloudNode;
  tasks: Task[];
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  iotDevices,
  fogNodes,
  cloudNode,
  tasks
}) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'healthcare': return <Activity className="w-4 h-4" />;
      case 'traffic': return <Zap className="w-4 h-4" />;
      case 'industrial': return <Factory className="w-4 h-4" />;
      default: return <Smartphone className="w-4 h-4" />;
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-red-500';
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 80) return 'bg-red-500';
    if (utilization > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="relative w-full h-96 bg-gray-900 rounded-lg p-4 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>
      
      {/* IoT Devices */}
      {iotDevices.map((device) => (
        <div
          key={device.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${device.position.x}%`, top: `${device.position.y}%` }}
        >
          <div className="flex flex-col items-center">
            <div className={`p-2 rounded-lg ${getStatusColor(device.isActive)} text-white relative`}>
              {getDeviceIcon(device.type)}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            </div>
            <span className="text-xs text-gray-300 mt-1">{device.name}</span>
          </div>
        </div>
      ))}

      {/* Fog Nodes */}
      {fogNodes.map((node) => {
        const cpuUtilization = (node.currentCpu / node.maxCpu) * 100;
        return (
          <div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
          >
            <div className="flex flex-col items-center">
              <div className={`p-3 rounded-lg ${getStatusColor(node.isActive)} text-white relative`}>
                <Cpu className="w-6 h-6" />
                <div className="absolute -bottom-1 left-0 w-full h-1 bg-gray-600 rounded">
                  <div 
                    className={`h-full rounded ${getUtilizationColor(cpuUtilization)}`}
                    style={{ width: `${cpuUtilization}%` }}
                  />
                </div>
                {node.processingTasks.length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {node.processingTasks.length}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-300 mt-1">{node.name}</span>
            </div>
          </div>
        );
      })}

      {/* Cloud Node */}
      <div className="absolute top-4 right-4">
        <div className="flex flex-col items-center">
          <div className="p-4 rounded-lg bg-blue-600 text-white relative">
            <Cloud className="w-8 h-8" />
            {cloudNode.processingTasks.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                {cloudNode.processingTasks.length}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-300 mt-1">{cloudNode.name}</span>
        </div>
      </div>

      {/* Task Flow Animations */}
      {tasks.filter(task => task.status === 'processing').map((task) => {
        const device = iotDevices.find(d => d.id === task.deviceId);
        if (!device) return null;
        
        return (
          <div
            key={task.id}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-pulse"
            style={{
              left: `${device.position.x}%`,
              top: `${device.position.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}
    </div>
  );
};