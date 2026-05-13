import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { useStore } from './store/useStore';
import { API_BASE_URL } from './config';
import './index.css';

function App() {

  useEffect(() => {
    const fetchPrices = async () => {
      const currentSnapshot = useStore.getState().snapshot;

      // 1. Fetch GOOG
      // Always fetch to keep it live
      try {
        const res = await fetch(`${API_BASE_URL}/api/quote/GOOG`);
        const data = await res.json();
        if (data && data.price) {
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
        console.error("Failed to fetch GOOG price", err);
      }

      // 2. Fetch Other Investments
      if (currentSnapshot.other_investments && currentSnapshot.other_investments.length > 0) {
        currentSnapshot.other_investments.forEach(async (inv) => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/quote/${inv.symbol}`);
            const data = await res.json();
            if (data && data.price) {
              useStore.setState(state => ({
                snapshot: {
                  ...state.snapshot,
                  other_investments: state.snapshot.other_investments.map(i =>
                    i.id === inv.id ? { ...i, current_price: data.price } : i
                  ),
                  last_updated: Date.now()
                }
              }));
            }
          } catch (err) {
            console.error(`Failed to fetch price for ${inv.symbol}`, err);
          }
        });
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 20000); // 20 seconds polling

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden md:overflow-hidden overflow-y-auto">
        <LeftPanel />
        <RightPanel />
      </div>
    </div>
  );
}

export default App;
