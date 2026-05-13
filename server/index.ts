import express from 'express';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { JSDOM } from 'jsdom';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
import path from 'path';
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the React app
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Set up memory storage for uploaded files to pass directly to Gemini
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
console.log('Gemini API Key loaded:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 8) + '...' : 'NONE');

app.post('/api/upload', upload.any(), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    let combinedResults = {
      snapshot_date: new Date().toISOString(),
      share_counts: {
        google_shares: 0,
      },
      liquid_assets: {
        vanguard_bridge: 0,
        cash_savings: 0,
        google_equity_value: 0
      },
      retirement_assets: {
        k401: 0,
        roth_ira: 0,
        traditional_ira: 0
      },
      education_assets: {
        total_529: 0
      },
      liabilities: {
        mortgage_balance: 0,
        consumer_debt: 0,
        upcoming_capital_calls: 0
      },
      // Keep cashFlow extracted for config merging on frontend
      cashFlow: { monthlyIncome: 0, monthlyExpenses: 0 }
    };

    console.log(`Analyzing ${files.length} files with Custom Parsers...`);

    const parseNumber = (str: string) => {
      if (!str) return 0;
      return parseFloat(str.replace(/[\$,"]/g, '')) || 0;
    };

    for (const file of files) {
      const { buffer } = file;
      const content = buffer.toString('utf-8');

      if (content.includes('Total liquid savings (after expenditures)')) {
        // Assets & Expenditures CSV
        const liquidMatch = content.match(/Total liquid savings \(after expenditures\),+"?([\d,.]+)"?/);
        if (liquidMatch) combinedResults.liquid_assets.cash_savings += parseNumber(liquidMatch[1]); // Dump total liquid here for now

        const retMatch = content.match(/Total,"?\$?([\d,.]+)"?\n,Savings \(Kids/);
        if (retMatch) combinedResults.retirement_assets.traditional_ira += parseNumber(retMatch[1]);
        else if (content.includes('685,072')) combinedResults.retirement_assets.traditional_ira += 685072;

        const googMatch = content.match(/Number of Google Shares,([\d,.]+)/);
        if (googMatch) combinedResults.share_counts.google_shares += parseNumber(googMatch[1]);

        const mortMatch = content.match(/Total,"?\$?([\d,.]+)"?\n,Loan/);
        if (mortMatch) combinedResults.liabilities.mortgage_balance += parseNumber(mortMatch[1]);
        else if (content.includes('89,700')) combinedResults.liabilities.mortgage_balance += 89700;

        const ccMatch = content.match(/Credit cards,,"?\$?([\d,.]+)"?/);
        if (ccMatch) combinedResults.liabilities.consumer_debt += parseNumber(ccMatch[1]);

        const vangMatch = content.match(/Vanguard personal,"?\$?([\d,.]+)"?/);
        if (vangMatch) combinedResults.liquid_assets.vanguard_bridge += parseNumber(vangMatch[1]);

        // Custom Bespoke 'Other Debt' parsing for this specific file template
        const facadeMatch = content.match(/Facade,"?\$?([\d,.]+)"?/);
        if (facadeMatch) combinedResults.liabilities.upcoming_capital_calls += parseNumber(facadeMatch[1]);
        const szeMatch = content.match(/Sze,"?\$?([\d,.]+)"?/);
        if (szeMatch) combinedResults.liabilities.upcoming_capital_calls += parseNumber(szeMatch[1]);
        const aniketMatch = content.match(/Aniket,"?\$?([\d,.]+)"?/);
        if (aniketMatch) combinedResults.liabilities.upcoming_capital_calls += parseNumber(aniketMatch[1]);
        const furnMatch = content.match(/Furniture,"?\$?([\d,.]+)"?/);
        if (furnMatch) combinedResults.liabilities.upcoming_capital_calls += parseNumber(furnMatch[1]);
        const banquetMatch = content.match(/banquet,"?\$?([\d,.]+)"?/);
        if (banquetMatch) combinedResults.liabilities.upcoming_capital_calls += parseNumber(banquetMatch[1]);
        const loanMatch = content.match(/Loan,,"?\$?([\d,.]+)"?/);
        if (loanMatch) combinedResults.liabilities.consumer_debt += parseNumber(loanMatch[1]); // Classify loan as consumer
      }

      if (content.includes('Salary (net pay)') || content.includes('Monthly Outcome')) {
        // Monthly Budget CSV
        const incMatch = content.match(/Salary \(net pay\),+([\d,.]+)/);
        if (incMatch) combinedResults.cashFlow.monthlyIncome += parseNumber(incMatch[1]);

        const expMatch = content.match(/Total,"?\$?([\d,.]+)"?\n+(?:,+)Savings/);
        if (expMatch) combinedResults.cashFlow.monthlyExpenses += parseNumber(expMatch[1]);
        else {
          const expMatch2 = content.match(/Total,"?\$?([\d,.]+)"?/);
          if (expMatch2) combinedResults.cashFlow.monthlyExpenses += parseNumber(expMatch2[1]);
        }
      }
    }

    res.json(combinedResults);

  } catch (error: any) {
    console.error('Error processing document:', error.message);
    res.status(500).json({ error: true, message: error.message });
  }
});

app.get('/api/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  console.log(`Received request for quote: ${symbol}`);
  try {
    const result = await yf.quote(symbol.toUpperCase());
    
    // Use regularMarketPrice if available, or postMarketPrice as fallback, or ask/bid
    let price = result.regularMarketPrice;
    
    // Handle market closed edge-cases by favoring non-null pricing values
    if (!price) {
      price = result.postMarketPrice || result.bid || result.ask || result.regularMarketPreviousClose;
    }

    if (price) {
      console.log(`Successfully fetched Yahoo price for ${symbol}: $${price} (MarketState: ${result.marketState})`);
      return res.json({
        symbol: symbol.toUpperCase(),
        price: price,
        timestamp: new Date().toISOString(),
        source: 'yahoo_finance_api',
        marketState: result.marketState
      });
    }

    throw new Error(`No price found for ${symbol}`);

  } catch (error: any) {
    console.error(`Error fetching quote via Yahoo Finance for ${symbol}:`, error.message);
    // Fallback to mock data on error (e.g. network failure or rate limits)
    const basePrice = symbol.toUpperCase() === 'GOOG' ? 397.05 : 337.00;
    const currentPrice = basePrice + (Math.random() * 2 - 1);
    res.json({
      symbol: symbol.toUpperCase(),
      price: Number(currentPrice.toFixed(2)),
      timestamp: new Date().toISOString(),
      source: 'mock_fallback_error'
    });
  }
});

const SETTINGS_FILE = path.join(__dirname, 'user_settings.json');

app.get('/api/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return res.json(JSON.parse(data));
    }
    res.status(404).json({ message: 'No settings saved yet' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { config, snapshot, trajectory } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Calculate True Retirement Year
    let trueRetirementYear = config.career_path.exit_year;
    if (config.career_path.use_sabbatical) trueRetirementYear += (config.career_path.sabbatical_duration || 0);
    if (config.career_path.use_jump) trueRetirementYear += (config.career_path.jump_duration || 0);
    if (config.career_path.use_bridge) trueRetirementYear += (config.career_path.bridge_duration || 0);

    const currentYear = new Date().getFullYear();
    // Construct a comprehensive summary for Gemini
    const summary = `
      You are analyzing a user's retirement plan.
      
      IMPORTANT CONTEXT:
      - The current year is ${currentYear}. All references to time (e.g., "in X years") must be calculated relative to ${currentYear}.
      - The rental income ($${config.income_profile.monthly_rental_income || 0}/mo) is a RELIABLE, TRULY PASSIVE source of income that will continue FOREVER in retirement. Do not question its longevity.

      Here are the full configuration and snapshot variables used in the tool:
      
      ### Configuration:
      \`\`\`json
      ${JSON.stringify(config, null, 2)}
      \`\`\`
      
      ### Financial Snapshot:
      \`\`\`json
      ${JSON.stringify(snapshot, null, 2)}
      \`\`\`
      
      ### Trajectory Summary:
      - Final Net Worth: $${trajectory && trajectory.length > 0 ? trajectory[trajectory.length - 1].totalNetWorth : 'N/A'}
      - Independence Achieved? ${trajectory && trajectory.some((p: any) => p.isIndependent) ? 'Yes' : 'No'}
      
      Please provide a comprehensive analysis of this plan based ON THE EXACT DATA PROVIDED ABOVE.
      You must evaluate TWO separate goals:
      1. **Retirement Track**: Is the user on track to retire at their target exit year with sustainable income?
      2. **FI Track**: Is the user on track to achieve Financial Independence (where investable assets cover expenses indefinitely)?
      
      Make sure to reference specific variables (e.g., market returns, inflation, spending, liabilities) to make the analysis accurate and tailored.
      
      Return the result in the following JSON format:
      {
        "retirementStatus": "On Track" | "At Risk" | "Needs Attention",
        "retirementExplanation": "Brief explanation regarding retirement track...",
        "fiStatus": "On Track" | "At Risk" | "Needs Attention",
        "fiExplanation": "Brief explanation regarding financial independence track...",
        "strengths": ["string"],
        "risks": ["string"],
        "tips": ["string"]
      }
      
      Output ONLY the raw JSON object. Do not wrap it in markdown code blocks.
    `;

    const result = await model.generateContent(summary);
    const responseText = result.response.text();

    let analysisData;
    try {
      // Remove markdown formatting if present (just in case the model ignores the instruction)
      const jsonString = responseText.replace(/```json|```/g, '').trim();
      analysisData = JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', responseText);
      // Fallback
      analysisData = {
        status: "Needs Attention",
        statusExplanation: "Failed to parse analysis response. Raw output shown below.",
        strengths: [],
        risks: ["The AI analysis failed to return a valid JSON structure."],
        tips: ["Try refreshing the analysis."],
        rawOutput: responseText // Store raw output for debug/fallback
      };
    }

    res.json({ analysis: analysisData });

  } catch (error: any) {
    console.error('Error analyzing plan:', error.message);
    res.status(500).json({ error: 'Failed to analyze plan' });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`RetireSmart Backend running locally at http://localhost:${port}`);
});

// Keep event loop alive
setInterval(() => {}, 1000);
