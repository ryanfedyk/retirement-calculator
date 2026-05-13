import React from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, Wallet, Save, CloudDownload } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const TopBar: React.FC = () => {
  const { snapshot, config } = useStore();
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, config })
      });
      alert('Plan successfully saved to server!');
    } catch (err) {
      console.error(err);
      alert('Failed to save plan to server.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (!res.ok) throw new Error('No settings found');
      const data = await res.json();
      if (data.config) useStore.setState(state => ({ ...state, config: data.config }));
      if (data.snapshot) useStore.setState(state => ({ ...state, snapshot: data.snapshot }));
      alert('Plan loaded successfully from server!');
    } catch (err) {
      console.error(err);
      alert('Failed to load plan from server. Make sure you have saved one first.');
    } finally {
      setLoading(false);
    }
  };

  const livePrice = snapshot.share_counts.live_stock_price || snapshot.liquid_assets.google_equity_value / snapshot.share_counts.google_shares || 0;

  // Calculate Current Net Worth
  const assets =
    snapshot.liquid_assets.vanguard_bridge +
    snapshot.liquid_assets.cash_savings +
    (snapshot.share_counts.google_shares * livePrice) +
    snapshot.retirement_assets.k401 +
    snapshot.retirement_assets.roth_ira +
    snapshot.retirement_assets.traditional_ira +
    snapshot.education_assets.total_529 +
    (snapshot.other_investments || []).reduce((acc, inv) => acc + (inv.shares * inv.current_price), 0);

  const netWorth = assets;

  return (
    <header className="h-auto md:h-16 py-3 md:py-0 bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 sticky top-0 z-10 gap-3 md:gap-0">
      <div className="flex items-center gap-2 justify-between md:justify-start w-full md:w-auto">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">RetireSmart <span className="text-indigo-600">V6</span></h1>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-indigo-600" />
            {saving ? 'Saving...' : 'Save to Cloud'}
          </button>
          <button 
            onClick={handleLoad} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-md text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <CloudDownload className="w-3.5 h-3.5" />
            {loading ? 'Loading...' : 'Load from Cloud'}
          </button>
        </div>

        <div className="flex flex-col items-end mr-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live GOOG</span>
            <span className="text-sm font-bold text-slate-900 font-mono">${livePrice.toFixed(2)}</span>
          </div>
          {snapshot.last_updated && (
            <span className="text-[10px] text-slate-400 mt-1">
              Updated {new Date(snapshot.last_updated).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Worth</div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              ${Math.round(netWorth).toLocaleString()}
            </div>
          </div>
          <div className="bg-emerald-100 p-2 rounded-full">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>
    </header>
  );
};
// Force rebuild
