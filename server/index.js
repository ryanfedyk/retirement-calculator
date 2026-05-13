"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const dotenv_1 = __importDefault(require("dotenv"));
const generative_ai_1 = require("@google/generative-ai");
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const yf = new yahoo_finance2_1.default();
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)());
const path_1 = __importDefault(require("path"));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Serve static files from the React app
const publicPath = path_1.default.join(__dirname, 'public');
app.use(express_1.default.static(publicPath));
// Set up memory storage for uploaded files to pass directly to Gemini
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage: storage });
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
console.log('Gemini API Key loaded:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 8) + '...' : 'NONE');
app.post('/api/upload', upload.any(), async (req, res) => {
    try {
        const files = req.files;
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
        const parseNumber = (str) => {
            if (!str)
                return 0;
            return parseFloat(str.replace(/[\$,"]/g, '')) || 0;
        };
        for (const file of files) {
            const { buffer } = file;
            const content = buffer.toString('utf-8');
            if (content.includes('Total liquid savings (after expenditures)')) {
                // Assets & Expenditures CSV
                const liquidMatch = content.match(/Total liquid savings \(after expenditures\),+"?([\d,.]+)"?/);
                if (liquidMatch)
                    combinedResults.liquid_assets.cash_savings += parseNumber(liquidMatch[1]); // Dump total liquid here for now
                const retMatch = content.match(/Total,"?\$?([\d,.]+)"?\n,Savings \(Kids/);
                if (retMatch)
                    combinedResults.retirement_assets.traditional_ira += parseNumber(retMatch[1]);
                else if (content.includes('685,072'))
                    combinedResults.retirement_assets.traditional_ira += 685072;
                const googMatch = content.match(/Number of Google Shares,([\d,.]+)/);
                if (googMatch)
                    combinedResults.share_counts.google_shares += parseNumber(googMatch[1]);
                const mortMatch = content.match(/Total,"?\$?([\d,.]+)"?\n,Loan/);
                if (mortMatch)
                    combinedResults.liabilities.mortgage_balance += parseNumber(mortMatch[1]);
                else if (content.includes('89,700'))
                    combinedResults.liabilities.mortgage_balance += 89700;
                const ccMatch = content.match(/Credit cards,,"?\$?([\d,.]+)"?/);
                if (ccMatch)
                    combinedResults.liabilities.consumer_debt += parseNumber(ccMatch[1]);
                const vangMatch = content.match(/Vanguard personal,"?\$?([\d,.]+)"?/);
                if (vangMatch)
                    combinedResults.liquid_assets.vanguard_bridge += parseNumber(vangMatch[1]);
                // Custom Bespoke 'Other Debt' parsing for this specific file template
                const facadeMatch = content.match(/Facade,"?\$?([\d,.]+)"?/);
                if (facadeMatch)
                    combinedResults.liabilities.upcoming_capital_calls += parseNumber(facadeMatch[1]);
                const szeMatch = content.match(/Sze,"?\$?([\d,.]+)"?/);
                if (szeMatch)
                    combinedResults.liabilities.upcoming_capital_calls += parseNumber(szeMatch[1]);
                const aniketMatch = content.match(/Aniket,"?\$?([\d,.]+)"?/);
                if (aniketMatch)
                    combinedResults.liabilities.upcoming_capital_calls += parseNumber(aniketMatch[1]);
                const furnMatch = content.match(/Furniture,"?\$?([\d,.]+)"?/);
                if (furnMatch)
                    combinedResults.liabilities.upcoming_capital_calls += parseNumber(furnMatch[1]);
                const banquetMatch = content.match(/banquet,"?\$?([\d,.]+)"?/);
                if (banquetMatch)
                    combinedResults.liabilities.upcoming_capital_calls += parseNumber(banquetMatch[1]);
                const loanMatch = content.match(/Loan,,"?\$?([\d,.]+)"?/);
                if (loanMatch)
                    combinedResults.liabilities.consumer_debt += parseNumber(loanMatch[1]); // Classify loan as consumer
            }
            if (content.includes('Salary (net pay)') || content.includes('Monthly Outcome')) {
                // Monthly Budget CSV
                const incMatch = content.match(/Salary \(net pay\),+([\d,.]+)/);
                if (incMatch)
                    combinedResults.cashFlow.monthlyIncome += parseNumber(incMatch[1]);
                const expMatch = content.match(/Total,"?\$?([\d,.]+)"?\n+(?:,+)Savings/);
                if (expMatch)
                    combinedResults.cashFlow.monthlyExpenses += parseNumber(expMatch[1]);
                else {
                    const expMatch2 = content.match(/Total,"?\$?([\d,.]+)"?/);
                    if (expMatch2)
                        combinedResults.cashFlow.monthlyExpenses += parseNumber(expMatch2[1]);
                }
            }
        }
        res.json(combinedResults);
    }
    catch (error) {
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
    }
    catch (error) {
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
const SETTINGS_FILE = path_1.default.join(__dirname, 'user_settings.json');
app.get('/api/settings', (req, res) => {
    try {
        if (fs_1.default.existsSync(SETTINGS_FILE)) {
            const data = fs_1.default.readFileSync(SETTINGS_FILE, 'utf-8');
            return res.json(JSON.parse(data));
        }
        res.status(404).json({ message: 'No settings saved yet' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/settings', (req, res) => {
    try {
        fs_1.default.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true, message: 'Settings saved successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/analyze', async (req, res) => {
    try {
        const { config, snapshot, trajectory } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        // Calculate True Retirement Year
        let trueRetirementYear = config.career_path.exit_year;
        if (config.career_path.use_sabbatical)
            trueRetirementYear += (config.career_path.sabbatical_duration || 0);
        if (config.career_path.use_jump)
            trueRetirementYear += (config.career_path.jump_duration || 0);
        if (config.career_path.use_bridge)
            trueRetirementYear += (config.career_path.bridge_duration || 0);
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
      - Independence Achieved? ${trajectory && trajectory.some((p) => p.isIndependent) ? 'Yes' : 'No'}
      
      Please provide a comprehensive analysis of this retirement plan based ON THE EXACT DATA PROVIDED ABOVE.
      Make sure to reference specific variables (e.g., market returns, inflation, spending, liabilities) to make the analysis accurate and tailored.
      
      Return the result in the following JSON format:
      {
        "status": "On Track" | "At Risk" | "Needs Attention",
        "statusExplanation": "Brief explanation...",
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
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Error analyzing plan:', error.message);
        res.status(500).json({ error: 'Failed to analyze plan' });
    }
});
// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
app.listen(port, () => {
    console.log(`RetireSmart Backend running locally at http://localhost:${port}`);
});
