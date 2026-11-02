import React, { useEffect, useRef } from 'react';

interface PerformanceData {
  timestamp: number;
  latency: number;
  energy: number;
  utilization: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  title: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    if (data.length < 2) return;

    // Calculate scales
    const maxLatency = Math.max(...data.map(d => d.latency));
    const maxEnergy = Math.max(...data.map(d => d.energy));
    const maxUtilization = Math.max(...data.map(d => d.utilization));
    
    const xScale = (width - 2 * padding) / (data.length - 1);
    const yScale = (height - 2 * padding);

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
      const y = padding + (yScale * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw latency line
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding + index * xScale;
      const y = padding + yScale * (1 - point.latency / Math.max(maxLatency, 1));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw energy line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding + index * xScale;
      const y = padding + yScale * (1 - point.energy / Math.max(maxEnergy, 1));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw utilization line
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding + index * xScale;
      const y = padding + yScale * (1 - point.utilization / Math.max(maxUtilization, 100));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw legend
    const legendY = height - 20;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText('Latency', padding, legendY);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Energy', padding + 60, legendY);
    ctx.fillStyle = '#10b981';
    ctx.fillText('Utilization', padding + 120, legendY);

  }, [data]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="relative w-full h-64">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};