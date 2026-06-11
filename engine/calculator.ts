export interface FinancialSnapshot {
  snapshot_date: string;
  share_counts: {
    google_shares: number;
    cost_basis?: number;
    live_stock_price?: number;
  };
  liquid_assets: {
    vanguard_bridge: number;
    cash_savings: number;
    google_equity_value: number;
  };
  retirement_assets: {
    k401: number;
    roth_ira: number;
    traditional_ira: number;
  };
  education_assets: {
    total_529: number;
    accounts: { id: string; name: string; balance: number }[];
  };
  liabilities: {
    mortgage_balance: number;
    mortgage_interest_rate?: number;
    mortgage_payoff_date?: string;
    consumer_debt: number;
    consumer_debt_payoff_date?: string;
    upcoming_capital_calls: number;
    capital_calls_due_date?: string;
  };
  other_investments: Array<{
    id: string;
    name: string;
    symbol: string;
    shares: number;
    cost_basis: number;
    current_price: number;
    expected_return?: number;
  }>;
  last_updated?: number;
}

export interface SimulationConfiguration {
  career_path: {
    exit_year: number;
    use_jump: boolean;
    jump_duration: number;
    use_sabbatical: boolean;
    sabbatical_duration: number;
    use_bridge: boolean;
    bridge_duration: number;
  };
  income_profile: {
    gross_annual_salary: number;
    google_net_monthly: number;
    initial_unvested_shares: number;
    vesting_years: number;
    jump_gross_annual: number;
    jump_bonus_rate: number;
    jump_grant_monthly: number;
    bridge_gross_annual: number;
    bridge_has_health_insurance?: boolean;
    income_growth_rate: number;   // Nominal annual raise % (NOT stacked on top of inflation)
    target_bonus_rate: number;
    annual_equity_grant: number;
    monthly_rental_income: number;
    use_partner_income?: boolean;
    partner_gross_annual_salary?: number;
    partner_employment_start_year?: number;
    partner_has_health_insurance?: boolean;
    partner_retirement_year?: number;
  };
  market_assumptions: {
    goog_growth_rate: number;
    market_return_rate: number;
    inflation_rate: number;
    volatility_drag: number;
  };
  tax_assumptions: {
    filing_status: 'single' | 'married_joint' | 'married_separate' | 'head_household';
    state_of_residence: 'CA' | 'WA' | 'TX' | 'NY' | 'NONE';
  };
  divestment_strategy: {
    type: 'none' | 'immediate' | 'progressive';
    start_year: number;
    end_year: number;
  };
  spending: {
    monthly_lifestyle: number;
    empty_nest_year?: number;
    empty_nest_monthly_spend?: number;
    healthcare_premium: number;
    mortgage_payment: number;
  };
  birth_year: number;
  social_security: {
    start_age: number;
    monthly_amount: number;
  };
  medicare: {
    start_age: number;
    monthly_premium: number;
  };
  life_events: Array<{
    name: string;
    year: number;
    cost: number;
  }>;
}

export interface TrajectoryPoint {
  date: string;
  monthIndex: number;
  liquidCash: number;
  retirement: number;
  googValue: number;
  totalNetWorth: number;
  totalLiabilities: number;
  isIndependent: boolean;
  swrTarget: number;
  currentPhase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED';
  rentalIncome: number;
  healthcareCost: number;
  totalCompensation: number;
  accumulatedReturns: number;
  mortgagePayment: number;
  lifestyleExpense: number;
  socialSecurityIncome: number;
  educationAssets: number;
}

import { calculateTax } from './tax_engine';

