import '../index.css';

// Base layout component
export const Layout: React.FC<{ children: React.ReactNode; sidebar: React.ReactNode }> = ({ children, sidebar }) => {
  return (
    <div className="app-container">
      <header className="topbar card-glass">
        <div className="flex items-center gap-sm">
          <div className="logo-icon bg-gradient"></div>
          <h2 className="text-gradient">RetireSmart <span style={{ color: 'var(--text-secondary)' }}>Calculator</span></h2>
        </div>
        <div className="flex items-center gap-md">
          <button className="button button-outline">
            <span style={{ fontSize: '18px' }}>⟳</span> Sync Data
          </button>
        </div>
      </header>

      <main className="main-content container mt-xl">
        <div className="dashboard-grid">
          <aside className="sidebar flex-col gap-md">
            {sidebar}
          </aside>
          <div className="content-area flex-col gap-md">
            {children}
          </div>
        </div>
      </main>

      <style>{`
        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--border-light);
          border-top: none;
          border-left: none;
          border-right: none;
          border-radius: 0;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--gradient-glow);
          box-shadow: var(--shadow-glow);
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: var(--space-xl);
          align-items: start;
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div >
  );
};
