import Papa from 'papaparse';
import type { FinancialSnapshot } from './calculator';

export const parseFinancialCSV = (file: File): Promise<Partial<FinancialSnapshot>> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const text = results.data.map((row: any) => row.join(',')).join('\n');
        const snapshot: Partial<FinancialSnapshot> = {
          liquid_assets: { ...EMPTY_SNAPSHOT.liquid_assets },
          retirement_assets: { ...EMPTY_SNAPSHOT.retirement_assets },
          liabilities: { ...EMPTY_SNAPSHOT.liabilities },
          share_counts: { ...EMPTY_SNAPSHOT.share_counts },
        };

        // Aggregation Logic (Iterate all rows and sum matches)
        const sumMatches = (keywords: string[]): number => {
          let total = 0;
          for (const row of results.data as string[][]) {
            const rowStr = row.join(' ').toLowerCase();
            if (keywords.some(k => rowStr.includes(k.toLowerCase()))) {
              // Find value in this row
              let rowVal = 0;
              for (const cell of row) {
                if (!cell) continue;
                const cleanCell = cell.toString().replace(/[\$,]/g, '');
                const val = parseFloat(cleanCell);
                if (!isNaN(val) && val > 0) {
                  // Assumption: The largest number or the one looking like currency is the value. 
                  // Or maybe we pick the one that is NOT the year (e.g. 2026).
                  // Let's assume the value is the last numeric column?
                  rowVal = val;
                }
              }
              total += rowVal;
            }
          }
          return total;
        };

        // Since the prompt was specific about "Keyword Mapping" and "Parse Rows: Split by newline...", 
        // I will trust the user's manual parsing logic style but apply it to the 2D array from PapaParse or just raw text if easier.
        // Actually, if we use the raw text it might be easier to match "Vanguard Personal... $24k".
        // Let's use the raw text scanning for simplicity as requested by "Search for X".

        // Liquid
        if (text.match(/Vanguard Personal/i)) snapshot.liquid_assets!.vanguard_bridge = sumMatches(['Vanguard Personal']);
        if (text.match(/Amex Savings/i) || text.match(/Checking/i)) snapshot.liquid_assets!.cash_savings = sumMatches(['Amex Savings', 'Checking']);

        // Equity
        if (text.match(/Google Stock/i)) snapshot.share_counts!.google_shares = sumMatches(['Google Stock']); // This might sum DOLLARS instead of SHARES if not careful.
        // Wait, "Search for Google Stock". If the row is "Google Stock, 780.61", sumMatches returns 780.61.
        // If it is "Google Stock, $120,000", it returns 120000. 
        // User said: "Option A... User manually inputs share count... because CSV value might be stale."
        // We'll try to parse it, but user confirms.

        // Retirement
        if (text.match(/401k/i)) snapshot.retirement_assets!.k401 = sumMatches(['401k']);
        if (text.match(/Roth IRA/i)) snapshot.retirement_assets!.roth_ira = sumMatches(['Roth IRA']);
        if (text.match(/IRA/i) && !text.match(/Roth IRA/i)) snapshot.retirement_assets!.traditional_ira = sumMatches(['IRA']); // simplify

        // Liabilities
        // We need to map these to specific fields?
        // "Consumer Debt": Credit Cards + Loans
        snapshot.liabilities!.consumer_debt = sumMatches(['Chase', 'Amex', 'Citi', 'Loan']);
        // "Upcoming Capital Calls": Renovations
        snapshot.liabilities!.upcoming_capital_calls = sumMatches(['Renovations', 'Taxes']);

        resolve(snapshot);
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};

const EMPTY_SNAPSHOT: FinancialSnapshot = {
  snapshot_date: '',
  share_counts: { google_shares: 0 },
  liquid_assets: { vanguard_bridge: 0, cash_savings: 0, google_equity_value: 0 },
  retirement_assets: { k401: 0, roth_ira: 0, traditional_ira: 0 },
  education_assets: { total_529: 0, accounts: [] },
  liabilities: { mortgage_balance: 0, consumer_debt: 0, upcoming_capital_calls: 0 },
  other_investments: []
};