export const runSimulation = (
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  live_price_input: number
): TrajectoryPoint[] => {
  const points: TrajectoryPoint[] = [];

  const live_price = live_price_input > 0 ? live_price_input : 175.00;

  const incomeProfile = config.income_profile;
  const jumpGrossAnnual   = incomeProfile.jump_gross_annual   || 275_000;
  const bridgeGrossAnnual = incomeProfile.bridge_gross_annual || 220_000;

  const JUMP_EQUITY_GROWTH = 0.08;
  const RENTAL_GROWTH_RATE = 0.074; // User-specified — kept as-is

  const startYear  = new Date().getFullYear();
  const startMonth = new Date().getMonth();

  // ── Initial balances ───────────────────────────────────────────────────────
  let liquidCash  = snapshot.liquid_assets.vanguard_bridge + snapshot.liquid_assets.cash_savings;
  let retirement  = snapshot.retirement_assets.k401 + snapshot.retirement_assets.roth_ira + snapshot.retirement_assets.traditional_ira;

  // GOOG from portfolio (preferred) + legacy share_counts field
  const googInvs  = snapshot.other_investments?.filter(inv => inv.symbol === 'GOOG' || inv.symbol === 'GOOGL') ?? [];
  const googFromPortfolio = googInvs.reduce((s, inv) => s + inv.shares, 0);
  let currentGoogShares   = googFromPortfolio + (snapshot.share_counts.google_shares || 0);
  const currentGoogByBasis: { shares: number; basis: number }[] = [
    { shares: currentGoogShares, basis: snapshot.share_counts.cost_basis || 0 },
  ];

  let currentGoogPrice    = live_price;
  let currentJumpStockValue = 0;
  let current529          = (snapshot.education_assets.accounts || []).reduce((s, a) => s + a.balance, 0);
  let currentMortgage     = snapshot.liabilities.mortgage_balance;
  let currentConsumerDebt = snapshot.liabilities.consumer_debt;

  const mortgageRate = snapshot.liabilities.mortgage_interest_rate || 3.5;
  const mortgagePayoffDate = snapshot.liabilities.mortgage_payoff_date
    ? new Date(snapshot.liabilities.mortgage_payoff_date)
    : new Date(2051, 5, 1);

  // Career phase boundaries
  const sabbaticalEndYear = config.career_path.exit_year + (config.career_path.use_sabbatical ? config.career_path.sabbatical_duration : 0);
  const jumpEndYear       = sabbaticalEndYear + (config.career_path.use_jump   ? config.career_path.jump_duration   : 0);
  const bridgeEndYear     = jumpEndYear       + (config.career_path.use_bridge ? config.career_path.bridge_duration : 0);

  // Non-GOOG investments
  const currentOtherInvestments = (snapshot.other_investments ?? [])
    .filter(inv => inv.symbol !== 'GOOG' && inv.symbol !== 'GOOGL')
    .map(inv => ({
      ...inv,
      currentValue:   (inv.shares * inv.current_price) || 0,
      expectedReturn: inv.expected_return ?? config.market_assumptions.market_return_rate,
    }));

  // ── Main loop (360 months = 30 years) ─────────────────────────────────────
  for (let month = 0; month < 360; month++) {

    const totalMonths = startMonth + month;
    const currentYear = startYear + Math.floor(totalMonths / 12);
    const monthOfYear = totalMonths % 12;
    const currentDate = new Date(currentYear, monthOfYear, 1);
    const yearsPassed = month / 12;

    const effectiveMarketReturn = Math.max(0, config.market_assumptions.market_return_rate - config.market_assumptions.volatility_drag);

    // ── Asset growth ───────────────────────────────────────────────────────
    currentGoogPrice      *= (1 + config.market_assumptions.goog_growth_rate / 12 / 100);
    currentJumpStockValue *= (1 + JUMP_EQUITY_GROWTH / 12);
    liquidCash  *= (1 + effectiveMarketReturn / 12 / 100);
    retirement  *= (1 + effectiveMarketReturn / 12 / 100);
    current529  *= (1 + config.market_assumptions.market_return_rate / 12 / 100);

    let totalOtherInvestmentsValue = 0;
    for (const inv of currentOtherInvestments) {
      const growthRate = Math.max(0, inv.expectedReturn - config.market_assumptions.volatility_drag);
      inv.currentValue *= (1 + growthRate / 12 / 100);
      totalOtherInvestmentsValue += inv.currentValue;
    }

    // ── Phase determination ────────────────────────────────────────────────
    let phase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED' = 'GOOGLE';

    // FIX #8: income_growth_rate is treated as pure nominal raise (not stacked on inflation)
    const nominalIncomeGrowth   = (incomeProfile.income_growth_rate || 0) / 100;
    const salaryGrowthMultiplier = Math.pow(1 + nominalIncomeGrowth, yearsPassed);
    const inflationMultiplier   = Math.pow(1 + config.market_assumptions.inflation_rate / 100, yearsPassed);

    let annualBaseSalary  = 0;
    let annualTargetBonus = 0;

    if (currentYear < config.career_path.exit_year) {
      phase = 'GOOGLE';
      const base = incomeProfile.gross_annual_salary || 0;
      annualBaseSalary  = base * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((incomeProfile.target_bonus_rate || 0) / 100);
    } else if (currentYear < sabbaticalEndYear) {
      phase = 'SABBATICAL';
    } else if (currentYear < jumpEndYear) {
      phase = 'JUMP';
      annualBaseSalary  = jumpGrossAnnual * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((incomeProfile.jump_bonus_rate || 0) / 100);
    } else if (currentYear < bridgeEndYear) {
      phase = 'BRIDGE';
      annualBaseSalary = bridgeGrossAnnual * inflationMultiplier;
    } else {
      phase = 'RETIRED';
    }

    // ── Partner income ─────────────────────────────────────────────────────
    const partnerStarts  = incomeProfile.partner_employment_start_year ?? currentYear;
    const partnerRetires = incomeProfile.partner_retirement_year ?? 2030;
    let annualPartnerGross = 0;
    if (incomeProfile.use_partner_income && incomeProfile.partner_gross_annual_salary &&
        currentYear >= partnerStarts && currentYear < partnerRetires) {
      annualPartnerGross = incomeProfile.partner_gross_annual_salary * salaryGrowthMultiplier;
    }

    // FIX #6: Rental income is FICA-exempt (passed separately to tax engine)
    const rentalIncome    = (incomeProfile.monthly_rental_income || 0)
      * Math.pow(1 + RENTAL_GROWTH_RATE, Math.floor(yearsPassed));
    const annualRentalGross = rentalIncome * 12;

    // ── RSU vesting ────────────────────────────────────────────────────────
    let monthlyEquityVestUnits = 0;

    if (phase === 'GOOGLE') {
      // Initial grant — linear monthly vesting over vesting_years
      let initialGrantUnits = 0;
      if (yearsPassed < (incomeProfile.vesting_years || 4)) {
        const vestingMonths = (incomeProfile.vesting_years || 4) * 12;
        initialGrantUnits = (incomeProfile.initial_unvested_shares || 0) / vestingMonths;
      }

      // FIX #7: Refresher grants — allow prior-year grants (grantYear can be negative,
      // meaning the grant was made before simulation start; Ryan has stacked grants from
      // prior years already in flight). Use live_price (today's price) for historic grants.
      const grantValue = incomeProfile.annual_equity_grant || 0;
      let refresherUnits = 0;
      const vestingPeriodYears = 4;

      for (let i = 0; i < vestingPeriodYears; i++) {
        const grantYear = Math.floor(yearsPassed) - i;
        // grantYear >= 0: grant made after sim start → project price forward
        // grantYear < 0:  grant made before sim start → use live_price as grant price
        const grantTimeYears = Math.max(0, grantYear);
        const projectedPrice = live_price * Math.pow(1 + config.market_assumptions.goog_growth_rate / 100, grantTimeYears);
        const priceAtGrant   = Math.max(0.1, projectedPrice);

        // Grant value: only grow for future grants, not past ones
        const grantValueAtTime = grantValue * Math.pow(1 + nominalIncomeGrowth, grantTimeYears);
        const totalUnitsForGrant = grantValueAtTime / priceAtGrant;
        refresherUnits += totalUnitsForGrant / 48; // 4-year vest → 48 monthly increments
      }

      monthlyEquityVestUnits = initialGrantUnits + refresherUnits;
    }

    const annualRSUValue = monthlyEquityVestUnits * 12 * currentGoogPrice;

    // Jump grant
    const jumpGrantMonthlyGross = (phase === 'JUMP')
      ? incomeProfile.jump_grant_monthly * salaryGrowthMultiplier
      : 0;
    const annualJumpGrantValue = jumpGrantMonthlyGross * 12;

    // ── Tax calculation ────────────────────────────────────────────────────
    // W2 ordinary income: salary + bonus + partner + RSUs + jump grant
    const annualW2Gross = annualBaseSalary + annualTargetBonus + annualPartnerGross + annualRSUValue + annualJumpGrantValue;

    const taxResult = calculateTax({
      filingStatus:       config.tax_assumptions.filing_status,
      state:              config.tax_assumptions.state_of_residence,
      grossIncome:        annualW2Gross,
      ficaExemptIncome:   annualRentalGross,  // FIX #6: rental not subject to FICA
      longTermCapitalGains:  0,
      shortTermCapitalGains: 0,
    });

    // FIX #5: Use ordinaryEffectiveRate (not blended MAGI rate) for salary/bonus/rental
    const ordinaryEffRate = taxResult.ordinaryEffectiveRate;
    // FIX #4: Use marginalRate for RSU vesting (taxed at top marginal bracket)
    const marginalRate    = taxResult.marginalRate;

    // ── Net monthly cash flows ─────────────────────────────────────────────
    const isBonusMonth        = (month % 12 === 2); // March payout
    const monthlySalaryNet    = (annualBaseSalary    / 12) * (1 - ordinaryEffRate);
    const monthlyBonusNet     = isBonusMonth ? annualTargetBonus * (1 - ordinaryEffRate) : 0;
    const monthlyPartnerNet   = (annualPartnerGross  / 12) * (1 - ordinaryEffRate);
    const monthlyRentalNet    = (annualRentalGross   / 12) * (1 - ordinaryEffRate);

    const monthlyOrdinayNet = monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet + monthlyRentalNet;

    // FIX #4: RSU shares added at marginal (not effective) rate
    if (monthlyEquityVestUnits > 0) {
      const netNewShares = monthlyEquityVestUnits * (1 - marginalRate);
      currentGoogShares += netNewShares;
      currentGoogByBasis.push({ shares: netNewShares, basis: currentGoogPrice });
    }

    if (jumpGrantMonthlyGross > 0) {
      currentJumpStockValue += jumpGrantMonthlyGross * (1 - marginalRate);
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    const emptyNestYear  = config.spending.empty_nest_year ?? 3_000;
    const baseMonthlySpend = (currentYear >= emptyNestYear && config.spending.empty_nest_monthly_spend)
      ? config.spending.empty_nest_monthly_spend
      : config.spending.monthly_lifestyle;

    let expense = baseMonthlySpend * inflationMultiplier;

    const currentAge = currentYear - (config.birth_year || 1980);

    // Social Security
    let socialSecurityIncome = 0;
    if (config.social_security && currentAge >= config.social_security.start_age) {
      socialSecurityIncome = config.social_security.monthly_amount * inflationMultiplier;
      liquidCash += socialSecurityIncome;
    }

    // Healthcare
    let currentHealthcareCost = 0;
    const partnerIsWorking = incomeProfile.use_partner_income &&
      incomeProfile.partner_has_health_insurance &&
      currentYear >= partnerStarts && currentYear < partnerRetires;
    const bridgeCovered = (phase === 'BRIDGE') && !!incomeProfile.bridge_has_health_insurance;
    const hasEmployerCoverage = phase === 'GOOGLE' || phase === 'JUMP' || partnerIsWorking || bridgeCovered;

    if (!hasEmployerCoverage) {
      if (config.medicare && currentAge >= config.medicare.start_age) {
        currentHealthcareCost = config.medicare.monthly_premium * inflationMultiplier;
      } else {
        currentHealthcareCost = config.spending.healthcare_premium * inflationMultiplier;
      }
      expense += currentHealthcareCost;
    }

    // Mortgage
    const hasMortgage = currentDate < mortgagePayoffDate;
    if (hasMortgage) {
      expense += config.spending.mortgage_payment;
      if (currentMortgage > 0) {
        const monthlyRate      = (mortgageRate / 100) / 12;
        const interestPayment  = currentMortgage * monthlyRate;
        const principalPayment = config.spending.mortgage_payment - interestPayment;
        if (principalPayment > 0) currentMortgage -= principalPayment;
        if (currentMortgage < 0) currentMortgage = 0;
      }
    }

    // FIX #3: Life events — each college event represents ONE year of tuition,
    // paid in January of that year. No more 4-year spreading.
    if (config.life_events) {
      for (const event of config.life_events) {
        if (event.year === currentYear && currentDate.getMonth() === 0) {
          const inflatedCost = event.cost * inflationMultiplier;
          const isCollege    = event.name.toLowerCase().includes('college');
          if (isCollege) {
            // Draw from 529 first, then cash
            if (current529 >= inflatedCost) {
              current529 -= inflatedCost;
            } else {
              const remaining = inflatedCost - current529;
              current529 = 0;
              expense += remaining;
            }
          } else {
            expense += inflatedCost;
          }
        }
      }
    }

    // Capital calls
    if (snapshot.liabilities.upcoming_capital_calls > 0 && snapshot.liabilities.capital_calls_due_date) {
      const due = new Date(snapshot.liabilities.capital_calls_due_date);
      if (currentDate.getFullYear() === due.getFullYear() && currentDate.getMonth() === due.getMonth()) {
        expense += snapshot.liabilities.upcoming_capital_calls;
      }
    }

    // ── Divestment (progressive or immediate) ─────────────────────────────
    let divestmentProceeds = 0;

    if (config.divestment_strategy.type === 'progressive') {
      const totalWindowMonths = (config.divestment_strategy.end_year - config.divestment_strategy.start_year) * 12;
      const monthsElapsed     = (currentYear - config.divestment_strategy.start_year) * 12 + monthOfYear;

      if (monthsElapsed >= 0 && monthsElapsed < totalWindowMonths && currentGoogShares > 0) {
        const remainingMonths = totalWindowMonths - monthsElapsed;
        const sharesToSell    = currentGoogShares / remainingMonths;
        const grossSale       = sharesToSell * currentGoogPrice;

        const totalBasis  = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalShares = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis    = totalShares > 0 ? totalBasis / totalShares : 0;
        const capGain     = Math.max(0, grossSale - sharesToSell * avgBasis);

        // Tax on annualized LTCG (stacked on ordinary income)
        const annualOrdinary = annualW2Gross + annualRentalGross;
        const annualLTCG     = capGain * 12;

        const baseTax    = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualOrdinary, ficaExemptIncome: annualRentalGross, longTermCapitalGains: 0, shortTermCapitalGains: 0 });
        const withSaleTax = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualOrdinary, ficaExemptIncome: annualRentalGross, longTermCapitalGains: annualLTCG, shortTermCapitalGains: 0 });

        const divestmentTax = (withSaleTax.totalTax - baseTax.totalTax) / 12;
        divestmentProceeds  = grossSale - divestmentTax;
        currentGoogShares  -= sharesToSell;
      }

    } else if (config.divestment_strategy.type === 'immediate') {
      const isExitTime = (currentYear === config.career_path.exit_year && monthOfYear === 0);
      if (isExitTime && currentGoogShares > 0) {
        const grossProceeds = currentGoogShares * currentGoogPrice;
        const totalBasis    = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalShares   = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis      = totalShares > 0 ? totalBasis / totalShares : 0;
        const gain          = Math.max(0, grossProceeds - currentGoogShares * avgBasis);

        const annualOrdinary = annualW2Gross + annualRentalGross;
        const baseTax     = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualOrdinary, ficaExemptIncome: annualRentalGross, longTermCapitalGains: 0,    shortTermCapitalGains: 0 });
        const withSaleTax  = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualOrdinary, ficaExemptIncome: annualRentalGross, longTermCapitalGains: gain, shortTermCapitalGains: 0 });

        const divestmentTax = withSaleTax.totalTax - baseTax.totalTax;
        divestmentProceeds  = grossProceeds - divestmentTax;
        currentGoogShares   = 0;
      }
    }

    liquidCash += divestmentProceeds;

    // ── Net cash flow ──────────────────────────────────────────────────────
    const netFlow = monthlyOrdinayNet - expense;
    liquidCash += netFlow;

    // Consumer debt paydown when flush
    if (liquidCash > 50_000 && currentConsumerDebt > 0) {
      const paydown = Math.min(liquidCash - 50_000, currentConsumerDebt);
      currentConsumerDebt -= paydown;
      liquidCash -= paydown;
    }

    // ── Deficit handling ──────────────────────────────────────────────────
    if (liquidCash < 0) {
      const deficit = Math.abs(liquidCash);
      liquidCash = 0;

      // Use marginal rate for emergency sale tax estimate
      const emergencyTaxRate = Math.min(0.55, marginalRate + 0.05); // cap at 55%

      const totalBasis  = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
      const totalShares = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
      const avgBasis    = totalShares > 0 ? totalBasis / totalShares : 0;
      const netPerShare = currentGoogPrice - (emergencyTaxRate * Math.max(0, currentGoogPrice - avgBasis));

      if (currentGoogShares * netPerShare >= deficit) {
        currentGoogShares -= deficit / Math.max(0.01, netPerShare);
      } else {
        const proceed = currentGoogShares * netPerShare;
        currentGoogShares = 0;
        let remaining = deficit - proceed;
        if (currentJumpStockValue * 0.75 >= remaining) {
          currentJumpStockValue -= remaining / 0.75;
        } else {
          remaining -= currentJumpStockValue * 0.75;
          currentJumpStockValue = 0;
          retirement -= remaining / 0.70; // ~30% tax + penalty on retirement withdrawal
        }
      }
    }

    // ── Derived values ────────────────────────────────────────────────────
    const currentGoogValue = Math.max(0, currentGoogShares * currentGoogPrice);
    const totalLiabilities = currentMortgage + currentConsumerDebt;

    // FIX #2: Net worth properly subtracts all liabilities
    const totalNetWorth = liquidCash + retirement + currentGoogValue
      + currentJumpStockValue + totalOtherInvestmentsValue + current529
      - currentMortgage - currentConsumerDebt;

    const investableAssets = liquidCash + retirement + currentGoogValue
      + currentJumpStockValue + totalOtherInvestmentsValue;

    // FIX #9: SWR target uses normalized retirement-phase spending (no mortgage,
    // no one-time events — those are temporary). This prevents college tuition
    // spikes from creating false "not FI" signals during the accumulation years.
    const swrBaseSpend = (baseMonthlySpend + currentHealthcareCost) * inflationMultiplier;
    const taxDrag      = phase === 'RETIRED' ? 0.20 : 0.25;
    const rawSWRTarget      = (swrBaseSpend * 12) / 0.04;
    const adjustedSWRTarget = rawSWRTarget / (1 - taxDrag);

    const isIndependent = adjustedSWRTarget > 0 && (investableAssets / adjustedSWRTarget) >= 1.0;

    // ── Charting fields ───────────────────────────────────────────────────
    const equityPart = monthlyEquityVestUnits > 0
      ? monthlyEquityVestUnits * (1 - marginalRate) * currentGoogPrice
      : 0;
    const jumpStockPart = jumpGrantMonthlyGross > 0
      ? jumpGrantMonthlyGross * (1 - marginalRate)
      : 0;

    const annualizedComp =
      (monthlyOrdinayNet + equityPart + jumpStockPart + socialSecurityIncome) * 12;

    const currentMortgagePayment = hasMortgage ? config.spending.mortgage_payment : 0;
    const currentLifestyle       = baseMonthlySpend * inflationMultiplier;

    points.push({
      date:       currentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
      monthIndex: month,
      liquidCash: Math.round(liquidCash),
      retirement: Math.round(retirement),
      googValue:  Math.round(currentGoogValue),
      totalNetWorth:    Math.round(totalNetWorth),
      totalLiabilities: Math.round(totalLiabilities),
      isIndependent,
      swrTarget:  Math.round(adjustedSWRTarget),
      currentPhase: phase,
      rentalIncome:       Math.round(rentalIncome * 12),
      healthcareCost:     Math.round(currentHealthcareCost * 12),
      totalCompensation:  Math.round(annualizedComp),
      accumulatedReturns: 0,
      mortgagePayment:    Math.round(currentMortgagePayment * 12),
      lifestyleExpense:   Math.round(currentLifestyle * 12),
      socialSecurityIncome: Math.round(socialSecurityIncome * 12),
      educationAssets:    Math.round(current529),
    });
  }

  return points;
};
