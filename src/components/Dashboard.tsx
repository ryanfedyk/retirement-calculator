import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '../store/useStore';
import { runSimulation } from '../engine/calculator';
import { API_BASE_URL } from '../config';

export const Dashboard: React.FC = () => {
  const profile = useStore(state => state);
  const { snapshot, config, updateNestedConfig } = profile;

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchPrice = async () => {
    try {
      setIsRefreshing(true);
      // In a real app we might want to check if data is stale, but for now we fetch on mount
      const res = await fetch(`${API_BASE_URL}/api/quote/GOOG`);
      const data = await res.json();
      if (data && data.price) {
        // Update the store with live price
        useStore.setState(state => ({
          snapshot: {
            ...state.snapshot,
            share_counts: {
              ...state.snapshot.share_counts,
              live_stock_price: data.price
            },
            last_updated: Date.now(),
            liquid_assets: {
              ...state.snapshot.liquid_assets,
              google_equity_value: state.snapshot.share_counts.google_shares * data.price
            }
          }
        }));
      }
    } catch (err) {
      console.error("Failed to fetch live price", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshPrice = () => {
    fetchPrice();
  };

  // Fetch Live GOOG Price
  React.useEffect(() => {
    // Only fetch if price is 0 (uninitialized)
    if ((snapshot.share_counts?.live_stock_price || 0) === 0) {
      fetchPrice();
    }
  }, []);

  const trajectoryData = useMemo(() => runSimulation(snapshot, config, snapshot.share_counts?.live_stock_price || 0), [snapshot, config]);

  // Baseline: Standard 7% returns, No Jump, No Bridge Aggressive, No Divestment (just hold)
  const baselineConfig = useMemo(() => ({
    ...config,
    career_path: { ...config.career_path, use_jump: false, use_bridge: true }, // Conservative career
    market_assumptions: { ...config.market_assumptions, goog_growth_rate: 7, market_return_rate: 7 }, // Standard market
    divestment_strategy: { type: 'none' as const, start_year: 0, end_year: 0 }
  }), [config]);

  const baselineData = useMemo(() => runSimulation(snapshot, baselineConfig, snapshot.share_counts?.live_stock_price || 0), [snapshot, baselineConfig]);

  const indepPoint = trajectoryData.find(d => d.isIndependent);
  const independenceYear = indepPoint ? indepPoint.date : 'N/A';
  const targetNetWorth = trajectoryData.length > 0 ? trajectoryData[0].swrTarget : 0;

  const currentTotalWealth = trajectoryData.length > 0 ? trajectoryData[0].totalNetWorth : 0;
  const portfolioStrength = targetNetWorth > 0 ? Math.min(100, Math.round((currentTotalWealth / targetNetWorth) * 100)) : 0;

  // Combine data for chart
  const chartData = trajectoryData.map((point, i) => ({
    ...point,
    baselineNetWorth: baselineData[i] ? baselineData[i].totalNetWorth : 0
  }));

  return (
    <>
      <div className="flex justify-end mb-sm">
        <div className="card-glass flex items-center gap-sm px-md py-xs" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
          {(snapshot.share_counts?.live_stock_price || 0) > 0 ? (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }}></div>
          ) : (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-yellow)', boxShadow: '0 0 8px var(--accent-yellow)', animation: 'pulse 2s infinite' }}></div>
          )}
          <span className="text-caption" style={{ margin: 0, fontWeight: 600 }}>LIVE GOOG: <span style={{ color: 'var(--text-primary)' }}>${(snapshot.share_counts?.live_stock_price || 0) > 0 ? (snapshot.share_counts?.live_stock_price || 0).toFixed(2) : '--.--'}</span>
            <button
              onClick={handleRefreshPrice}
              disabled={isRefreshing}
              style={{ background: 'none', border: 'none', cursor: isRefreshing ? 'wait' : 'pointer', padding: '0 4px', marginLeft: '4px' }}
              title="Force Refresh Price"
            >
              <span style={{ color: isRefreshing ? 'var(--text-tertiary)' : 'var(--accent-blue)', display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>⟳</span>
            </button>
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-light)' }}>({snapshot.share_counts.google_shares.toFixed(2)} SHARES)</span>
          <div style={{ marginLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Total: <strong>${(snapshot.share_counts.google_shares * (snapshot.share_counts?.live_stock_price || 0)).toLocaleString([], { maximumFractionDigits: 0 })}</strong>
          </div>
        </div>
      </div>

      <div className="card card-glass mb-md animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div className="flex items-center gap-md">
          <div className="icon-box" style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '16px', fontSize: '1.5rem', border: '1px solid var(--border-light)' }}>
            🚀
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Strategy Modeler</h2>
            <div className="text-caption">HIGH-NET-WORTH PATH OPTIMIZER</div>
          </div>
        </div>

        <div className="flex gap-xl text-right">
          <div>
            <div className="text-caption mb-xs">INDEPENDENCE MILESTONE</div>
            <h2 className="text-gradient" style={{ fontSize: '2rem' }}>{independenceYear !== 'N/A' ? `${independenceYear}` : '+30 Years'}</h2>
          </div>
          <div>
            <div className="text-caption mb-xs">TARGET NET WORTH <span style={{ color: 'var(--text-tertiary)' }}>ⓘ</span></div>
            <h2 style={{ fontSize: '2rem' }}>${(targetNetWorth / 1000000).toFixed(1)}M</h2>
          </div>
        </div>

        <div className="bg-main p-md" style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', minWidth: '250px', border: '1px solid var(--border-light)' }}>
          <div className="flex justify-between mb-xs">
            <span className="text-caption font-bold">PORTFOLIO STRENGTH</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-green)' }}>{portfolioStrength}%</span>
          </div>
          <h2 style={{ fontSize: '1.75rem' }}>${(currentTotalWealth / 1000).toFixed(0)}K</h2>
          <div style={{ width: '100%', height: '4px', background: 'var(--bg-card-hover)', borderRadius: '2px', marginTop: '0.5rem' }}>
            <div style={{ width: `${portfolioStrength}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '2px' }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-md mb-md animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="card-glass p-md flex items-center gap-md hover-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border-light)' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--accent-purple)' }}>⚡</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>EARLIEST EXIT</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Aggressive growth, 5% SWR, high concentration.</div>
          </div>
        </div>

        <div className="card-glass p-md flex items-center gap-md hover-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border-focus)', background: 'rgba(16, 185, 129, 0.02)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--accent-green)' }}>🛡️</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>MAXIMUM SAFETY</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Long tenure, 3.5% SWR, full diversification.</div>
          </div>
        </div>

        <div className="card-glass p-md flex items-center gap-md hover-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border-light)' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--accent-yellow)' }}>☕</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>ANTI-BURNOUT</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Balanced 4% SWR, long coasting/bridge phase.</div>
          </div>
        </div>
      </div>

      <div className="card bg-main mb-md animate-fade-in flex-wrap-mobile" style={{ animationDelay: '0.2s', background: '#0a0e17', border: '1px solid var(--border-light)', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, minWidth: '180px' }}>
          <div className="badge badge-green mb-sm flex items-center gap-xs" style={{ display: 'inline-flex' }}><span style={{ fontSize: '1rem' }}>✨</span> AI STRATEGIST</div>
          <div className="mb-xs">
            <div className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-yellow)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 1rem' }}>RISK: MEDIUM</div>
          </div>
          <button className="button button-primary w-full mb-xs">
            <span style={{ marginRight: '8px' }}>⟳</span> SYNC ANALYSIS
          </button>
          <button className="button button-secondary w-full" style={{ background: 'var(--bg-card)', border: 'none' }}>
            SHOW EXPERT PLAN
          </button>
        </div>

        <div style={{ paddingLeft: '1.5rem', borderLeft: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.6, color: 'var(--text-secondary)', flexGrow: 1 }}>
          You are on track to retire {independenceYear !== 'N/A' ? `by ${independenceYear}` : `eventually`} with a nest egg that easily covers your spending needs. However, relying on consistent double-digit growth from a single company creates a concentration risk you must manage carefully.
        </div>
      </div>

      <div className="card mb-md animate-fade-in relative overflow-hidden" style={{ animationDelay: '0.3s', minHeight: '400px' }}>
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'var(--gradient-primary)' }}></div>

        <div className="flex justify-between items-start mb-lg relative z-10" style={{ marginTop: '1rem' }}>
          <div>
            <h2 style={{ letterSpacing: '-0.03em' }}>Growth Trajectory</h2>
            <div className="text-caption">INFLATION-ADJUSTED LIQUID WEALTH</div>
          </div>

          <div className="flex gap-md">
            <div className="flex items-center gap-xs">
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-purple)' }}></div>
              <span className="text-caption font-bold" style={{ color: 'var(--text-secondary)' }}>ACTIVE PATH</span>
            </div>
            <div className="flex items-center gap-xs">
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)' }}></div>
              <span className="text-caption font-bold" style={{ color: 'var(--text-secondary)' }}>BASELINE</span>
            </div>
          </div>
        </div>

        <div style={{ height: '350px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
              <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="totalNetWorth" stroke="var(--text-tertiary)" tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} width={80} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}
                formatter={(value: any, name: string | undefined) => {
                  if (name === 'totalNetWorth') return [`$${(value as number / 1000000).toFixed(2)}M`, 'Active Net Worth'];
                  if (name === 'baselineNetWorth') return [`$${(value as number / 1000000).toFixed(2)}M`, 'Baseline Net Worth'];
                  if (name === 'totalLiabilities') return [`$${(value as number / 1000).toFixed(0)}K`, 'Deficit/Debt'];
                  return [value, name || ''];
                }}
              />

              {independenceYear !== 'N/A' && <ReferenceLine x={independenceYear} stroke="var(--accent-green)" strokeDasharray="3 3" />}

              <Line type="monotone" dataKey="totalLiabilities" stroke="var(--accent-red)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="baselineNetWorth" stroke="var(--text-tertiary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="totalNetWorth" stroke="url(#colorWealth)" strokeWidth={4} dot={false} activeDot={{ r: 6, fill: 'var(--accent-purple)' }} />

              <defs>
                <linearGradient id="colorWealth" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--accent-blue)" />
                  <stop offset="100%" stopColor="var(--accent-purple)" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-md animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <div className="card">
          <div className="flex items-center gap-xs mb-lg">
            <span style={{ fontSize: '1.25rem' }}>📈</span>
            <h4 className="text-caption font-bold">MACRO DYNAMICS</h4>
          </div>

          <div className="mb-md">
            <div className="flex justify-between mb-xs">
              <span className="text-caption font-bold">INFLATION</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{(config.market_assumptions.inflation_rate).toFixed(1)}%</span>
            </div>
            <input type="range" min="1" max="10" value={config.market_assumptions.inflation_rate} onChange={e => updateNestedConfig('market_assumptions', { inflation_rate: parseFloat(e.target.value) })} step="0.5" className="w-full" style={{ accentColor: 'var(--accent-yellow)' }} />
          </div>

          <div>
            <div className="flex justify-between mb-xs">
              <span className="text-caption font-bold">STANDARD RETURN</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{(config.market_assumptions.market_return_rate).toFixed(1)}%</span>
            </div>
            <input type="range" min="1" max="15" value={config.market_assumptions.market_return_rate} onChange={e => updateNestedConfig('market_assumptions', { market_return_rate: parseFloat(e.target.value) })} step="0.5" className="w-full" style={{ accentColor: 'var(--text-tertiary)' }} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-xs mb-lg">
            <span style={{ fontSize: '1.25rem', color: 'var(--accent-red)' }}>❤️</span>
            <h4 className="text-caption font-bold">SPENDING GUARDRAILS</h4>
          </div>

          <div className="mb-md">
            <div className="flex justify-between mb-xs">
              <span className="text-caption font-bold">HEALTHCARE</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>${config.spending.healthcare_premium}/MO</span>
            </div>
            <input type="range" min="500" max="5000" value={config.spending.healthcare_premium} onChange={e => updateNestedConfig('spending', { healthcare_premium: parseInt(e.target.value) })} step="100" className="w-full" style={{ accentColor: 'var(--accent-red)' }} />
          </div>

          <div>
            <div className="flex justify-between mb-xs">
              <span className="text-caption font-bold">LIFESTYLE BURN</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>${config.spending.monthly_lifestyle}/MO</span>
            </div>
            <input type="range" min="4000" max="25000" value={config.spending.monthly_lifestyle} onChange={e => updateNestedConfig('spending', { monthly_lifestyle: parseInt(e.target.value) })} step="500" className="w-full" style={{ accentColor: 'var(--accent-green)' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-md animate-fade-in mt-md" style={{ animationDelay: '0.5s' }}>
        <div className="card">
          <div className="flex items-center gap-xs mb-lg">
            <span style={{ fontSize: '1.25rem' }}>🎓</span>
            <h4 className="text-caption font-bold">CAREER & EXIT</h4>
          </div>
          <div className="mb-md">
            <div className="flex justify-between mb-xs">
              <span className="text-caption font-bold">EXIT YEAR</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{config.career_path.exit_year}</span>
            </div>
            <input type="range" min={new Date().getFullYear()} max={2040} value={config.career_path.exit_year} onChange={e => updateNestedConfig('career_path', { exit_year: parseInt(e.target.value) })} step="1" className="w-full" style={{ accentColor: 'var(--accent-purple)' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-caption font-bold">BRIDGE JOB</span>
            <label className="switch">
              <input type="checkbox" checked={config.career_path.use_bridge} onChange={e => updateNestedConfig('career_path', { use_bridge: e.target.checked })} />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-xs mb-lg">
            <span style={{ fontSize: '1.25rem' }}>📉</span>
            <h4 className="text-caption font-bold">DIVESTMENT STRATEGY</h4>
          </div>
          <div className="mb-md">
            <select
              value={config.divestment_strategy.type}
              onChange={e => updateNestedConfig('divestment_strategy', { type: e.target.value as any })}
              className="w-full p-xs rounded-sm bg-input border mb-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="none">No Divestment (Hold GOOG)</option>
              <option value="immediate">Immediate Divestment</option>
              <option value="progressive">Progressive Glide Path</option>
            </select>
            {config.divestment_strategy.type === 'progressive' && (
              <div className="flex gap-sm">
                <div className="flex-1">
                  <div className="text-caption mb-xs">START</div>
                  <input type="number" value={config.divestment_strategy.start_year} onChange={e => updateNestedConfig('divestment_strategy', { start_year: parseInt(e.target.value) })} className="w-full bg-input border rounded-sm p-xs" />
                </div>
                <div className="flex-1">
                  <div className="text-caption mb-xs">END</div>
                  <input type="number" value={config.divestment_strategy.end_year} onChange={e => updateNestedConfig('divestment_strategy', { end_year: parseInt(e.target.value) })} className="w-full bg-input border rounded-sm p-xs" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
