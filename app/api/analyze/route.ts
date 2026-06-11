import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { config, snapshot, trajectory } = await req.json();

    // Try flash models in order of preference / quota availability
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const currentYear = new Date().getFullYear();

    let trueRetirementYear = config.career_path.exit_year;
    if (config.career_path.use_sabbatical) trueRetirementYear += (config.career_path.sabbatical_duration || 0);
    if (config.career_path.use_jump)       trueRetirementYear += (config.career_path.jump_duration || 0);
    if (config.career_path.use_bridge)     trueRetirementYear += (config.career_path.bridge_duration || 0);

    const finalNW     = trajectory?.length > 0 ? trajectory[trajectory.length - 1].totalNetWorth : "N/A";
    const fiAchieved  = trajectory?.some((p: any) => p.isIndependent) ? "Yes" : "No";
    const indepPoint  = trajectory?.find((p: any) => p.isIndependent);

    const prompt = `
You are a world-class financial planner analyzing a retirement plan for a tech professional.

IMPORTANT CONTEXT:
- Current year: ${currentYear}
- True retirement year (after all career phases): ${trueRetirementYear}
- All time references must be relative to ${currentYear}
- Rental income ($${config.income_profile.monthly_rental_income || 0}/mo) is RELIABLE PASSIVE income continuing forever in retirement

### Configuration:
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

### Financial Snapshot:
\`\`\`json
${JSON.stringify({
  ...snapshot,
  other_investments: snapshot.other_investments?.slice(0, 10), // truncate for token budget
}, null, 2)}
\`\`\`

### Trajectory Summary:
- Final Net Worth (30-year horizon): $${finalNW}
- Financial Independence Achieved? ${fiAchieved}
${indepPoint ? `- FI Date: ${indepPoint.date}` : ""}

Please evaluate TWO separate goals:
1. **Retirement Track** — Is the user on track to retire at ${config.career_path.exit_year} with sustainable income?
2. **FI Track** — Is the user on track to achieve Financial Independence where assets cover expenses indefinitely?

Be specific: reference actual numbers from the data (salary, GOOG shares, spending, market rates, etc). Be direct and personal — this is their actual plan, not a hypothetical.

Return ONLY raw JSON in this exact shape (no markdown, no code fences):
{
  "retirementStatus": "On Track" | "At Risk" | "Needs Attention",
  "retirementExplanation": "2-3 sentence explanation referencing actual numbers...",
  "fiStatus": "On Track" | "At Risk" | "Needs Attention",
  "fiExplanation": "2-3 sentence explanation referencing actual numbers...",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "risks": ["specific risk 1", "specific risk 2", "specific risk 3"],
  "tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}
`;

    const result       = await model.generateContent(prompt);
    const responseText = result.response.text();

    let analysisData;
    try {
      const clean = responseText.replace(/```json|```/g, "").trim();
      analysisData = JSON.parse(clean);
    } catch {
      analysisData = {
        retirementStatus: "Needs Attention",
        retirementExplanation: "Analysis returned an unexpected format.",
        fiStatus: "Needs Attention",
        fiExplanation: "Analysis returned an unexpected format.",
        strengths: [],
        risks: ["Failed to parse AI response."],
        tips: ["Try refreshing the analysis."],
        rawOutput: responseText,
      };
    }

    return NextResponse.json({ analysis: analysisData });
  } catch (err: any) {
    console.error("Analyze error:", err.message);
    return NextResponse.json({ error: "Analysis failed", detail: err.message }, { status: 500 });
  }
}
