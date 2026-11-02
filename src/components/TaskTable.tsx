import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { Clock, Loader, CheckCircle, XCircle, ListChecks } from 'lucide-react';

type Status = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

interface TaskTableProps {
  tasks: Task[];
  nodeNames: Record<string, string>;
}

const PAGE_SIZE = 20;

const statusMeta: Record<Exclude<Status, 'all'>, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
  processing: { label: 'Processing', icon: <Loader className="w-4 h-4" />, color: 'text-blue-400' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400' },
  failed: { label: 'Failed', icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
};

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, nodeNames }) => {
  const [status, setStatus] = useState<Status>('all');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    processing: tasks.filter((t) => t.status === 'processing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  }), [tasks]);

  const filtered = useMemo(
    () => (status === 'all' ? tasks : tasks.filter((t) => t.status === status)),
    [tasks, status]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString() : '—');

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-400" /> Task Records
        </h2>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'processing', 'completed', 'failed'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                status === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="px-4 py-2 font-medium">Task ID</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">CPU (%)</th>
              <th className="px-4 py-2 font-medium">Memory (MB)</th>
              <th className="px-4 py-2 font-medium">Expected (ms)</th>
              <th className="px-4 py-2 font-medium">Actual (ms)</th>
              <th className="px-4 py-2 font-medium">Energy (kW)</th>
              <th className="px-4 py-2 font-medium">Assigned Node</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">No tasks in this view.</td></tr>
            ) : rows.map((t) => {
              const m = statusMeta[t.status];
              return (
                <tr key={t.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-gray-300">{t.id.slice(-8)}</td>
                  <td className="px-4 py-2 capitalize">{t.type}</td>
                  <td className="px-4 py-2 capitalize">{t.priority}</td>
                  <td className={`px-4 py-2 ${m.color}`}>
                    <span className="inline-flex items-center gap-1.5">{m.icon}{m.label}</span>
                  </td>
                  <td className="px-4 py-2">{t.cpuRequirement}</td>
                  <td className="px-4 py-2">{t.memoryRequirement}</td>
                  <td className="px-4 py-2">{t.expectedLatency}</td>
                  <td className="px-4 py-2">{t.actualLatency ?? '—'}</td>
                  <td className="px-4 py-2">{t.energyConsumed != null ? t.energyConsumed.toFixed(2) : '—'}</td>
                  <td className="px-4 py-2 text-gray-300">{t.assignedTo ? (nodeNames[t.assignedTo] ?? t.assignedTo) : '—'}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtTime(t.createdAt)}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtTime(t.completedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="p-3 flex items-center justify-between text-sm text-gray-400">
          <span>Page {current + 1} of {pageCount} · {filtered.length} tasks</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(Math.min(pageCount - 1, current + 1))} disabled={current >= pageCount - 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};
