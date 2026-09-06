import React, { useState } from 'react';
import { Holding } from '../types';
import { ASSET_TYPE_COLORS, ASSET_TYPE_LABELS, formatCurrency } from '../utils/formatters';
import { PieChart } from 'lucide-react';

interface AllocationDonutProps {
  holdings: Holding[];
  totalValue: number;
  currency: 'EUR' | 'USD';
}

export const AllocationDonut: React.FC<AllocationDonutProps> = ({
  holdings,
  totalValue,
  currency,
}) => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  // Group holdings by type
  const initialAllocation: Record<string, { value: number; count: number }> = {};
  const allocation = holdings.reduce((acc, h) => {
    const val = h.shares * h.currentPrice;
    if (!acc[h.assetType]) {
      acc[h.assetType] = { value: 0, count: 0 };
    }
    acc[h.assetType].value += val;
    acc[h.assetType].count += 1;
    return acc;
  }, initialAllocation);

  const types = ['etf', 'stock', 'crypto', 'cash'];
  const safeTotal = totalValue > 0 ? totalValue : 1;

  // Calculate SVG stroke dashes for circle of radius 15.9155 (circumference = 100)
  let accumulatedPercent = 0;
  const segments = types.map((type) => {
    const data = allocation[type] || { value: 0, count: 0 };
    const percent = (data.value / safeTotal) * 100;
    const strokeDasharray = `${percent.toFixed(2)} ${(100 - percent).toFixed(2)}`;
    const strokeDashoffset = -accumulatedPercent;
    accumulatedPercent += percent;

    return {
      type,
      percent,
      value: data.value,
      count: data.count,
      strokeDasharray,
      strokeDashoffset,
      color: ASSET_TYPE_COLORS[type] || '#64748b',
      label: ASSET_TYPE_LABELS[type] || type,
    };
  });

  const activeSegment = hoveredType ? segments.find((s) => s.type === hoveredType) : null;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <PieChart className="w-5 h-5 text-blue-600" />
          Alocação
        </h2>
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {holdings.length} Ativos
        </span>
      </div>

      {/* Donut Container */}
      <div className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto my-2">
        <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90 transform">
          {/* Background Ring */}
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="4.5"
          />

          {/* Dynamic Segments */}
          {segments.map((seg) => {
            if (seg.percent <= 0) return null;
            const isHovered = hoveredType === seg.type;
            return (
              <circle
                key={seg.type}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? '6' : '4.5'}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredType(seg.type)}
                onMouseLeave={() => setHoveredType(null)}
              />
            );
          })}
        </svg>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeSegment ? (
            <>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {activeSegment.label}
              </span>
              <span className="text-lg font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                {activeSegment.percent.toFixed(1)}%
              </span>
              <span className="text-[11px] text-blue-600 font-medium font-mono">
                {formatCurrency(activeSegment.value, currency)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-400 uppercase font-medium tracking-wider">
                Total
              </span>
              <span className="text-xl font-black text-slate-900 font-['Plus_Jakarta_Sans']">
                {holdings.length}
              </span>
              <span className="text-[11px] text-slate-500">
                Ativos
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.type}
            onMouseEnter={() => setHoveredType(seg.type)}
            onMouseLeave={() => setHoveredType(null)}
            className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
              hoveredType === seg.type ? 'bg-slate-50 ring-1 ring-slate-200' : 'hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-xs font-semibold text-slate-700">
                {seg.label}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {seg.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
