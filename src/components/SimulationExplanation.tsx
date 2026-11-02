import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Cpu, Smartphone, Zap, BarChart3, Settings, Database, Activity, Factory } from 'lucide-react';

export const SimulationExplanation: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const Section = ({ id, title, icon, children }: { 
    id: string; 
    title: string; 
    icon: React.ReactNode; 
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="border border-gray-700 rounded-lg mb-4">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {icon}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 text-gray-300 space-y-3">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Brain className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">How the Simulation Works</h2>
          <p className="text-gray-400">Understanding AI-powered task scheduling in fog computing</p>
        </div>
      </div>

      <Section 
        id="overview" 
        title="Simulation Overview" 
        icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
      >
        <p>
          This simulation demonstrates an AI-powered task scheduler for fog computing environments. 
          It shows how intelligent algorithms can efficiently distribute computational tasks from IoT devices 
          across fog nodes and cloud infrastructure to optimize performance, reduce latency, and minimize energy consumption.
        </p>
        <div className="bg-gray-900/50 p-4 rounded-lg mt-3">
          <h4 className="font-semibold text-white mb-2">Key Components:</h4>
          <ul className="space-y-1 text-sm">
            <li>• <strong>IoT Devices:</strong> Generate tasks with different priorities and resource requirements</li>
            <li>• <strong>Fog Nodes:</strong> Edge computing resources with limited CPU, memory, and energy</li>
            <li>• <strong>Cloud Node:</strong> Unlimited resources but higher latency</li>
            <li>• <strong>AI Scheduler:</strong> Makes intelligent decisions about task placement</li>
          </ul>
        </div>
      </Section>

      <Section 
        id="devices" 
        title="IoT Device Types & Task Generation" 
        icon={<Smartphone className="w-5 h-5 text-green-400" />}
      >
        <p>
          The simulation includes three types of IoT devices, each representing real-world scenarios:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <div className="bg-red-900/20 border border-red-700/50 p-3 rounded-lg">
            <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 shrink-0" /> Healthcare Monitors</h4>
            <ul className="text-sm space-y-1">
              <li>• High priority tasks (critical/high)</li>
              <li>• Low latency requirements (50-200ms)</li>
              <li>• Medium resource usage</li>
              <li>• Patient safety critical</li>
            </ul>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
            <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2"><Zap className="w-4 h-4 shrink-0" /> Traffic Sensors</h4>
            <ul className="text-sm space-y-1">
              <li>• Medium-high priority</li>
              <li>• Very low latency (20-100ms)</li>
              <li>• Low resource usage</li>
              <li>• Real-time traffic control</li>
            </ul>
          </div>
          <div className="bg-blue-900/20 border border-blue-700/50 p-3 rounded-lg">
            <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2"><Factory className="w-4 h-4 shrink-0" /> Industrial Controllers</h4>
            <ul className="text-sm space-y-1">
              <li>• Low-medium priority</li>
              <li>• Higher latency tolerance (100-500ms)</li>
              <li>• High resource usage</li>
              <li>• Process optimization</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section 
        id="scheduling" 
        title="AI Scheduling Algorithms" 
        icon={<Brain className="w-5 h-5 text-purple-400" />}
      >
        <p>
          The system implements multiple scheduling strategies, with the trained MODRL scheduler (Deep Reinforcement Learning) 
          being the most advanced:
        </p>
        <div className="space-y-4 mt-3">
          <div className="bg-purple-900/20 border border-purple-700/50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2"><Brain className="w-4 h-4 shrink-0" /> MODRL (3×DQN + NSGA-II)</h4>
            <p className="text-sm mb-2">
              Based on Ibrahim &amp; Askar, IEEE Access 2023. Three Deep Q-Network agents were trained in a Python fog
              simulator, one per objective, and their choices are combined with NSGA-II (Pareto) selection:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• <strong>Load agent:</strong> avoids queues and unbalanced fog nodes</li>
              <li>• <strong>Distance agent:</strong> prefers low network delay</li>
              <li>• <strong>Priority agent:</strong> protects deadlines of high and critical tasks</li>
              <li>• <strong>NSGA-II:</strong> picks the best compromise on the Pareto front</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">
              Here the trained agents run on approximate inputs (CPU/memory load instead of queue delay), so the live
              charts are a demo. See the Results page for the evaluation in the training simulator.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2"><Brain className="w-4 h-4 shrink-0" /> Weighted Score (DRL-inspired)</h4>
            <p className="text-sm mb-2">
              A hand-weighted heuristic (no trained model) that considers multiple factors:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• <strong>Resource Availability:</strong> CPU and memory utilization of fog nodes</li>
              <li>• <strong>Distance Score:</strong> Physical proximity to minimize latency</li>
              <li>• <strong>Energy Efficiency:</strong> Power consumption optimization</li>
              <li>• <strong>Load Balancing:</strong> Even distribution across nodes</li>
              <li>• <strong>Priority Multiplier:</strong> Critical tasks get preference</li>
            </ul>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-900/50 p-3 rounded-lg">
              <h5 className="font-semibold text-orange-400 mb-1">Priority Aware</h5>
              <p className="text-xs">Schedules based on task urgency and priority levels</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg">
              <h5 className="font-semibold text-green-400 mb-1">Load Balanced</h5>
              <p className="text-xs">Distributes tasks evenly across available fog nodes</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg">
              <h5 className="font-semibold text-blue-400 mb-1">Energy Efficient</h5>
              <p className="text-xs">Minimizes overall energy consumption</p>
            </div>
          </div>
        </div>
      </Section>

      <Section 
        id="topology" 
        title="Network Topology & Visualization" 
        icon={<Cpu className="w-5 h-5 text-cyan-400" />}
      >
        <p>
          The network topology shows the real-time state of the fog computing environment:
        </p>
        <div className="bg-gray-900/50 p-4 rounded-lg mt-3">
          <h4 className="font-semibold text-white mb-3">Visual Elements:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-semibold text-cyan-400 mb-2">Device Status:</h5>
              <ul className="space-y-1">
                <li>• <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>Active devices</li>
                <li>• <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></span>Generating tasks</li>
                <li>• Different icons for device types</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-cyan-400 mb-2">Fog Nodes:</h5>
              <ul className="space-y-1">
                <li>• <span className="inline-block w-full h-1 bg-green-500 rounded mr-2" style={{width: '20px'}}></span>CPU utilization bar</li>
                <li>• <span className="inline-block w-5 h-5 bg-orange-500 rounded-full text-xs text-center mr-2">3</span>Active task count</li>
                <li>• Color-coded by utilization level</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section 
        id="metrics" 
        title="Performance Metrics & Analytics" 
        icon={<BarChart3 className="w-5 h-5 text-yellow-400" />}
      >
        <p>
          The dashboard tracks key performance indicators to evaluate scheduling effectiveness:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-400 mb-2">Real-time Metrics:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Total Tasks:</strong> Number of tasks generated</li>
              <li>• <strong>Completion Rate:</strong> Successfully processed tasks</li>
              <li>• <strong>Average Latency:</strong> Response time performance</li>
              <li>• <strong>Energy Consumption:</strong> Power usage across nodes</li>
              <li>• <strong>Fog Utilization:</strong> Resource usage efficiency</li>
              <li>• <strong>Cloud Offload Rate:</strong> Tasks sent to cloud</li>
            </ul>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-400 mb-2">Performance Analysis:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Historical Trends:</strong> Performance over time</li>
              <li>• <strong>Resource Monitoring:</strong> CPU/memory usage</li>
              <li>• <strong>Task Lifecycle:</strong> Pending → Processing → Complete</li>
              <li>• <strong>Node Comparison:</strong> Individual fog node performance</li>
              <li>• <strong>Strategy Comparison:</strong> Algorithm effectiveness</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section 
        id="datasets" 
        title="Working with Real Datasets" 
        icon={<Database className="w-5 h-5 text-blue-400" />}
      >
        <p>
          This simulation supports loading real-world datasets for more realistic demonstrations:
        </p>
        <div className="space-y-3 mt-3">
          <div className="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-400 mb-2">Available Datasets:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Sample Dataset:</strong> Pre-configured 30 tasks across all device types</li>
              <li>• <strong>Synthetic Data:</strong> Generate 150 realistic tasks (healthcare, traffic, industrial)</li>
              <li>• <strong>Custom CSV:</strong> Upload your own dataset file</li>
            </ul>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-2">CSV Format:</h4>
            <div className="bg-black/50 p-3 rounded font-mono text-xs text-green-400">
              timestamp,device_type,priority,cpu,memory,latency
            </div>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-2">Features:</h4>
            <ul className="text-sm space-y-1">
              <li>• View dataset statistics (device types, priorities, resource requirements)</li>
              <li>• Filter tasks by type or priority</li>
              <li>• Expand to see all tasks or collapse to summary view</li>
              <li>• Dataset information helps plan your demonstration</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section 
        id="demo" 
        title="Running the Demonstration" 
        icon={<Settings className="w-5 h-5 text-green-400" />}
      >
        <div className="bg-green-900/20 border border-green-700/50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-400 mb-3">How to Use the Simulation:</h4>
          <ol className="space-y-2 text-sm">
            <li><strong>1. Load Dataset (Optional):</strong> Click "Datasets" button to load sample data, generate synthetic data, or upload your own CSV file</li>
            <li><strong>2. Select Strategy:</strong> Choose from MODRL, Weighted Score, Priority Aware, Load Balanced, or Energy Efficient</li>
            <li><strong>3. Start Simulation:</strong> Click the "Start" button to begin task generation and scheduling</li>
            <li><strong>4. Observe Behavior:</strong> Watch how tasks flow from IoT devices to fog nodes or cloud</li>
            <li><strong>5. Monitor Metrics:</strong> Track performance indicators in real-time</li>
            <li><strong>6. Compare Strategies:</strong> Stop, reset, and try different algorithms to see performance differences</li>
            <li><strong>7. Analyze Results:</strong> Use the performance chart and node status to understand system behavior</li>
          </ol>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg mt-3">
          <h4 className="font-semibold text-blue-400 mb-2">What to Look For:</h4>
          <ul className="text-sm space-y-1">
            <li>• How different strategies affect latency and energy consumption</li>
            <li>• When tasks are offloaded to the cloud vs. processed locally</li>
            <li>• How fog nodes balance their workloads</li>
            <li>• The impact of task priority on scheduling decisions</li>
            <li>• Resource utilization patterns across the network</li>
          </ul>
        </div>
      </Section>
    </div>
  );
};