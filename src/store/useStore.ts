import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FinancialSnapshot, SimulationConfiguration } from '../engine/calculator';

interface AppState {
  snapshot: FinancialSnapshot;
  config: SimulationConfiguration;
  updateSnapshot: (updates: Partial<FinancialSnapshot>) => void;
  updateConfig: (updates: Partial<SimulationConfiguration>) => void;
  updateNestedConfig: <K extends keyof SimulationConfiguration>(section: K, updates: Partial<SimulationConfiguration[K]>) => void;
  updateNestedSnapshot: <K extends keyof FinancialSnapshot>(section: K, updates: Partial<FinancialSnapshot[K]>) => void;
}

const initialSnapshot: FinancialSnapshot = {
  snapshot_date: new Date().toISOString(),
  last_updated: Date.now(),
  share_counts: {
    google_shares: 0, // Deprecated, now in other_investments
    cost_basis: 0,
    live_stock_price: 0,
  },
  liquid_assets: {
    vanguard_bridge: 0,
    cash_savings: 33000,
    google_equity_value: 0,
  },
  retirement_assets: {
    k401: 617361.90,
    roth_ira: 0,
    traditional_ira: 0,
  },
  education_assets: {
    total_529: 91362.42,
    accounts: [
      { id: '529-1', name: '529 1', balance: 43920.42 },
      { id: '529-2', name: '529 2', balance: 47442 }
    ],
  },
  liabilities: {
    mortgage_balance: 1430301.40,
    mortgage_interest_rate: 3.5,
    consumer_debt: 0,
    upcoming_capital_calls: 0,
  },
  other_investments: [
    {
      id: 'vti',
      name: 'VTI',
      symbol: 'VTI',
      shares: 70.302,
      cost_basis: 337.00, // Estimated
      current_price: 337.00,
      expected_return: 7.0
    },
    {
      id: 'vfiax',
      name: 'VFIAX',
      symbol: 'VFIAX',
      shares: 105.997,
      cost_basis: 636.00, // Estimated
      current_price: 636.00,
      expected_return: 7.0
    },
    {
      id: 'vfiax-2',
      name: 'VFIAX (2)',
      symbol: 'VFIAX',
      shares: 18.289,
      cost_basis: 636.00,
      current_price: 636.00,
      expected_return: 7.0
    },
    {
      id: 'vfiax-3',
      name: 'VFIAX (3)',
      symbol: 'VFIAX',
      shares: 19.084,
      cost_basis: 636.00,
      current_price: 636.00,
      expected_return: 7.0
    },
    {
      id: 'vghcx',
      name: 'VGHCX',
      symbol: 'VGHCX',
      shares: 188.384,
      cost_basis: 208.00, // Estimated
      current_price: 208.00,
      expected_return: 7.0
    },
    {
      id: 'vseqx',
      name: 'VSEQX',
      symbol: 'VSEQX',
      shares: 524.753,
      cost_basis: 39.00, // Estimated
      current_price: 39.00,
      expected_return: 7.0
    },
    {
      id: 'vtivx',
      name: 'VTIVX',
      symbol: 'VTIVX',
      shares: 418.306,
      cost_basis: 36.00, // Estimated
      current_price: 36.00,
      expected_return: 7.0
    },
    {
      id: 'goog',
      name: 'Google',
      symbol: 'GOOG',
      shares: 1054.84,
      cost_basis: 304.00, // Estimated
      current_price: 304.00,
      expected_return: 11.5
    }
  ]
};

const initialConfig: SimulationConfiguration = {
  career_path: {
    exit_year: 2030,
    use_jump: false,
    jump_duration: 4,
    use_sabbatical: false,
    sabbatical_duration: 1,
    use_bridge: true,
    bridge_duration: 5,
  },
  income_profile: {
    gross_annual_salary: 303524,
    google_net_monthly: 16441, // Estimated net from 303k
    initial_unvested_shares: 4320.52,
    vesting_years: 4,
    // google_vesting_units_monthly: 0, // Keeping for type safety transition
    jump_bonus_rate: 15.0,
    jump_gross_annual: 275000, // Replaces jump_net_monthly
    jump_grant_monthly: 5000,
    bridge_gross_annual: 220000,
    bridge_has_health_insurance: false,
    income_growth_rate: 6.0,
    target_bonus_rate: 25.0,
    annual_equity_grant: 250000,
    monthly_rental_income: 5000,
    use_partner_income: false,
    partner_gross_annual_salary: 0,
    partner_has_health_insurance: false,
    partner_retirement_year: 2030,
  },
  market_assumptions: {
    goog_growth_rate: 11.5,
    market_return_rate: 7.0,
    inflation_rate: 3.0,
    volatility_drag: 1.5,
  },
  tax_assumptions: {
    filing_status: 'married_joint',
    state_of_residence: 'NY',
  },
  divestment_strategy: {
    type: 'progressive',
    start_year: 2030,
    end_year: 2035,
  },
  spending: {
    monthly_lifestyle: 8750,
    empty_nest_year: 2039, // Default estimated
    empty_nest_monthly_spend: 4750,
    healthcare_premium: 2500,
    mortgage_payment: 7435.67,
  },
  birth_year: 1980,
  social_security: {
    start_age: 67, // Age to start SS
    monthly_amount: 3500, // Estimated monthly benefit
  },
  medicare: {
    start_age: 65, // Age to start Medicare
    monthly_premium: 174.70, // Standard Part B premium (2024 est)
  },
  life_events: [
    { name: 'Oona College', year: 2033, cost: 200000 },
    { name: 'Veda College', year: 2035, cost: 200000 },
    { name: 'Renovation', year: 2026, cost: 100000 },
  ],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      snapshot: initialSnapshot,
      config: initialConfig,
      updateSnapshot: (updates) => set((state) => ({ snapshot: { ...state.snapshot, ...updates } })),
      updateConfig: (updates) => set((state) => ({ config: { ...state.config, ...updates } })),
      updateNestedConfig: (section, updates) => set((state) => {
        const current = state.config[section];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let merged: any;
        if (typeof updates !== 'object' || updates === null) {
          merged = updates;
        } else if (Array.isArray(updates)) {
          merged = updates;
        } else {
          merged = { ...(current as any), ...updates };
        }

        return {
          config: {
            ...state.config,
            [section]: merged
          }
        };
      }),
      updateNestedSnapshot: (section, updates) => set((state) => {
        const current = state.snapshot[section];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let merged: any;
        if (typeof updates !== 'object' || updates === null) {
          merged = updates;
        } else if (Array.isArray(updates)) {
          merged = updates;
        } else {
          merged = { ...(current as any), ...updates };
        }

        return {
          snapshot: {
            ...state.snapshot,
            [section]: merged
          }
        };
      })
    }),
    {
      name: 'retiresmart-storage-v6', // Name of the storage key
      storage: createJSONStorage(() => localStorage), // Use localStorage
    }
  )
);
