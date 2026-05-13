import React, { useState } from 'react';
import type { TrajectoryPoint, SimulationConfiguration } from '../engine/calculator';
import { Info, Calendar, Briefcase, Home, Star } from 'lucide-react';

interface Props {
  data: TrajectoryPoint[];
  config: SimulationConfiguration;
}

export const LifeCalendar: React.FC<Props> = ({ data, config }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group data points by year
  const yearsMap = new Map<number, TrajectoryPoint[]>();
  
  data.forEach(point => {
    // point.date format is "MMM YYYY" e.g. "Jan 2026"
    const parts = point.date.split(' ');
    if (parts.length === 2) {
      const year = parseInt(parts[1]);
      if (!yearsMap.has(year)) yearsMap.set(year, []);
      yearsMap.get(year)?.push(point);
    }
  });

  const years = Array.from(yearsMap.keys()).sort();
  const monthsLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'GOOGLE': return 'bg-blue-500';
      case 'SABBATICAL': return 'bg-amber-400';
      case 'JUMP': return 'bg-emerald-500';
      case 'BRIDGE': return 'bg-indigo-500';
      case 'RETIRED': return 'bg-rose-400';
      default: return 'bg-slate-200';
    }
  };

  // Build Event Map for easy visual highlighting
  const monthEventsMap = new Map<number, string[]>();
  data.forEach((pt, i) => {
    const events: string[] = [];
    const [monthStr, yearStr] = pt.date.split(' ');
    const ptYear = parseInt(yearStr);

    // Check Life Events
    if (monthStr === 'Jan') {
      config.life_events?.forEach(e => {
        const isCollege = e.name.toLowerCase().includes('college');
        const isHit = isCollege 
          ? (ptYear >= e.year && ptYear < e.year + 4) 
          : (ptYear === e.year);
          
        if (isHit) {
          const suffix = isCollege ? ` (Year ${ptYear - e.year + 1} of 4)` : '';
          events.push(`Event: ${e.name}${suffix}`);
        }
      });
    }

    // Check phase transitions
    if (i > 0 && data[i-1].currentPhase !== pt.currentPhase) {
      events.push(`Transition to ${pt.currentPhase}`);
    }

    // Independence transition
    if (i > 0 && !data[i-1].isIndependent && pt.isIndependent) {
      events.push("FIRE Target Achieved");
    }

    // SS starts
    if (pt.socialSecurityIncome > 0 && (i === 0 || data[i-1].socialSecurityIncome === 0)) {
      events.push("Social Security Starts");
    }

    // Mortgage payoff (hardcoded currently in engine to Jun 2051)
    if (pt.date === 'Jun 2051') {
      events.push("Mortgage Paid Off");
    }

    if (events.length > 0) {
      monthEventsMap.set(pt.monthIndex, events);
    }
  });

  const hoveredPoint = hoveredIndex !== null ? data.find(d => d.monthIndex === hoveredIndex) : null;
  const hoveredEvents = hoveredIndex !== null ? monthEventsMap.get(hoveredIndex) : null;

  return (
    <div className="relative flex flex-col h-full py-2">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex gap-3 text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-1"><div className="w-2 h-2 border border-slate-300 bg-white flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-white shadow"></div></div> ★ Highlighted Months</div>
        </div>
        <div className="flex gap-3 text-[10px] font-medium uppercase tracking-wider text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-blue-500"></div> Google</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-400"></div> Sab.</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500"></div> Jump</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-indigo-500"></div> Bridge</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-400"></div> Ret.</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 pr-2 overflow-hidden relative flex gap-6">
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
          {/* Grid Header */}
          <div className="grid grid-cols-13 gap-1 mb-1 text-center text-[10px] font-bold text-slate-400">
            <div></div> {/* Spacer for Year column */}
            {monthsLabels.map((m, i) => <div key={i}>{m}</div>)}
          </div>

          {/* Grid Content */}
          <div className="space-y-1">
            {years.map(year => {
              const months = yearsMap.get(year) || [];
              return (
                <div key={year} className="grid grid-cols-13 gap-1 items-center">
                  <div className="text-[11px] font-mono font-bold text-slate-500 text-right pr-2">{year}</div>
                  
                  {Array.from({ length: 12 }).map((_, i) => {
                    const monthStr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i];
                    const pt = months.find(m => m.date.startsWith(monthStr));
                    
                    if (!pt) return <div key={i} className="w-full aspect-square bg-slate-50 rounded-sm"></div>;

                    const isIndependent = pt.isIndependent;
                    const hasHighlights = monthEventsMap.has(pt.monthIndex);

                    return (
                      <div
                        key={i}
                        className={`w-full aspect-square rounded-sm cursor-pointer transition-all transform hover:scale-125 hover:z-10 hover:ring-2 hover:ring-white shadow-sm flex items-center justify-center relative
                          ${getPhaseColor(pt.currentPhase)} 
                          ${isIndependent ? 'ring-1 ring-inset ring-yellow-300/40' : ''}
                        `}
                        onMouseEnter={() => setHoveredIndex(pt.monthIndex)}
                        title={`${pt.date} - ${pt.currentPhase}`}
                      >
                        {hasHighlights && (
                          <div className="w-1 h-1 bg-white rounded-full shadow-sm animate-pulse"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover Details Panel (Sticky right) */}
        <div className="w-64 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg p-4 self-start sticky top-0 text-slate-700 shadow-sm min-h-[300px]">
          {hoveredPoint ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-200">
                <div>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    {hoveredPoint.date}
                  </div>
                  <div className="text-xs font-medium mt-1 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getPhaseColor(hoveredPoint.currentPhase)}`}></div>
                    {hoveredPoint.currentPhase}
                  </div>
                </div>
                {hoveredPoint.isIndependent && (
                  <div className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ring-1 ring-emerald-200">FI Achieved</div>
                )}
              </div>

              <div className="space-y-3">
                {hoveredEvents && hoveredEvents.length > 0 && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase">
                      <Star className="w-3 h-3 fill-indigo-600" /> Key Highlights
                    </div>
                    {hoveredEvents.map((evt, idx) => (
                      <div key={idx} className="text-xs font-medium text-slate-800 leading-tight flex gap-1.5 items-start">
                        <span className="text-indigo-400 mt-0.5">•</span> {evt}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Total Wealth</label>
                  <div className="text-lg font-bold font-mono text-slate-900">${Math.round(hoveredPoint.totalNetWorth).toLocaleString()}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-slate-500 block">Liquid</label>
                    <div className="font-semibold">${Math.round(hoveredPoint.liquidCash / 1000)}k</div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block">Retirement</label>
                    <div className="font-semibold">${Math.round(hoveredPoint.retirement / 1000)}k</div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block">GOOG Value</label>
                    <div className="font-semibold">${Math.round(hoveredPoint.googValue / 1000)}k</div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block">Target NW</label>
                    <div className="font-semibold">${(hoveredPoint.swrTarget / 1000000).toFixed(1)}M</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Flows (Annualized)</label>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center gap-1"><Briefcase className="w-3 h-3"/> Income</span>
                      <span className="font-semibold text-emerald-600">+${(hoveredPoint.totalCompensation / 1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center gap-1"><Home className="w-3 h-3"/> Expense</span>
                      <span className="font-semibold text-rose-600">-${((hoveredPoint.lifestyleExpense + hoveredPoint.healthcareCost + hoveredPoint.mortgagePayment) / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs font-medium">Hover over a grid cell to see monthly details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Special grid styling injected */}
      <style>{`
        .grid-cols-13 {
          grid-template-columns: 2.5rem repeat(12, minmax(0, 1fr));
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
