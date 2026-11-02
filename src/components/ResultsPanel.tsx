import React from 'react';
import { BarChart3 } from 'lucide-react';
import results from '../models/modrlResults.json';

interface Row {
  strategy: string;
  'avg_completion_s': number; 'avg_completion_s_std': number;
  'deadline_miss_%': number; 'miss_high_prio_%': number;
  'cloud_offload_%': number; 'total_energy_J': number;
}
const DATA = results as unknown as Record<string, Row[]>;
const LAMBDAS = Object.keys(DATA).sort((a, b) => Number(a) - Number(b));
const SHOWN = [
  'MODRL (3xDQN + NSGA-II)', 'DQN load-only', 'DQN priority-only', 'Weighted-score (dashboard)',
  'Load-balanced', 'Priority-aware', 'Energy-efficient', 'Min-completion-time (strong greedy)',
];

export const ResultsPanel: React.FC = () => {
  const [lambda, setLambda] = React.useState(LAMBDAS.includes('10') ? '10' : LAMBDAS[0]);
  const rows = DATA[lambda].filter((r) => SHOWN.includes(r.strategy));
  const bestComp = Math.min(...rows.map((r) => r['avg_completion_s']));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-5">
      <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-400" /> MODRL Evaluation Results
      </h2>

      <p className="text-sm text-gray-300">
        Evaluation of the trained scheduler in the Python fog simulator: mean over 30 unseen test episodes per
        arrival rate. Method: Ibrahim &amp; Askar, &ldquo;An Intelligent Scheduling Strategy in Fog Computing System
        Based on Multi-Objective Deep Reinforcement Learning Algorithm,&rdquo; IEEE Access, vol. 11, 2023
        (doi 10.1109/ACCESS.2023.3337034). This is a simplified re-implementation, not the authors&rsquo; code.
      </p>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Arrival rate (tasks/s):</span>
        {LAMBDAS.map((l) => (
          <button key={l} onClick={() => setLambda(l)} aria-pressed={lambda === l}
            className={`px-3 py-1 rounded-md ${lambda === l ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="py-2 pr-4">Strategy</th><th className="pr-4">Avg completion (s)</th>
              <th className="pr-4">Deadline miss %</th><th className="pr-4">Miss % high/critical</th>
              <th className="pr-4">Cloud %</th><th>Energy (J)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.strategy} className={`border-b border-gray-700/50 ${r.strategy.startsWith('MODRL') ? 'text-green-300 font-medium' : ''}`}>
                <td className="py-2 pr-4">{r.strategy}</td>
                <td className="pr-4">{r['avg_completion_s'].toFixed(2)} ± {r['avg_completion_s_std'].toFixed(2)}{r['avg_completion_s'] === bestComp ? ' ★' : ''}</td>
                <td className="pr-4">{r['deadline_miss_%'].toFixed(2)}</td>
                <td className="pr-4">{r['miss_high_prio_%'].toFixed(1)}</td>
                <td className="pr-4">{r['cloud_offload_%'].toFixed(0)}</td>
                <td>{r['total_energy_J'].toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 text-sm text-gray-200 space-y-1">
        <p className="font-semibold text-yellow-400">How to read this honestly</p>
        <p>• MODRL clearly beats the four heuristic strategies of this dashboard (Weighted Score, Load Balanced, Priority Aware, Energy Efficient).</p>
        <p>• It does <strong>not</strong> beat a strong greedy rule that picks the node with the lowest predicted completion time (★ = best).</p>
        <p>• The 3-agent + NSGA-II ensemble is not faster than its own load agent; it trades some latency for less cloud use.</p>
        <p>• Results come from a synthetic simulator and a single training run; they do not describe real deployments.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <figure><img src="/results/comparison.png" alt="Strategy comparison at 10 tasks per second" className="w-full rounded-lg bg-white" /><figcaption className="text-xs text-gray-400 mt-1">Strategy comparison (10 tasks/s)</figcaption></figure>
        <figure><img src="/results/load_sweep.png" alt="Performance versus arrival rate" className="w-full rounded-lg bg-white" /><figcaption className="text-xs text-gray-400 mt-1">Performance versus load</figcaption></figure>
        <figure className="xl:col-span-2"><img src="/results/training_curves.png" alt="DQN training curves" className="w-full rounded-lg bg-white" /><figcaption className="text-xs text-gray-400 mt-1">DQN training curves and validation</figcaption></figure>
      </div>
    </div>
  );
};
