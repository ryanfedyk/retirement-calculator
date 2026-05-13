import React, { useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { useStore } from '../store/useStore';
import { runSimulation } from '../engine/calculator';
import { CheckCircle, Flag, TrendingUp, Sparkles, RefreshCw, CalendarDays } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { LifeCalendar } from './LifeCalendar';

export const RightPanel: React.FC = () => {
  const { snapshot, config } = useStore();

  const livePrice = snapshot.share_counts?.live_stock_price || 0;

  const trajectoryData = useMemo(() => runSimulation(snapshot, config, livePrice), [snapshot, config, livePrice]);

  const earlierConfig = useMemo(() => ({
    ...config,
    career_path: { ...config.career_path, exit_year: config.career_path.exit_year - 1 }
  }), [config]);

  const laterConfig = useMemo(() => ({
    ...config,
    career_path: { ...config.career_path, exit_year: config.career_path.exit_year + 1 }
  }), [config]);

  const earlierData = useMemo(() => runSimulation(snapshot, earlierConfig, livePrice), [snapshot, earlierConfig, livePrice]);
  const laterData = useMemo(() => runSimulation(snapshot, laterConfig, livePrice), [snapshot, laterConfig, livePrice]);

  const indepPoint = trajectoryData.find(d => d.isIndependent);
  const independenceYear = indepPoint ? indepPoint.date : 'N/A';
  const targetNetWorth = trajectoryData.length > 0 ? trajectoryData[0].swrTarget : 0;
  const currentTotalWealth = trajectoryData.length > 0 ? trajectoryData[0].totalNetWorth : 0;

  const [chartView, setChartView] = React.useState<'wealth' | 'income' | 'expenses' | 'assets' | 'timeline'>('wealth');
  const [analysis, setAnalysis] = React.useState<{
    retirementStatus: string;
    retirementExplanation: string;
    fiStatus: string;
    fiExplanation: string;
    strengths: string[];
    risks: string[];
    tips: string[];
    rawOutput?: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, snapshot, trajectory: trajectoryData })
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysis({
        retirementStatus: 'Needs Attention',
        retirementExplanation: 'Failed to generate analysis. Please ensure the backend is running.',
        fiStatus: 'Needs Attention',
        fiExplanation: 'Failed to generate analysis. Please ensure the backend is running.',
        strengths: [],
        risks: ['Failed to generate analysis.'],
        tips: ['Try again later.']
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formattedData = trajectoryData.map((point, i) => ({
    ...point,
    earlierNetWorth: earlierData[i] ? earlierData[i].totalNetWorth : 0,
    laterNetWorth: laterData[i] ? laterData[i].totalNetWorth : 0,
    activeNetWorth: point.totalNetWorth,
    nonRentalComp: point.totalCompensation - point.rentalIncome - (point.socialSecurityIncome || 0), // Separate SS? Or include?
    // Actually, point.totalCompensation INCLUDES SS now. 
    // If we want to stack them, we should subtract SS from "nonRentalComp" and have a separate SS area?
    // Let's rely on totalCompensation being the stack.
    // For Income View: "Comp" + "Rental" + "SS"?
    // Let's modify:
    socialSecurity: point.socialSecurityIncome || 0,
    salaryAndEquity: (point.totalCompensation - point.rentalIncome - (point.socialSecurityIncome || 0)), // Isolate Salary+Equity
    rentalIncome: point.rentalIncome || 0,
    lifestyleExpense: point.lifestyleExpense || 0,
    healthcareCost: point.healthcareCost || 0,
    mortgagePayment: point.mortgagePayment || 0
  }));

  const renderChartLayers = () => {
    switch (chartView) {
      case 'income':
        return (
          <>
            <Area type="monotone" dataKey="salaryAndEquity" stackId="1" stroke="#4f46e5" fill="#4f46e5" name="Salary & Equity" />
            <Area type="monotone" dataKey="rentalIncome" stackId="1" stroke="#10b981" fill="#10b981" name="Rental Income" />
            <Area type="monotone" dataKey="socialSecurity" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Social Security" />
          </>
        );
      case 'expenses':
        return (
          <>
            <Area type="monotone" dataKey="lifestyleExpense" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Lifestyle" />
            <Area type="monotone" dataKey="healthcareCost" stackId="1" stroke="#ef4444" fill="#ef4444" name="Healthcare" />
            <Area type="monotone" dataKey="mortgagePayment" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Mortgage" />
          </>
        );
      case 'wealth':
      default:
        return (
          <>
            <Area type="monotone" dataKey="activeNetWorth" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" name="Active Strategy" />
            <Line type="monotone" dataKey="earlierNetWorth" stroke="#6ee7b7" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Retire 1Yr Early" />
            <Line type="monotone" dataKey="laterNetWorth" stroke="#fcd34d" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Retire 1Yr Late" />

            {/* Mortgage Payoff Line - June 2051 */}
            <ReferenceLine x="Jun 2051" stroke="#8b5cf6" strokeDasharray="3 3" label={{ position: 'top', value: 'Mortgage Paid', fill: '#8b5cf6', fontSize: 12 }} />

            {/* Sabbatical Phase Area */}
            {trajectoryData.some(d => d.currentPhase === 'SABBATICAL') && (
              <ReferenceLine
                x={trajectoryData.find(d => d.currentPhase === 'SABBATICAL')?.date}
                stroke="none"
                label={{ position: 'insideTopLeft', value: 'Sabbatical', fill: '#f59e0b', fontSize: 12, dy: 25 }}
              />
            )}

            {/* Jump Phase Area */}
            {trajectoryData.some(d => d.currentPhase === 'JUMP') && (
              <ReferenceLine
                x={trajectoryData.find(d => d.currentPhase === 'JUMP')?.date}
                stroke="#10b981"
                strokeDasharray="2 2"
                label={{ position: 'insideTopLeft', value: 'Career Jump', fill: '#10b981', fontSize: 12, dy: 50 }}
              />
            )}

            {/* Bridge Phase Area */}
            {trajectoryData.some(d => d.currentPhase === 'BRIDGE') && (
              <ReferenceLine
                x={trajectoryData.find(d => d.currentPhase === 'BRIDGE')?.date}
                stroke="#3b82f6"
                strokeDasharray="2 2"
                label={{ position: 'insideTopLeft', value: 'Bridge Career', fill: '#3b82f6', fontSize: 12, dy: 75 }}
              />
            )}

            {/* Full Retirement Line */}
            {trajectoryData.some(d => d.currentPhase === 'RETIRED') && (
              <ReferenceLine
                x={trajectoryData.find(d => d.currentPhase === 'RETIRED')?.date}
                stroke="#ec4899"
                strokeDasharray="3 3"
                label={{ position: 'insideTopLeft', value: 'Full Retirement', fill: '#ec4899', fontSize: 12, dy: 30 }}
              />
            )}
          </>
        );
    }
  };

  const getChartTitle = () => {
    switch (chartView) {
      case 'income': return 'Income Breakdown';
      case 'expenses': return 'Expense Breakdown';
      default: return 'Wealth Trajectory';
    }
  };

  // renderMarkdown removed in favor of structured JSON rendering

  return (
    <main className="flex-1 bg-slate-50 p-6 overflow-y-auto h-full relative">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-white p-6 flex flex-col justify-between h-32 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Independence</div>
              <div className="text-2xl font-bold text-slate-900">
                {independenceYear !== 'N/A' ? independenceYear : '30+ Years'}
              </div>
            </div>
            <div className={`p-2 rounded-full ${independenceYear !== 'N/A' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Flag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {independenceYear !== 'N/A' ? 'You are on track to retire.' : 'Adjust strategy to reach FI.'}
          </div>
        </div>

        <div className="card bg-white p-6 flex flex-col justify-between h-32 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Target Net Worth</div>
              <div className="text-2xl font-bold text-slate-900">
                ${(targetNetWorth / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="p-2 rounded-full bg-indigo-100 text-indigo-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Based on ${(config.spending.monthly_lifestyle + config.spending.healthcare_premium).toLocaleString()}/mo spend
          </div>
        </div>

        <div className="card bg-white p-6 flex flex-col justify-between h-32 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Portfolio Strength</div>
              <div className="text-2xl font-bold text-slate-900">
                {targetNetWorth > 0 ? Math.min(100, Math.round((currentTotalWealth / targetNetWorth) * 100)) : 0}%
              </div>
            </div>
            <div className="p-2 rounded-full bg-amber-100 text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (currentTotalWealth / targetNetWorth) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className={`card bg-white border border-slate-200 shadow-sm rounded-xl relative mb-8 flex flex-col ${chartView === 'timeline' ? 'h-[600px]' : 'h-[500px]'} transition-all`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {chartView === 'timeline' ? 'Life & Career Timeline' : getChartTitle()}
              </h3>
              <div className="text-sm text-slate-500">
                {chartView === 'timeline' ? 'Granular monthly view of phases & milestones.' : 'Inflation-adjusted projection over 30 years.'}
              </div>
            </div>
          </div>

          {/* Chart Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setChartView('wealth')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'wealth' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Wealth
            </button>
            <button
              onClick={() => setChartView('assets')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'assets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Assets
            </button>
            <button
              onClick={() => setChartView('income')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'income' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Income
            </button>
            <button
              onClick={() => setChartView('expenses')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Expenses
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1"></div>
            <button
              onClick={() => setChartView('timeline')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${chartView === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-indigo-50'}`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 pt-2 w-full min-h-0 overflow-hidden flex flex-col">
          {chartView === 'timeline' ? (
            <div className="h-full w-full -mx-6 -mt-2 px-6">
              {/* Life Calendar takes the existing padding so we strip internal wrapper in component if needed, or adjust here */}
              {/* Since LifeCalendar exports its own "card" container, let's just render the Grid inside here so we share the master layout container? */}
              {/* Actually let's just render component, but it might render a double border. Let me adjust component to not render double border or wrap properly here. */}
              {/* For now, just render it. It fits right in! */}
              <LifeCalendar data={trajectoryData} config={config} />
            </div>
          ) : (
            <div className="w-full h-full relative pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    minTickGap={30}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                      if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
                      return `$${val}`;
                    }}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontWeight: 500, fontSize: '13px' }}
                    formatter={(value: any, name: any, props: any) => {
                      const val = value as number;
                      const formatted = val >= 1000000 ? `$${(val / 1000000).toFixed(2)}M` : `$${Math.round(val).toLocaleString()}`;
                      return [<span style={{ color: props.color }}>{formatted}</span>, name];
                    }}
                    labelFormatter={(label) => {
                      if (typeof label === 'string') {
                        const parts = label.split(' ');
                        if (parts.length === 2) {
                          const year = parseInt(parts[1]);
                          if (!isNaN(year)) {
                            const age = year - config.birth_year;
                            return `${label} (Age ${age})`;
                          }
                        }
                      }
                      return label;
                    }}
                  />
                  {renderChartLayers()}
                  {chartView === 'wealth' && independenceYear !== 'N/A' && (
                    <ReferenceLine x={independenceYear} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'FI', position: 'top', fill: '#10b981', fontSize: 12, fontWeight: 600 }} />
                  )}
                  {(() => {
                    const retYear = config.career_path.exit_year;
                    const retPoint = trajectoryData.find(p => p.date.includes(retYear.toString()));
                    if (retPoint) {
                      return <ReferenceLine x={retPoint.date} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Google Exit', position: 'insideTopLeft', fill: '#10b981', fontSize: 12, fontWeight: 600 }} />;
                    }
                    return null;
                  })()}
                  {config.social_security && (() => {
                    const ssYear = config.birth_year + config.social_security.start_age;
                    const ssPoint = trajectoryData.find(p => p.date.includes(ssYear.toString()));
                    if (ssPoint) {
                      return <ReferenceLine x={ssPoint.date} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'SS', position: 'top', fill: '#f59e0b', fontSize: 12, fontWeight: 600 }} />;
                    }
                    return null;
                  })()}
                  {config.medicare && (() => {
                    const medYear = config.birth_year + config.medicare.start_age;
                    const medPoint = trajectoryData.find(p => p.date.includes(medYear.toString()));
                    if (medPoint) {
                      return <ReferenceLine x={medPoint.date} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Medicare', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10, fontWeight: 600 }} />;
                    }
                    return null;
                  })()}
                  {config.spending.empty_nest_year && (() => {
                    const enYear = config.spending.empty_nest_year;
                    const enPoint = trajectoryData.find(p => p.date.includes(enYear.toString()));
                    if (enPoint) {
                      return <ReferenceLine x={enPoint.date} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Empty Nest', position: 'top', fill: '#f59e0b', fontSize: 12, fontWeight: 600 }} />;
                    }
                    return null;
                  })()}
                  {(() => {
                    const payoffPoint = trajectoryData.find(p => p.date === 'Jun 2051');
                    if (payoffPoint) {
                      return <ReferenceLine x={payoffPoint.date} stroke="#8b5cf6" strokeDasharray="3 3" label={{ value: 'Mortgage Free', position: 'insideTopLeft', fill: '#8b5cf6', fontSize: 10, fontWeight: 600 }} />;
                    }
                    return null;
                  })()}
                  {config.life_events && config.life_events
                    .map((event, idx) => {
                      const evtPoint = trajectoryData.find(p => p.date.includes(event.year.toString()));
                      if (evtPoint) {
                        return <ReferenceLine key={`event-${idx}`} x={evtPoint.date} stroke="#8b5cf6" strokeDasharray="3 3" label={{ value: event.name, position: 'top', fill: '#8b5cf6', fontSize: 10, fontWeight: 600 }} />;
                      }
                      return null;
                    })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Plan Analysis Section (Persistent) */}
      <div className="card bg-white p-6 border border-slate-200 shadow-sm rounded-xl">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">AI Plan Analysis</h3>
              <p className="text-xs text-slate-500">Powered by Gemini 3.0</p>
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors border border-slate-200 shadow-sm"
            disabled={isAnalyzing}
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>

        <div className="min-h-[100px]">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="font-medium animate-pulse">Analyzing your financial future...</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Status Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Retirement Status */}
                <div className={`p-4 rounded-lg border ${
                  analysis.retirementStatus === 'On Track' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  analysis.retirementStatus === 'At Risk' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">Retirement: {analysis.retirementStatus}</span>
                  </div>
                  <p className="text-sm">{analysis.retirementExplanation}</p>
                </div>

                {/* FI Status */}
                <div className={`p-4 rounded-lg border ${
                  analysis.fiStatus === 'On Track' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  analysis.fiStatus === 'At Risk' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">FI: {analysis.fiStatus}</span>
                  </div>
                  <p className="text-sm">{analysis.fiExplanation}</p>
                </div>
              </div>

              {/* Grid for Strengths and Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Key Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-slate-400 mt-1">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks */}
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-500" /> Potential Risks
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.risks.map((r, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-slate-400 mt-1">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tips */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Optimization Tips
                </h4>
                <ul className="space-y-1.5">
                  {analysis.tips.map((t, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-slate-400 mt-1">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fallback Raw Output */}
              {analysis.rawOutput && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">Raw Output (Fallback)</h4>
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap">{analysis.rawOutput}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <Sparkles className="w-8 h-8 mb-3 text-slate-300" />
              <p className="text-sm font-medium">Click "Refresh Analysis" to generate insights for your current plan.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
