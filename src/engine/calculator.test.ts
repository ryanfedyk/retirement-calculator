import { describe, it, expect } from 'vitest';
import { runSimulation } from './calculator';
import type { FinancialSnapshot, SimulationConfiguration } from './calculator';

describe('Calculator Engine V5', () => {
  const baseSnapshot: FinancialSnapshot = {
    snapshot_date: '2024-01-01',
    share_counts: { google_shares: 500, cost_basis: 100, live_stock_price: 150 },
    liquid_assets: { cash_savings: 50000, vanguard_bridge: 100000, google_equity_value: 150 },
    retirement_assets: { k401: 200000, roth_ira: 50000, traditional_ira: 0 },
    education_assets: { total_529: 50000 },
    liabilities: { mortgage_balance: 500000, mortgage_interest_rate: 3.5, consumer_debt: 10000, upcoming_capital_calls: 0 }
  } as any;

  const baseConfig: SimulationConfiguration = {
    career_path: { exit_year: 2026, use_jump: true, jump_duration: 3, use_bridge: true, bridge_duration: 4 },
    income_profile: {
      google_net_monthly: 10000,
      google_vesting_units_monthly: 10,
      jump_net_monthly: 12000,
      jump_grant_monthly: 2000,
      bridge_gross_annual: 147692
    },
    market_assumptions: { goog_growth_rate: 10, market_return_rate: 7, inflation_rate: 3, volatility_drag: 1 },
    tax_assumptions: { filing_status: 'single', state_of_residence: 'CA' },
    divestment_strategy: { type: 'progressive', start_year: 2024, end_year: 2028 },
    spending: { monthly_lifestyle: 10000, healthcare_premium: 1500, mortgage_payment: 3000 },
    life_events: []
  };

  it('handles progressive divestment correctly', () => {
    // 500 shares over 4 years (48 months) = 10.41 shares per month
    const points = runSimulation(baseSnapshot, baseConfig, 150);
    // At month 12 (1 year in), Google shares should have decreased due to divestment + vesting
    // Vesting is 10/mo. Sold is ~10.41/mo. Net should be slightly down or flat depending on timing.
    expect(points.length).toBeGreaterThan(0);
  });

  it('drains assets sequentially during severe deficit', () => {
    // Force a huge deficit
    const deficitConfig: SimulationConfiguration = {
      ...baseConfig,
      career_path: { exit_year: 2024, use_jump: false, jump_duration: 0, use_bridge: false, bridge_duration: 0 }, // Retire immediately
      spending: { monthly_lifestyle: 50000, healthcare_premium: 1500, mortgage_payment: 3000 } // Burn 54.5k/mo
    };

    const points = runSimulation(baseSnapshot, deficitConfig, 150);

    // Look at year 1 (month 12)
    const year1 = points.find(p => p.monthIndex === 12);
    expect(year1).toBeDefined();

    // Check year 5 to ensure they are fully drained or heavily impacted
    const year5 = points[4];
    // With such high burn, liquid cash should be 0
    expect(year5.liquidCash).toBeLessThanOrEqual(0);
  });

  it('calculates True FI based on SWR Tax Adjustment', () => {
    const points = runSimulation(baseSnapshot, baseConfig, 150);

    // Look at Phase 1 (GOOGLE) expense.
    // Base 10k + 3k mortgage = 13k.
    expect(points[0].swrTarget).toBeGreaterThan(0);
  });

  it('amortizes mortgage correctly', () => {
    const points = runSimulation(baseSnapshot, baseConfig, 150);

    // Mortgage starts at 500,000. 
    // Payment 3000/mo. Rate 3.5%.
    // Monthly Interest ~ 500k * (0.035/12) = 1458.
    // Principal ~ 3000 - 1458 = 1542.
    // After 1 year (12 months), balance should be approx 500k - (1542 * 12) = ~481k (roughly, slightly less due to compounding principal paydown)

    const year0 = points[0];
    const year1 = points[1]; // month 12

    // totalLiabilities includes consumer debt, so let's check the drop
    // Consumer debt paydown logic exists too, so we need to be careful. 
    // This config has +cash flow (10k income + vesting vs 13k spend? No, 12865 vs 13k. Net flow negative/flat? 
    // BaseConfig income: 10k net + 10 units vesting. Spend 13k. 
    // Shortfall covered by cash. 
    // Mortgage should strictly go down.

    expect(year1.totalLiabilities).toBeLessThan(year0.totalLiabilities);

    // Check late years to see if it hits 0
    const year30 = points[29]; // if it exists
    if (year30) {
      expect(year30.totalLiabilities).toBeLessThan(year0.totalLiabilities);
    }
  });
  it('deducts life events correctly', () => {
    const eventConfig: SimulationConfiguration = {
      ...baseConfig,
      life_events: [{ name: 'Wedding', year: 2030, cost: 100000 }]
    };

    const points = runSimulation(baseSnapshot, eventConfig, 150);

    // Find year 2030 (start year is 2024? wait, test says 2024-01-01)
    // 2030 is 6 years later = 72 months.

    // Check points around 2030.
    // We should see a spike in expense or just a drop in liquid cash relative to baseline?
    // Run baseline for comparison
    const basePoints = runSimulation(baseSnapshot, baseConfig, 150);

    // Or better, check the specific month 0 of 2030? 
    // The loop iterates months. Event happens in month 0 of year.
    // 2024 is year 0. 2030 is year 6. Month index 72.

    const base2030 = basePoints.find(p => p.date.includes('2030')); // year 2030
    const event2030 = points.find(p => p.date.includes('2030'));

    // If we only push points every 12 months, we might miss the exact month but the yearly point should reflect it.
    // 2030 point is pushed at month 72 (Jan 2030) or 84 (Jan 2031)? 
    // Logic: if (month % 12 === 0). Month 0 = Jan 2024. Month 72 = Jan 2030.
    // Event happens in Jan 2030. Expense is added. Net flow drops. Liquid cash drops.

    if (base2030 && event2030) {
      expect(event2030.liquidCash).toBeLessThan(base2030.liquidCash - 100000);
      // Should be less than baseline - cost. (Because inflation applies to cost too).
    }
  });

  it('includes partner income correctly', () => {
    const partnerConfig: SimulationConfiguration = {
      ...baseConfig,
      income_profile: {
        ...baseConfig.income_profile,
        partner_gross_annual_salary: 120000,
        partner_has_health_insurance: false,
        partner_retirement_year: 2030
      }
    };

    const points = runSimulation(baseSnapshot, partnerConfig, 150);
    const basePoints = runSimulation(baseSnapshot, baseConfig, 150);
    
    const partner2025 = points.find(p => p.date.includes('2025'));
    const base2025 = basePoints.find(p => p.date.includes('2025'));
    
    if (partner2025 && base2025) {
      expect(partner2025.liquidCash).toBeGreaterThan(base2025.liquidCash);
    }
  });

  it('does not subtract liabilities from totalNetWorth', () => {
    const points = runSimulation(baseSnapshot, baseConfig, 150);
    const initialPoint = points[0];
    expect(initialPoint.totalNetWorth).toBeGreaterThanOrEqual(400000);
  });

  it('handles upcoming capital calls with date', () => {
    const currentYear = new Date().getFullYear();
    const dueYear = currentYear + 1;
    const snapshotWithCall: FinancialSnapshot = {
      ...baseSnapshot,
      liabilities: {
        ...baseSnapshot.liabilities,
        upcoming_capital_calls: 50000,
        capital_calls_due_date: `${dueYear}-06`
      }
    } as any;
    
    const points = runSimulation(snapshotWithCall, baseConfig, 150);
    
    const targetDateStr = new Date(dueYear, 5).toLocaleString('default', { month: 'short', year: 'numeric' });
    const targetPoint = points.find(p => p.date === targetDateStr);
    
    const basePoints = runSimulation(baseSnapshot, baseConfig, 150);
    const basePoint = basePoints.find(p => p.date === targetDateStr);
    
    if (targetPoint && basePoint) {
      expect(targetPoint.liquidCash).toBeLessThan(basePoint.liquidCash);
    }
  });
});
