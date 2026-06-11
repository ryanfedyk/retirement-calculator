export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';
export type StateCode = 'CA' | 'WA' | 'TX' | 'NY' | 'NONE';

export interface TaxInput {
  filingStatus: FilingStatus;
  state: StateCode;
  grossIncome: number;           // W2 wages, RSUs, bonuses (ordinary income — subject to FICA)
  ficaExemptIncome?: number;     // Rental, partnership income etc — ordinary tax but NOT FICA
  longTermCapitalGains: number;
  shortTermCapitalGains: number; // Taxed as ordinary
}

export interface TaxOutput {
  federalIncomeTax: number;
  stateIncomeTax: number;
  ficaTax: number;
  capitalGainsTax: number;
  totalTax: number;
  effectiveRate: number;          // totalTax / totalIncome (blended, for display)
  ordinaryEffectiveRate: number;  // (fed + FICA + state) / ordinaryIncome — use for salary/bonus net-down
  marginalRate: number;           // impact of $1 more in ordinary income
  netIncome: number;
}

// ── Federal Income Tax Brackets 2025 ─────────────────────────────────────────

const FEDERAL_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: 11_925,   rate: 0.10 },
    { limit: 48_475,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 626_350,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { limit: 23_850,   rate: 0.10 },
    { limit: 96_950,   rate: 0.12 },
    { limit: 206_700,  rate: 0.22 },
    { limit: 394_600,  rate: 0.24 },
    { limit: 501_050,  rate: 0.32 },
    { limit: 751_600,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { limit: 11_925,   rate: 0.10 },
    { limit: 48_475,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 375_800,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  head_household: [
    { limit: 17_000,   rate: 0.10 },
    { limit: 64_850,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 626_350,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single:           15_000,
  married_joint:    30_000,
  married_separate: 15_000,
  head_household:   22_500,
};

// ── Federal LTCG Brackets 2025 ────────────────────────────────────────────────

const LTCG_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: 48_350,   rate: 0.00 },
    { limit: 533_400,  rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
  married_joint: [
    { limit: 96_700,   rate: 0.00 },
    { limit: 600_050,  rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
  married_separate: [
    { limit: 48_350,   rate: 0.00 },
    { limit: 300_000,  rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
  head_household: [
    { limit: 64_750,   rate: 0.00 },
    { limit: 566_700,  rate: 0.15 },
    { limit: Infinity, rate: 0.20 },
  ],
};

const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single:           200_000,
  married_joint:    250_000,
  married_separate: 125_000,
  head_household:   200_000,
};

// ── NY State Income Tax Brackets 2024 ────────────────────────────────────────
// NY treats capital gains as ordinary income (no preferential rate)

const NY_STATE_BRACKETS: Record<'single' | 'married_joint', { limit: number; rate: number }[]> = {
  single: [
    { limit: 8_500,     rate: 0.04    },
    { limit: 11_700,    rate: 0.045   },
    { limit: 13_900,    rate: 0.0525  },
    { limit: 80_650,    rate: 0.0585  },
    { limit: 215_400,   rate: 0.0625  },
    { limit: 1_077_550, rate: 0.0685  },
    { limit: 5_000_000, rate: 0.0965  },
    { limit: 25_000_000,rate: 0.103   },
    { limit: Infinity,  rate: 0.109   },
  ],
  married_joint: [
    { limit: 17_150,    rate: 0.04    },
    { limit: 23_600,    rate: 0.045   },
    { limit: 27_900,    rate: 0.0525  },
    { limit: 161_550,   rate: 0.0585  },
    { limit: 323_200,   rate: 0.0625  },
    { limit: 2_155_350, rate: 0.0685  },
    { limit: 5_000_000, rate: 0.0965  },
    { limit: 25_000_000,rate: 0.103   },
    { limit: Infinity,  rate: 0.109   },
  ],
};

// NY standard deduction 2024
const NY_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single:           8_000,
  married_joint:    16_050,
  married_separate: 8_000,
  head_household:   11_200,
};

// NYC income tax brackets 2024 (resident)
const NYC_BRACKETS: Record<'single' | 'married_joint', { limit: number; rate: number }[]> = {
  single: [
    { limit: 12_000,   rate: 0.03078 },
    { limit: 25_000,   rate: 0.03762 },
    { limit: 50_000,   rate: 0.03819 },
    { limit: Infinity, rate: 0.03876 },
  ],
  married_joint: [
    { limit: 21_600,   rate: 0.03078 },
    { limit: 45_000,   rate: 0.03762 },
    { limit: 90_000,   rate: 0.03819 },
    { limit: Infinity, rate: 0.03876 },
  ],
};

// ── CA State Income Tax Brackets 2024 ────────────────────────────────────────

const CA_BRACKETS_2024: { limit: number; rate: number }[] = [
  { limit: 10_412,   rate: 0.01   },
  { limit: 24_684,   rate: 0.02   },
  { limit: 38_959,   rate: 0.04   },
  { limit: 54_081,   rate: 0.06   },
  { limit: 68_350,   rate: 0.08   },
  { limit: 349_137,  rate: 0.093  },
  { limit: 418_961,  rate: 0.103  },
  { limit: 698_271,  rate: 0.113  },
  { limit: Infinity, rate: 0.123  },
];
const CA_MENTAL_HEALTH_THRESHOLD = 1_000_000;
const CA_MENTAL_HEALTH_RATE      = 0.01;

// ── Helper: apply bracket table to a taxable amount ─────────────────────────

function applyBrackets(amount: number, brackets: { limit: number; rate: number }[]): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    const width = b.limit - prev;
    const taxable = Math.min(Math.max(0, amount - prev), width);
    tax += taxable * b.rate;
    prev = b.limit;
    if (amount <= b.limit) break;
  }
  return tax;
}

// ── Core calculator ──────────────────────────────────────────────────────────

const _calculateTaxRaw = (input: TaxInput): Omit<TaxOutput, 'marginalRate'> => {
  const { filingStatus, grossIncome, longTermCapitalGains, shortTermCapitalGains } = input;
  const ficaExemptIncome = input.ficaExemptIncome ?? 0;

  // ── Ordinary income (all sources) ──────────────────────────────────────────
  const totalOrdinaryIncome = grossIncome + ficaExemptIncome + shortTermCapitalGains;

  // ── Federal income tax ────────────────────────────────────────────────────
  const fedStdDeduction     = STANDARD_DEDUCTION_2025[filingStatus];
  const taxableOrdinary     = Math.max(0, totalOrdinaryIncome - fedStdDeduction);
  const federalIncomeTax    = applyBrackets(taxableOrdinary, FEDERAL_BRACKETS_2025[filingStatus]);

  // ── FICA (SS + Medicare) — W2 wages only, not rental/passive income ───────
  const SS_WAGE_BASE = 176_100;
  const ficaWages    = Math.max(0, grossIncome); // excludes ficaExemptIncome
  const ssTax        = Math.min(ficaWages, SS_WAGE_BASE) * 0.062;
  const medTax       = ficaWages * 0.0145;
  const addMedTax    = Math.max(0, ficaWages - NIIT_THRESHOLD[filingStatus]) * 0.009;
  const ficaTax      = ssTax + medTax + addMedTax;

  // ── Federal LTCG tax (stacked on top of ordinary) ────────────────────────
  const ltcgBrackets = LTCG_BRACKETS_2025[filingStatus];
  let capitalGainsTax = 0;
  let incomeStack     = taxableOrdinary;
  let remainingLTCG   = longTermCapitalGains;

  const z = ltcgBrackets[0].limit;
  if (incomeStack < z) {
    const room = z - incomeStack;
    const at0  = Math.min(remainingLTCG, room);
    remainingLTCG  -= at0;
    incomeStack    += at0;
  }
  const f = ltcgBrackets[1].limit;
  if (remainingLTCG > 0 && incomeStack < f) {
    const room  = f - incomeStack;
    const at15  = Math.min(remainingLTCG, room);
    capitalGainsTax += at15 * 0.15;
    remainingLTCG   -= at15;
    incomeStack     += at15;
  }
  if (remainingLTCG > 0) {
    capitalGainsTax += remainingLTCG * 0.20;
  }

  // NIIT 3.8%
  const magi       = totalOrdinaryIncome + longTermCapitalGains;
  const niitExcess = Math.max(0, magi - NIIT_THRESHOLD[filingStatus]);
  const nii        = longTermCapitalGains + shortTermCapitalGains;
  capitalGainsTax += Math.min(nii, niitExcess) * 0.038;

  // ── State income tax ──────────────────────────────────────────────────────
  let stateIncomeTax = 0;

  if (input.state === 'NY') {
    // NY treats LTCG as ordinary income
    const nyTotalIncome = totalOrdinaryIncome + longTermCapitalGains;
    const nyStdDeduction = NY_STANDARD_DEDUCTION[filingStatus];
    const nyTaxable = Math.max(0, nyTotalIncome - nyStdDeduction);

    const nyKey: 'single' | 'married_joint' =
      (filingStatus === 'married_joint') ? 'married_joint' : 'single';

    // NY State
    stateIncomeTax += applyBrackets(nyTaxable, NY_STATE_BRACKETS[nyKey]);

    // NYC (resident surcharge — assumes NYC residency)
    stateIncomeTax += applyBrackets(nyTaxable, NYC_BRACKETS[nyKey]);
  }

  if (input.state === 'CA') {
    const caStdDeduction = filingStatus === 'married_joint' ? 10_726 : 5_363;
    const caTotalIncome  = totalOrdinaryIncome + longTermCapitalGains;
    const caTaxable      = Math.max(0, caTotalIncome - caStdDeduction);

    const caBrackets = filingStatus === 'married_joint'
      ? CA_BRACKETS_2024.map(b => ({ limit: b.limit * 2, rate: b.rate }))
      : CA_BRACKETS_2024;

    stateIncomeTax += applyBrackets(caTaxable, caBrackets);

    if (caTaxable > CA_MENTAL_HEALTH_THRESHOLD) {
      stateIncomeTax += (caTaxable - CA_MENTAL_HEALTH_THRESHOLD) * CA_MENTAL_HEALTH_RATE;
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalTax = federalIncomeTax + ficaTax + capitalGainsTax + stateIncomeTax;

  // Ordinary-income-only effective rate (use this for salary/bonus net-down)
  const ordinaryTax = federalIncomeTax + ficaTax + stateIncomeTax;
  const ordinaryEffectiveRate = totalOrdinaryIncome > 0
    ? Math.min(0.75, ordinaryTax / totalOrdinaryIncome)
    : 0;

  return {
    federalIncomeTax,
    stateIncomeTax,
    ficaTax,
    capitalGainsTax,
    totalTax,
    effectiveRate: magi > 0 ? totalTax / magi : 0,
    ordinaryEffectiveRate,
    netIncome: magi - totalTax,
  };
};

export const calculateTax = (input: TaxInput): TaxOutput => {
  const base = _calculateTaxRaw(input);

  // Marginal rate: impact of $100 more in ordinary gross income
  const plusOne    = _calculateTaxRaw({ ...input, grossIncome: input.grossIncome + 100 });
  const marginalRate = (plusOne.totalTax - base.totalTax) / 100;

  return { ...base, marginalRate };
};

export const calculateMarginalRate = (input: TaxInput): number =>
  calculateTax(input).marginalRate;
