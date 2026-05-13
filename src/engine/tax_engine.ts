export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';
export type StateCode = 'CA' | 'WA' | 'TX' | 'NY' | 'NONE';

export interface TaxInput {
  filingStatus: FilingStatus;
  state: StateCode;
  grossIncome: number; // W2, Business Income, etc. (Ordinary)
  longTermCapitalGains: number;
  shortTermCapitalGains: number; // Taxed as ordinary
}

export interface TaxOutput {
  federalIncomeTax: number;
  stateIncomeTax: number;
  ficaTax: number; // SS + Medicare
  capitalGainsTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  netIncome: number;
}

// 2025 Federal Tax Brackets (Estimated/Projected)
const FEDERAL_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: 11925, rate: 0.10 },
    { limit: 48475, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 },
    { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { limit: 23850, rate: 0.10 },
    { limit: 96950, rate: 0.12 },
    { limit: 206700, rate: 0.22 },
    { limit: 394600, rate: 0.24 },
    { limit: 501050, rate: 0.32 },
    { limit: 751600, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { limit: 11925, rate: 0.10 },
    { limit: 48475, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 },
    { limit: 375800, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  head_household: [
    { limit: 17000, rate: 0.10 },
    { limit: 64850, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 },
    { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15000, // Approx
  married_joint: 30000,
  married_separate: 15000,
  head_household: 22500,
};

// Long Term Capital Gains Brackets 2025 (Based on Taxable Income including Gains)
const LTCG_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: 48350, rate: 0.0 },
    { limit: 533400, rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
  married_joint: [
    { limit: 96700, rate: 0.0 },
    { limit: 600050, rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
  married_separate: [
    { limit: 48350, rate: 0.0 },
    { limit: 300000, rate: 0.15 }, // Check this constraint
    { limit: Infinity, rate: 0.20 },
  ],
  head_household: [
    { limit: 64750, rate: 0.0 },
    { limit: 566700, rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
};

// NIIT Thresholds
const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married_joint: 250000,
  married_separate: 125000,
  head_household: 200000,
};

const CA_BRACKETS_2024: { limit: number; rate: number }[] = [
  { limit: 10412, rate: 0.01 },
  { limit: 24684, rate: 0.02 },
  { limit: 38959, rate: 0.04 },
  { limit: 54081, rate: 0.06 },
  { limit: 68350, rate: 0.08 },
  { limit: 349137, rate: 0.093 },
  { limit: 418961, rate: 0.103 },
  { limit: 698271, rate: 0.113 },
  { limit: Infinity, rate: 0.123 }, // Mental Health Services Tax included? Usually 1% > 1M
];

// 1% Surcharge for > $1M in CA (Mental Health)
const CA_MENTAL_HEALTH_THRESHOLD = 1000000;
const CA_MENTAL_HEALTH_RATE = 0.01;

const _calculateTaxRaw = (input: TaxInput): Omit<TaxOutput, 'marginalRate'> => {
  const { filingStatus, grossIncome, longTermCapitalGains, shortTermCapitalGains } = input;

  // 1. Calculate Adjusted Gross Income (AGI) -> Taxable Income
  const totalOrdinaryIncome = grossIncome + shortTermCapitalGains;
  const standardDeduction = STANDARD_DEDUCTION_2025[filingStatus];

  // Deduct from ordinary income first
  const taxableOrdinaryIncome = Math.max(0, totalOrdinaryIncome - standardDeduction);

  // 2. Federal Ordinary Income Tax
  let federalIncomeTax = 0;
  let remainingOrdinary = taxableOrdinaryIncome;
  let previousLimit = 0;

  for (const bracket of FEDERAL_BRACKETS_2025[filingStatus]) {
    const width = bracket.limit - previousLimit;
    const taxableInBracket = Math.min(remainingOrdinary, width);

    federalIncomeTax += taxableInBracket * bracket.rate;
    remainingOrdinary -= taxableInBracket;
    previousLimit = bracket.limit;

    if (remainingOrdinary <= 0) break;
  }

  // 3. Federal FICA (Assume Gross acts as wages for simplicity, should separate W2 vs other in future)
  // Social Security Cap: ~$176,100 (2025 est)
  const SS_WAGE_BASE = 176100;
  const ssTax = Math.min(grossIncome, SS_WAGE_BASE) * 0.062;
  const medTax = grossIncome * 0.0145;
  const addMedTax = Math.max(0, grossIncome - NIIT_THRESHOLD[filingStatus]) * 0.009;

  const ficaTax = ssTax + medTax + addMedTax;

  // 4. Federal Capital Gains Tax
  // Stack LTCG on top of Taxable Ordinary Income to determine bracket
  // Important: The 0%, 15%, 20% brackets are based on TOTAL Taxable Income
  let capitalGainsTax = 0;
  let currentIncomeStack = taxableOrdinaryIncome; // Start stacking from here
  let remainingLTCG = longTermCapitalGains;

  // 0% Bracket Check
  const ltcgBrackets = LTCG_BRACKETS_2025[filingStatus];

  // Bracket 1: 0%
  const zeroPercentLimit = ltcgBrackets[0].limit;
  if (currentIncomeStack < zeroPercentLimit) {
    const room = zeroPercentLimit - currentIncomeStack;
    const untaxedInfo = Math.min(remainingLTCG, room);
    // Tax is 0
    remainingLTCG -= untaxedInfo;
    currentIncomeStack += untaxedInfo;
  }

  // Bracket 2: 15%
  const fifteenPercentLimit = ltcgBrackets[1].limit;
  if (remainingLTCG > 0 && currentIncomeStack < fifteenPercentLimit) {
    const room = fifteenPercentLimit - currentIncomeStack;
    const taxedInfo15 = Math.min(remainingLTCG, room);
    capitalGainsTax += taxedInfo15 * 0.15;
    remainingLTCG -= taxedInfo15;
    currentIncomeStack += taxedInfo15;
  }

  // Bracket 3: 20%
  if (remainingLTCG > 0) {
    capitalGainsTax += remainingLTCG * 0.20;
    currentIncomeStack += remainingLTCG;
  }

  // 5. NIIT (Net Investment Income Tax)
  // 3.8% on lesser of (NII) or (MAGI - Threshold)
  // NII includes Capital Gains, Divs, Interest (we assume all LTCG/STCG is NII)
  const magi = grossIncome + shortTermCapitalGains + longTermCapitalGains;
  const niitExcess = Math.max(0, magi - NIIT_THRESHOLD[filingStatus]);
  const nii = longTermCapitalGains + shortTermCapitalGains; // Approximation

  const niitTax = Math.min(nii, niitExcess) * 0.038;
  capitalGainsTax += niitTax;

  // 6. State Tax (Simplified for CA)
  let stateIncomeTax = 0;
  if (input.state === 'CA') {
    // CA treats Capital Gains as Ordinary Income
    // CA Standard Deduction is different (lower), simplified here to use Fed TI + adjustment or just Gross - CA SD
    const caStandardDeduction = filingStatus === 'married_joint' ? 10726 : 5363; // 2023 approx
    const caTaxable = Math.max(0, totalOrdinaryIncome + longTermCapitalGains - caStandardDeduction);

    let remainingCA = caTaxable;
    let prevCALimit = 0;

    // CA Brackets are single. Double bandwidths for married?
    // "California has tax brackets for single and married filing separately... For married filing jointly, the income amounts are doubled."
    const caBrackets = filingStatus === 'married_joint'
      ? CA_BRACKETS_2024.map(b => ({ limit: b.limit * 2, rate: b.rate }))
      : CA_BRACKETS_2024;

    for (const bracket of caBrackets) {
      const width = bracket.limit - prevCALimit;
      const taxedInBracket = Math.min(remainingCA, width);
      stateIncomeTax += taxedInBracket * bracket.rate;
      remainingCA -= taxedInBracket;
      prevCALimit = bracket.limit;
      if (remainingCA <= 0) break;
    }

    // Mental Health Surcharge
    if (caTaxable > CA_MENTAL_HEALTH_THRESHOLD) {
      stateIncomeTax += (caTaxable - CA_MENTAL_HEALTH_THRESHOLD) * CA_MENTAL_HEALTH_RATE;
    }
  }

  const totalTax = federalIncomeTax + ficaTax + capitalGainsTax + stateIncomeTax;

  return {
    federalIncomeTax,
    stateIncomeTax,
    ficaTax,
    capitalGainsTax,
    totalTax,
    effectiveRate: magi > 0 ? totalTax / magi : 0,
    netIncome: magi - totalTax
  };
};

export const calculateTax = (input: TaxInput): TaxOutput => {
  const base = _calculateTaxRaw(input);

  // Marginal Rate: Impact of adding $100 to Gross Income
  const plusOneInput = { ...input, grossIncome: input.grossIncome + 100 };
  const plusOne = _calculateTaxRaw(plusOneInput);

  const marginalRate = (plusOne.totalTax - base.totalTax) / 100;

  return {
    ...base,
    marginalRate
  };
};

export const calculateMarginalRate = (input: TaxInput): number => {
  return calculateTax(input).marginalRate;
};
