export interface FinancialSnapshot {
  snapshot_date: string;
  share_counts: {
    google_shares: number;
    cost_basis?: number; // Added to enable accurate capital gains calculation
    live_stock_price?: number; // Added to match PRD state tracking
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
    total_529: number; // Keep for legacy/migration if needed, or remove? Plan said remove legacy.
    // Let's keep it as a getter or just replace it? 
    // Plan: `accounts: { id: string; name: string; balance: number }[]`
    accounts: { id: string; name: string; balance: number }[];
  };
  liabilities: {
    mortgage_balance: number;
    mortgage_interest_rate?: number; // Optional override
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
    expected_return?: number; // Optional override for market return
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
    gross_annual_salary: number; // Added for manual entry
    google_net_monthly: number;
    initial_unvested_shares: number; // New: Total count of unvested shares
    vesting_years: number; // New: Years remaining for unvested block
    // google_vesting_units_monthly: number; // DEPRECATED
    jump_gross_annual: number; // Replaces jump_net_monthly
    jump_bonus_rate: number;
    jump_grant_monthly: number; // $ value
    bridge_gross_annual: number;
    bridge_has_health_insurance?: boolean;
    // New fields for detailed modeling
    income_growth_rate: number; // Annual % increase
    target_bonus_rate: number; // % of annual salary
    annual_equity_grant: number; // $ value or units? Let's use $ value for simplicity in new model
    monthly_rental_income: number; // New: Rental income
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
    empty_nest_year?: number; // Optional, defaults to exit_year + something or user input
    empty_nest_monthly_spend?: number; // Optional
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
  date: string;       // ISO Date or Month/Year label
  monthIndex: number; // 0 to 360
  liquidCash: number;
  retirement: number;
  googValue: number;
  totalNetWorth: number;
  totalLiabilities: number;
  isIndependent: boolean;
  swrTarget: number;
  currentPhase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED';
  // New fields for granular charting
  rentalIncome: number;
  healthcareCost: number;
  totalCompensation: number; // Salary + Bonus + Equity + Rental
  accumulatedReturns: number; // Estimated total investment growth
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

  // Fallback if live_price is 0 (API down) to ensure equity value shows up
  const live_price = live_price_input > 0 ? live_price_input : 315.00;

  const incomeProfile = config.income_profile;

  const jumpGrossAnnual = incomeProfile.jump_gross_annual || 275000;

  const bridgeGrossAnnual = incomeProfile.bridge_gross_annual || 220000;

  const JUMP_EQUITY_GROWTH = 0.08;
  const RENTAL_GROWTH_RATE = 0.074;

  const startYear = new Date().getFullYear();
  const startMonth = new Date().getMonth();

  // Always start simulation from current date to ensure accurate "today" values
  // and avoid using stale snapshot_date from local storage.

  let liquidCash = snapshot.liquid_assets.vanguard_bridge + snapshot.liquid_assets.cash_savings;
  let retirement = snapshot.retirement_assets.k401 + snapshot.retirement_assets.roth_ira + snapshot.retirement_assets.traditional_ira;

  // Extract GOOG shares from other_investments
  const googleInvestments = snapshot.other_investments?.filter(inv =>
    inv.symbol === 'GOOG' || inv.symbol === 'GOOGL'
  ) || [];

  const initialGoogSharesFromPortfolio = googleInvestments.reduce((sum, inv) => sum + inv.shares, 0);

  // We use the Portfolio GOOG shares + any legacy google_shares input (if we want to keep it valid for now, or just ignore it)
  // Let's rely ONLY on portfolio if we want to force the migration, but for safety lets add them just in case user has data there?
  // User plan said: "Remove Google input". So we can ignore `snapshot.share_counts.google_shares` or add it.
  // Let's add it to be safe during transition, but effectively it should be 0 from the UI.
  let currentGoogShares = initialGoogSharesFromPortfolio + (snapshot.share_counts.google_shares || 0);

  const currentGoogByBasis = [{ shares: currentGoogShares, basis: snapshot.share_counts.cost_basis || 0 }];

  let currentGoogPrice = live_price;
  let currentJumpStockValue = 0;
  let current529 = (snapshot.education_assets.accounts || []).reduce((sum, acc) => sum + acc.balance, 0);

  let currentMortgage = snapshot.liabilities.mortgage_balance;
  let currentConsumerDebt = snapshot.liabilities.consumer_debt;
  const mortgageRate = snapshot.liabilities.mortgage_interest_rate || 3.5;
  const mortgagePayoffDate = snapshot.liabilities.mortgage_payoff_date 
    ? new Date(snapshot.liabilities.mortgage_payoff_date) 
    : new Date(2051, 5, 1); // Default June 2051

  const sabbaticalEndYear = config.career_path.exit_year + (config.career_path.use_sabbatical ? config.career_path.sabbatical_duration : 0);
  const jumpEndYear = sabbaticalEndYear + (config.career_path.use_jump ? config.career_path.jump_duration : 0);
  const bridgeEndYear = jumpEndYear + (config.career_path.use_bridge ? config.career_path.bridge_duration : 0);

  // Helper to estimate Gross from Net (rough heuristic for Phase 1 to allow tax stacking)
  const estimateGross = (net: number) => net / 0.65;

  // Track Other Investments (Excluding GOOG/GOOGL)
  const currentOtherInvestments = snapshot.other_investments?.filter(inv =>
    inv.symbol !== 'GOOG' && inv.symbol !== 'GOOGL'
  ).map(inv => ({
    ...inv,
    currentValue: (inv.shares * inv.current_price) || inv.cost_basis, // Fallback
    expectedReturn: inv.expected_return !== undefined ? inv.expected_return : config.market_assumptions.market_return_rate
  })) || [];

  for (let month = 0; month < 360; month++) {

    const totalMonths = startMonth + month;
    const currentYear = startYear + Math.floor(totalMonths / 12);
    const monthOfYear = totalMonths % 12;
    const currentDate = new Date(currentYear, monthOfYear, 1);
    const yearsPassed = month / 12;

    const effectiveMarketReturn = Math.max(0, config.market_assumptions.market_return_rate - config.market_assumptions.volatility_drag);

    // Track monthly equity vesting for charts
    let monthlyEquityVestUnits = 0;

    currentGoogPrice *= (1 + (config.market_assumptions.goog_growth_rate / 12 / 100));
    currentJumpStockValue *= (1 + (JUMP_EQUITY_GROWTH / 12));
    liquidCash *= (1 + (effectiveMarketReturn / 12 / 100));
    retirement *= (1 + (effectiveMarketReturn / 12 / 100));

    // Education Savings grows at flat Market Return (7%) as requested, ignoring volatility drag
    current529 *= (1 + (config.market_assumptions.market_return_rate / 12 / 100));

    // Grow Other Investments
    let totalOtherInvestmentsValue = 0;
    currentOtherInvestments.forEach(inv => {
      const growthRate = inv.expectedReturn - config.market_assumptions.volatility_drag;
      const effectiveGrowth = Math.max(0, growthRate);
      inv.currentValue *= (1 + (effectiveGrowth / 12 / 100));
      totalOtherInvestmentsValue += inv.currentValue;
    });

    let phase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED' = 'GOOGLE';
    const monthlyNetInfo: { net: number, grossEst: number } = { net: 0, grossEst: 0 };

    // Inflation + Real Growth for salary
    const realIncomeGrowth = incomeProfile.income_growth_rate || 0;
    const combinedIncomeGrowth = (config.market_assumptions.inflation_rate + realIncomeGrowth) / 100;
    const salaryGrowthMultiplier = Math.pow(1 + combinedIncomeGrowth, yearsPassed);

    // Standard Inflation for expenses
    const standardInflationMultiplier = Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);

    // Phase and Salary Determination
    let annualBaseSalary = 0;
    let annualTargetBonus = 0;

    if (currentYear < config.career_path.exit_year) {
      phase = 'GOOGLE';
      const base = incomeProfile.gross_annual_salary || estimateGross(incomeProfile.google_net_monthly || 0) * 12;
      annualBaseSalary = base * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((incomeProfile.target_bonus_rate || 0) / 100);
    } else if (currentYear < sabbaticalEndYear) {
      phase = 'SABBATICAL';
    } else if (currentYear < jumpEndYear) {
      phase = 'JUMP';
      annualBaseSalary = jumpGrossAnnual * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((incomeProfile.jump_bonus_rate || 0) / 100);
    } else if (currentYear < bridgeEndYear) {
      phase = 'BRIDGE';
      annualBaseSalary = bridgeGrossAnnual * standardInflationMultiplier;
    } else {
      phase = 'RETIRED';
    }

    // Partner Income
    const partnerStarts = config.income_profile.partner_employment_start_year || currentYear;
    const partnerRetires = config.income_profile.partner_retirement_year || 2030;
    let annualPartnerGross = 0;
    if (config.income_profile.use_partner_income && 
        config.income_profile.partner_gross_annual_salary && 
        currentYear >= partnerStarts && 
        currentYear < partnerRetires) {
      annualPartnerGross = config.income_profile.partner_gross_annual_salary * salaryGrowthMultiplier;
    }

    // Rental Income
    const rentalIncome = (incomeProfile.monthly_rental_income || 0) * Math.pow(1 + RENTAL_GROWTH_RATE, Math.floor(yearsPassed));
    const annualRentalGross = rentalIncome * 12;

    // Monthly RSU Stacking Logic
    if (phase === 'GOOGLE') {
      // 1. Initial Grant Vesting
      let initialGrantVestingUnits = 0;
      if (yearsPassed < (incomeProfile.vesting_years || 4)) {
        const initialTotalShares = (incomeProfile.initial_unvested_shares || 0);
        const vestingMonths = (incomeProfile.vesting_years || 4) * 12;
        initialGrantVestingUnits = initialTotalShares / vestingMonths;
      }

      // 2. Refresher Stacking
      const grantValue = incomeProfile.annual_equity_grant || 0;
      let refresherUnits = 0;
      const vestingPeriodYears = 4;
      for (let i = 0; i < vestingPeriodYears; i++) {
        const grantYear = Math.floor(yearsPassed) - i;
        if (grantYear >= 0) {
          const grantTimeYears = grantYear;
          const projectedPrice = live_price * Math.pow(1 + (config.market_assumptions.goog_growth_rate / 100), grantTimeYears);
          const priceAtGrant = Math.max(0.1, projectedPrice);
          const grantValueAtTime = grantValue * Math.pow(1 + ((incomeProfile.income_growth_rate || 0) / 100), grantTimeYears);
          const totalUnitsForThisGrant = grantValueAtTime / priceAtGrant;
          const monthlyUnits = totalUnitsForThisGrant / 48;
          refresherUnits += monthlyUnits;
        }
      }
      monthlyEquityVestUnits = initialGrantVestingUnits + refresherUnits;
    }

    const annualRSUValue = (monthlyEquityVestUnits * 12) * currentGoogPrice;
    
    // Jump Grant Value
    const jumpGrantMonthlyGross = phase === 'JUMP' ? (incomeProfile.jump_grant_monthly * salaryGrowthMultiplier) : 0;
    const annualJumpGrantValue = jumpGrantMonthlyGross * 12;

    // Aggregate Total Annual Ordinary Gross
    const totalAnnualGross = annualBaseSalary + annualTargetBonus + annualPartnerGross + annualRentalGross + annualRSUValue + annualJumpGrantValue;

    // Calculate Effective Tax Rate on Stacked Income
    const taxResult = calculateTax({
      filingStatus: config.tax_assumptions.filing_status,
      state: config.tax_assumptions.state_of_residence,
      grossIncome: totalAnnualGross,
      longTermCapitalGains: 0,
      shortTermCapitalGains: 0
    });
    const effectiveTaxRate = taxResult.effectiveRate;

    // Calculate Net Flows
    const isBonusMonth = (month % 12 === 2);
    const monthlySalaryNet = (annualBaseSalary / 12) * (1 - effectiveTaxRate);
    const monthlyBonusNet = isBonusMonth ? (annualTargetBonus * (1 - effectiveTaxRate)) : 0;
    const monthlyPartnerNet = (annualPartnerGross / 12) * (1 - effectiveTaxRate);
    const monthlyRentalNet = (annualRentalGross / 12) * (1 - effectiveTaxRate);

    // Set Shared Object State for downstream calculations
    monthlyNetInfo.net = monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet + monthlyRentalNet;
    monthlyNetInfo.grossEst = totalAnnualGross / 12;

    // Apply Net RSU Units to Portfolio (Sell-to-Cover approximation)
    if (monthlyEquityVestUnits > 0) {
      const netNewShares = monthlyEquityVestUnits * (1 - effectiveTaxRate);
      currentGoogShares += netNewShares;
      currentGoogByBasis.push({ shares: netNewShares, basis: currentGoogPrice });
    }

    // Apply Net Jump Stock Grant to Portfolio
    if (jumpGrantMonthlyGross > 0) {
      currentJumpStockValue += jumpGrantMonthlyGross * (1 - effectiveTaxRate);
    }

    // Determine base monthly lifestyle based on Empty Nest phase
    const emptyNestStartYear = config.spending.empty_nest_year || 3000; // Default far future if not set
    const baseMonthlySpend = (currentYear >= emptyNestStartYear && config.spending.empty_nest_monthly_spend)
      ? config.spending.empty_nest_monthly_spend
      : config.spending.monthly_lifestyle;

    let expense = baseMonthlySpend * Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);

