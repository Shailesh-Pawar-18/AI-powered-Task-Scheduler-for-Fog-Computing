import React from 'react';
import { useSimulation } from './hooks/useSimulation';
import { NetworkTopology } from './components/NetworkTopology';
import { MetricsDashboard } from './components/MetricsDashboard';
import { TaskQueue } from './components/TaskQueue';
import { PerformanceChart } from './components/PerformanceChart';
import { SimulationExplanation } from './components/SimulationExplanation';
import { DatasetLoader } from './components/DatasetLoader';
import { DatasetViewer } from './components/DatasetViewer';
import { TaskTable } from './components/TaskTable';
import { ResultsPanel } from './components/ResultsPanel';
import { Play, Pause, RotateCcw, Settings, Brain, Zap, Database, HelpCircle, LogOut, BarChart3 } from 'lucide-react';
import { Task } from './types';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { getDatasets } from './api/client';

function App() {
  const { isAuthenticated, logout } = useAuth();
  const {
    isRunning,
    currentStrategy,
    schedulingStrategies,
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
    useDatasetMode,
    datasetProgress,
    loadDataset,
    applyRecordCount,
    toggleDatasetMode
  } = useSimulation();

  const [showExplanation, setShowExplanation] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [showDatasets, setShowDatasets] = React.useState(false);
  const [loadedDatasetTasks, setLoadedDatasetTasks] = React.useState<Task[]>([]);
  const [datasetStats, setDatasetStats] = React.useState({
    total: 0,
    healthcare: 0,
    traffic: 0,
    industrial: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const { records } = await getDatasets();
        if (cancelled || records.length === 0) return;
        const restored: Task[] = records.map((r, i) => ({
          id: `task_restore_${i}_${r._id}`,
          deviceId: r.sensorId || `device_${r.deviceType}_${i}`,
          type: r.deviceType as Task['type'],
          priority: r.priority as Task['priority'],
          cpuRequirement: r.cpu,
          memoryRequirement: r.memory,
          expectedLatency: r.latency,
          createdAt: r.timestamp ? new Date(r.timestamp).getTime() : Date.now(),
          status: 'pending' as const,
        }));
        setLoadedDatasetTasks(restored);
        setDatasetStats({
          total: restored.length,
          healthcare: restored.filter(t => t.type === 'healthcare').length,
          traffic: restored.filter(t => t.type === 'traffic').length,
          industrial: restored.filter(t => t.type === 'industrial').length,
          critical: restored.filter(t => t.priority === 'critical').length,
          high: restored.filter(t => t.priority === 'high').length,
          medium: restored.filter(t => t.priority === 'medium').length,
          low: restored.filter(t => t.priority === 'low').length,
        });
        loadDataset(restored);
        applyRecordCount(restored.length);
      } catch {
        // DB offline or no data — demo mode, nothing to restore.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginScreen />;

  const handleDatasetLoad = (tasks: Task[]) => {
    console.log('[App] handleDatasetLoad called with', tasks.length, 'tasks');
    if (tasks.length === 0) {
      console.error('[App] ERROR: No tasks loaded!');
      return;
    }
    setLoadedDatasetTasks(tasks);
    loadDataset(tasks); // Actually load into simulation
    applyRecordCount(tasks.length);
    console.log('[App] Dataset loaded and passed to simulation hook');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-700 bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-gray-800/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI-Powered Task Scheduler</h1>
                <p className="text-sm text-gray-400">Fog Computing Simulation</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Dataset Button */}
              <button
                onClick={() => setShowDatasets(!showDatasets)}
                aria-pressed={showDatasets}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  showDatasets
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>{showDatasets ? 'Hide Datasets' : 'Datasets'}</span>
              </button>

              {/* Results Button */}
              <button
                onClick={() => setShowResults(!showResults)}
                aria-pressed={showResults}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  showResults
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{showResults ? 'Hide Results' : 'Results'}</span>
              </button>

              {/* Help Button */}
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                aria-pressed={showExplanation}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  showExplanation
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showExplanation ? 'Hide Guide' : 'How it Works'}</span>
              </button>

              {/* Strategy Selector */}
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-gray-400 shrink-0" />
                <select
                  value={currentStrategy.id}
                  onChange={(e) => {
                    const strategy = schedulingStrategies.find(s => s.id === e.target.value);
                    if (strategy) changeStrategy(strategy);
                  }}
                  aria-label="Scheduling strategy"
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white transition-colors hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  {schedulingStrategies.map(strategy => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={isRunning ? stopSimulation : startSimulation}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isRunning
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isRunning ? 'Stop' : 'Start'}</span>
                </button>

                <button
                  onClick={resetSimulation}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={logout}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Strategy Description */}
          <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-center space-x-2 min-w-0">
                <Zap className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Current Strategy:</span>
                <span className="text-sm text-gray-300 truncate">{currentStrategy.description}</span>
              </div>
              {useDatasetMode && loadedDatasetTasks.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-sm text-green-400 font-medium whitespace-nowrap">Dataset Mode Active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-600 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${datasetProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums w-9 text-right">{Math.round(datasetProgress)}%</span>
                  </div>
                  <button
                    onClick={() => toggleDatasetMode(!useDatasetMode)}
                    className="text-xs whitespace-nowrap px-2.5 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isRunning}
                  >
                    Switch to Random
                  </button>
                </div>
              )}
              {!useDatasetMode && loadedDatasetTasks.length > 0 && (
                <button
                  onClick={() => toggleDatasetMode(true)}
                  className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center space-x-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  <Database className="w-4 h-4" />
                  <span className="whitespace-nowrap">Use Dataset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* Dataset Loader/Viewer Section */}
        {showDatasets && (
          <div className="mb-6 space-y-4">
            <DatasetLoader 
              onTasksLoaded={handleDatasetLoad}
              onStatsUpdate={(stats) => setDatasetStats(stats)}
            />
            {loadedDatasetTasks.length > 0 && (
              <div className="space-y-4">
                <DatasetViewer tasks={loadedDatasetTasks} stats={datasetStats} />
                
                {/* Dataset Mode Controls */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white mb-1">Simulation Mode</h4>
                      <p className="text-sm text-gray-400">
                        {useDatasetMode 
                          ? `Using loaded dataset (${loadedDatasetTasks.length} tasks) - ${datasetProgress.toFixed(1)}% processed - Click Start to run simulation`
                          : 'Using random task generation - Click "Use Dataset" to switch'}
                      </p>
                      {useDatasetMode && isRunning && (
                        <p className="text-xs text-green-400 mt-1">
                          Generating {Math.min(10, loadedDatasetTasks.length - Math.floor(datasetProgress * loadedDatasetTasks.length / 100))} tasks per second
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {useDatasetMode && (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/20 border border-green-700/50 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-400">Dataset Mode</span>
                        </div>
                      )}
                      <button
                        onClick={() => toggleDatasetMode(!useDatasetMode)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          useDatasetMode
                            ? 'bg-gray-600 hover:bg-gray-500'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        disabled={isRunning}
                      >
                        {useDatasetMode ? 'Switch to Random' : 'Use Dataset'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* MODRL evaluation results */}
        {showResults && (
          <div className="mb-6">
            <ResultsPanel />
          </div>
        )}

        {/* Explanation Section */}
        {showExplanation && (
          <div className="mb-6">
            <SimulationExplanation />
          </div>
        )}
        
        
        {/* Metrics Dashboard */}
        <MetricsDashboard metrics={metrics} className="mb-6" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Network Topology */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center space-x-2">
                <span>Network Topology</span>
                {isRunning && (
                  <div className="flex items-center space-x-1 text-green-400 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                )}
              </h2>
              <NetworkTopology
                iotDevices={iotDevices}
                fogNodes={fogNodes}
                cloudNode={cloudNode}
                tasks={tasks}
              />
            </div>
          </div>
          
          {/* Task Queues */}
          <div className="space-y-4">
            <TaskQueue tasks={pendingTasks} title="Pending Tasks" maxDisplay={5} />
            <TaskQueue tasks={processingTasks} title="Processing Tasks" maxDisplay={5} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Chart */}
          <PerformanceChart 
            data={performanceData} 
            title="Real-time Performance Metrics"
          />
          
          {/* Completed Tasks */}
          <TaskQueue tasks={completedTasks} title="Recently Completed Tasks" maxDisplay={10} />
        </div>

        {/* Task Records Table */}
        <div className="mt-6">
          <TaskTable
            tasks={tasks}
            nodeNames={{
              ...Object.fromEntries(fogNodes.map((n) => [n.id, n.name])),
              [cloudNode.id]: cloudNode.name,
            }}
          />
        </div>

        {/* Node Status Details */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold tracking-tight mb-4">Fog Node Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 tabular-nums">
            {fogNodes.map(node => (
              <div key={node.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 transition-colors hover:border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{node.name}</h3>
                  <div className={`w-3 h-3 rounded-full ${node.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">CPU</span>
                      <span>{node.currentCpu}/{node.maxCpu}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(node.currentCpu / node.maxCpu) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Memory</span>
                      <span>{node.currentMemory}/{node.maxMemory}MB</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(node.currentMemory / node.maxMemory) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Energy</span>
                    <span className="text-orange-400">{node.energyConsumption.toFixed(1)}kW</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tasks</span>
                    <span>{node.processingTasks.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;