    // Age Calculation
    const birthYear = config.birth_year || 1980; // Default to 1980 if missing
    const currentAge = currentYear - birthYear;

    // Social Security Income
    let socialSecurityIncome = 0;
    if (config.social_security && currentAge >= config.social_security.start_age) {
      // Assume full benefit, potentially indexed for inflation? 
      // User likely provided today's dollars. So we inflate it.
      const inflationMultiplier = Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);
      socialSecurityIncome = config.social_security.monthly_amount * inflationMultiplier;

      // Add to liquid cash flow
      liquidCash += socialSecurityIncome;
    }

    // Medicare Logic (Overrides private healthcare)
    // Healthcare is NOT charged during GOOG or JUMP (Employer covered)
    // Healthcare IS charged during SABBATICAL, BRIDGE (maybe?), RETIRED
    // User spec: "If I jump to a new career I will still have health insurance" -> JUMP has coverage.
    let currentHealthcareCost = 0;
    const partnerIsWorking = config.income_profile.use_partner_income && config.income_profile.partner_has_health_insurance && currentYear >= partnerStarts && currentYear < partnerRetires;
    const bridgeCovered = phase === 'BRIDGE' && config.income_profile.bridge_has_health_insurance;
    const hasEmployerCoverage = phase === 'GOOGLE' || phase === 'JUMP' || partnerIsWorking || bridgeCovered;

    if (!hasEmployerCoverage) {
      if (config.medicare && currentAge >= config.medicare.start_age) {
        const inflationMultiplier = Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);
        currentHealthcareCost = config.medicare.monthly_premium * inflationMultiplier;
      } else {
        currentHealthcareCost = config.spending.healthcare_premium * Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);
      }
      expense += currentHealthcareCost;
    }
    // ... (Mortgage logic continues) ...


    if (currentDate < mortgagePayoffDate) {
      const payment = config.spending.mortgage_payment;
      expense += payment;

      // Still track balance for Net Worth purposes (optional but good for accuracy)
      if (currentMortgage > 0) {
        const monthlyRate = (mortgageRate / 100) / 12;
        const interestPayment = currentMortgage * monthlyRate;
        const principalPayment = payment - interestPayment;
        if (principalPayment > 0) currentMortgage -= principalPayment;
        if (currentMortgage < 0) currentMortgage = 0;
      }
    }

    // Life Events
    if (config.life_events) {
      config.life_events.forEach(event => {
        const isCollege = event.name.toLowerCase().includes('college');
        
        if (isCollege) {
          // Spread cost over 4 years, paying annually in January
          const isPaymentYear = currentYear >= event.year && currentYear < event.year + 4;
          if (isPaymentYear && currentDate.getMonth() === 0) {
            const annualCost = event.cost / 4;
            const inflatedCost = annualCost * Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);

            // Pay from 529 first
            if (current529 >= inflatedCost) {
              current529 -= inflatedCost;
            } else {
              const remaining = inflatedCost - current529;
              current529 = 0;
              expense += remaining; // Spillover to cash flow
            }
          }
        } else {
          // Standard one-time event
          if (event.year === currentYear && currentDate.getMonth() === 0) {
            const inflatedCost = event.cost * Math.pow(1 + (config.market_assumptions.inflation_rate / 100), yearsPassed);
            expense += inflatedCost;
          }
        }
      });
    }

    // Upcoming Capital Calls
    if (snapshot.liabilities.upcoming_capital_calls > 0 && snapshot.liabilities.capital_calls_due_date) {
      const dueDate = new Date(snapshot.liabilities.capital_calls_due_date);
      if (currentDate.getFullYear() === dueDate.getFullYear() && currentDate.getMonth() === dueDate.getMonth()) {
        expense += snapshot.liabilities.upcoming_capital_calls;
      }
    }

    // Divestment Strategy
    let divestmentProceeds = 0;
    let divestmentTax = 0;

    if (config.divestment_strategy.type === 'progressive') {
      const totalWindowMonths = (config.divestment_strategy.end_year - config.divestment_strategy.start_year) * 12;
      const monthsElapsed = (currentYear - config.divestment_strategy.start_year) * 12 + currentDate.getMonth();

      if (monthsElapsed >= 0 && monthsElapsed < totalWindowMonths) {
        const remainingMonths = totalWindowMonths - monthsElapsed;
        const sharesToSell = currentGoogShares / remainingMonths;
        const grossSale = sharesToSell * currentGoogPrice;

        // Calculate Cost Basis
        const totalBasis = currentGoogByBasis.reduce((acc, batch) => acc + (batch.shares * batch.basis), 0);
        const totalSharesHeld = currentGoogByBasis.reduce((acc, batch) => acc + batch.shares, 0);
        const avgBasis = totalSharesHeld > 0 ? totalBasis / totalSharesHeld : 0;

        const capGain = Math.max(0, grossSale - (sharesToSell * avgBasis));

        // TAX CALCULATION:
        // We need to find the tax on this specific gain, stacked on top of annualized ordinary income.
        // Annualized Ordinary Income Estimate:
        const annualOrdinary = monthlyNetInfo.grossEst * 12;

        // Scenario A: Without this sale (just ordinary)
        const baseTax = calculateTax({
          filingStatus: config.tax_assumptions.filing_status,
          state: config.tax_assumptions.state_of_residence,
          grossIncome: annualOrdinary,
          longTermCapitalGains: 0,
          shortTermCapitalGains: 0
        });

        // Scenario B: With this sale (annualized logic: assuming we do this every month? Or just this one-off?)
        // Divestment is monthly. So we have 12 * capGain per year? 
        // YES. If we sell every month, our annual LTCG is 12 * monthlyGain.
        const annualLTCG = capGain * 12;

        const withSaleTax = calculateTax({
          filingStatus: config.tax_assumptions.filing_status,
          state: config.tax_assumptions.state_of_residence,
          grossIncome: annualOrdinary,
          longTermCapitalGains: annualLTCG,
          shortTermCapitalGains: 0
        });

        // The tax attributed to THIS month's sale is 1/12th of the annual diff
        divestmentTax = (withSaleTax.totalTax - baseTax.totalTax) / 12;
        divestmentProceeds = grossSale - divestmentTax;



        currentGoogShares -= sharesToSell;
      }
    } else if (config.divestment_strategy.type === 'immediate') {
      // Trigger immediate sell at the start of the exit year (Retirement)
      const isExitTime = currentYear === config.career_path.exit_year && currentDate.getMonth() === 0;

      if (isExitTime && currentGoogShares > 0) {
        const grossProceeds = currentGoogShares * currentGoogPrice;
        const totalBasis = currentGoogByBasis.reduce((acc, batch) => acc + (batch.shares * batch.basis), 0);
        const totalSharesHeld = currentGoogByBasis.reduce((acc, batch) => acc + batch.shares, 0);
        const avgBasis = totalSharesHeld > 0 ? totalBasis / totalSharesHeld : 0;
        const gain = Math.max(0, grossProceeds - (currentGoogShares * avgBasis));

        const annualOrdinary = monthlyNetInfo.grossEst * 12;
        const baseTax = calculateTax({
          filingStatus: config.tax_assumptions.filing_status,
          state: config.tax_assumptions.state_of_residence,
          grossIncome: annualOrdinary,
          longTermCapitalGains: 0,
          shortTermCapitalGains: 0
        });
        const withSaleTax = calculateTax({
          filingStatus: config.tax_assumptions.filing_status,
          state: config.tax_assumptions.state_of_residence,
          grossIncome: annualOrdinary,
          longTermCapitalGains: gain,
          shortTermCapitalGains: 0
        });

        // For a one-time lump sum, the tax is the full difference
        divestmentTax = withSaleTax.totalTax - baseTax.totalTax;
        divestmentProceeds = grossProceeds - divestmentTax;
        currentGoogShares = 0;
      }
    }

    liquidCash += divestmentProceeds;

    const netFlow = monthlyNetInfo.net - expense; // Divestment already added to liquidCash
    liquidCash += netFlow;



    if (liquidCash > 50000 && currentConsumerDebt > 0) {
      const paydown = Math.min(liquidCash - 50000, currentConsumerDebt);
      currentConsumerDebt -= paydown;
      liquidCash -= paydown;
    }

    if (liquidCash < 0) {
      // Deficit Handling
      // Use MARGINAL rate for deficit withdrawals if coming from Taxable
      const deficit = Math.abs(liquidCash);
      liquidCash = 0;

      // Sell GOOG logic... (simplified for now: assume 25% haircut or reuse marginal logic)
      // For robustness in this step, let's use a flat 25% estimated tax on emergency sales to avoid infinite complexity in this block
      // or actually assume we need `deficit / (1 - marginalRate)`?

      // Conservative: Use 30% drag for emergency sales
      const emergencyTaxDrag = 0.30;

      // ... (Rest of deficit logic similar to before but utilizing tax var if needed)
      const accumulatedBasis = currentGoogByBasis.reduce((acc, batch) => acc + (batch.shares * batch.basis), 0);

      const totalShares = currentGoogByBasis.reduce((acc, batch) => acc + batch.shares, 0);
      const avgBasis = totalShares > 0 ? accumulatedBasis / totalShares : 0;

      const netPerShare = currentGoogPrice - (emergencyTaxDrag * Math.max(0, currentGoogPrice - avgBasis)); // Approx 30% LTCG/Income Tax on emergency

      if (currentGoogShares * netPerShare >= deficit) {
        currentGoogShares -= deficit / netPerShare;
      } else {
        const proceed = currentGoogShares * netPerShare;
        currentGoogShares = 0;
        let remaining = deficit - proceed;
        // Jump stock
        if (currentJumpStockValue * 0.75 >= remaining) {
          currentJumpStockValue -= remaining / 0.75;
        } else {
          remaining -= currentJumpStockValue * 0.75;
          currentJumpStockValue = 0;
          retirement -= remaining / 0.70; // 30% tax on retirement
        }
      }
    }

    // ... (rest of loop)

    const currentGoogValue = currentGoogShares * currentGoogPrice;
    const totalLiabilities = currentMortgage + currentConsumerDebt;
    // Total Net Worth includes everything
    const totalNetWorth = liquidCash + retirement + currentGoogValue + currentJumpStockValue + totalOtherInvestmentsValue + current529;

    // Independence Metric / Portfolio Strength
    // "True FI" relies on Liquid + Retirement + Jump (if liquid events happen). 
    // We EXCLUDE 529s (Education only) and Home Equity (Not liquid).
    // We should also consider that Jump Stock might not be liquid yet, but for "Net Worth" it counts. 
    // For SWR, we usually count "Investable Assets".
    const investableAssets = liquidCash + retirement + currentJumpStockValue + totalOtherInvestmentsValue + currentGoogValue;

    // Conservative: use Income Tax Rate for safety buffer. 
    // Or stick to previous 17.5% drag (approx 20%).
    const taxDrag = (phase === 'RETIRED') ? 0.20 : 0.25;
    const rawSWRTarget = (expense * 12) / 0.04;
    const adjustedSWRTarget = rawSWRTarget / (1 - taxDrag);

    // Independence Ratio: > 1.0 means FI
    const independenceRatio = adjustedSWRTarget > 0 ? investableAssets / adjustedSWRTarget : 0;
    const isIndependent = independenceRatio >= 1.0;

    // Record every data point to support dense monthly tracking (Calendar View)
    // Replaced modulo logic to return full resolution
      // Calculate Granular Data for Charting
      const salaryPart = monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet;

      const netJumpStockPart = jumpGrantMonthlyGross > 0 ? (jumpGrantMonthlyGross * (1 - effectiveTaxRate)) : 0;
      const equityPart = (monthlyEquityVestUnits > 0 ? (monthlyEquityVestUnits * (1 - effectiveTaxRate) * currentGoogPrice) : 0) + netJumpStockPart;

      // Note: Updated to sum actual post-tax components rather than approximating by subtraction
      const annualizedComp = (salaryPart + monthlyRentalNet + equityPart + socialSecurityIncome) * 12;

      // Healthcare Cost (Monthly)
      // We already calculated currentHealthcareCost dynamically above (handling Medicare vs Private)

      // Mortgage Payment (Monthly)
      // If we still have a mortgage, the payment is fixed (config).
      // We use the same Date check as above to ensure consistency with the Expense calculation.
      const currentMortgagePayment = (currentDate < mortgagePayoffDate) ? config.spending.mortgage_payment : 0;

      // Lifestyle (Monthly)
      const currentBaseLifestyle = (currentDate.getFullYear() >= (config.spending.empty_nest_year || 3000) && config.spending.empty_nest_monthly_spend)
        ? config.spending.empty_nest_monthly_spend
        : config.spending.monthly_lifestyle;
      const currentLifestyle = currentBaseLifestyle * standardInflationMultiplier;

      // Accumulated Returns (Estimate)
      // Tracks growth of (Liquid + Retirement + 529 + Other). 
      // Simplified: TotalAssets - TotalLiabilities - (InitialAssets + CumulativeSavings)
      // This is complex to track perfectly without a running "Basis".
      // ALTERNATIVE: Just return "Investment Assets" vs "Net Worth" or "Total Returns"
      // Maybe "Investment Return" is the % or $ gain this year?
      // Let's providing "Annual Investment Income" (Growth $).
      // Actually, accumulatedReturns is safer if we want a line chart.
      // Let's just pass 0 for now if too complex, or estimate:
      // We know the "Growth Factors" applied this month.
      // let's track `cumulativeGrowth` variable in the loop.

      points.push({
        date: currentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        monthIndex: month,
        liquidCash: Math.round(liquidCash),
        retirement: Math.round(retirement),
        googValue: Math.round(currentGoogValue),
        totalNetWorth: Math.round(totalNetWorth),
        totalLiabilities: Math.round(totalLiabilities),
        isIndependent,
        swrTarget: Math.round(adjustedSWRTarget),
        currentPhase: phase,
        rentalIncome: Math.round(rentalIncome * 12), // Annualized
        healthcareCost: Math.round(currentHealthcareCost * 12), // Annualized
        totalCompensation: Math.round(annualizedComp),
        accumulatedReturns: 0, // Placeholder for now, or implement tracking
        mortgagePayment: Math.round(currentMortgagePayment * 12),
        lifestyleExpense: Math.round(currentLifestyle * 12),
        socialSecurityIncome: Math.round(socialSecurityIncome * 12),
        educationAssets: Math.round(current529) // Capture 529 balance
      });
  }

  return points;
}
