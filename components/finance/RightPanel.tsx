"use client";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Flag, CheckCircle, TrendingUp, CalendarDays, RefreshCw, Sparkles } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation } from "@/engine/calculator";
import type { TrajectoryPoint } from "@/engine/calculator";
import { C } from "@/config/colors";
import LifeCalendar from "./LifeCalendar";
import type { LivePrices } from "./FinancialDashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

type ChartView = "wealth" | "income" | "expenses" | "timeline";

// ── Reference line pill label ─────────────────────────────────────────────────
// Renders a readable chip with background directly on the chart SVG
const RefLabel = (props: any) => {
  const { viewBox, value, fill, yOffset = 0 } = props;
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const w = value.length * 6.2 + 12;
  const lx = x - w / 2;
  const ly = y + yOffset - 13;
  return (
    <g>
      <rect x={lx} y={ly} width={w} height={16} rx={4}
        fill={fill} fillOpacity={0.15} stroke={fill} strokeOpacity={0.35} strokeWidth={0.8} />
      <text x={x} y={ly + 11} textAnchor="middle"
        fill={fill} fontSize={10} fontWeight={700} fontFamily="ui-sans-serif, system-ui, sans-serif">
        {value}
      </text>
    </g>
  );
};

// ── Summary cards ─────────────────────────────────────────────────────────────

const SummaryCard = ({
  label, value, sub, icon: Icon, iconBg, iconColor, children,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  children?: React.ReactNode;
}) => (
  <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkFaint, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.02em", color: C.ink }}>{value}</div>
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={iconColor} />
      </div>
    </div>
    {children ?? <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8 }}>{sub}</div>}
  </div>
);

// ── Chart view tab ────────────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
    background: active ? C.bgCard : "transparent",
    color: active ? C.ink : C.inkSoft,
    fontSize: 11, fontWeight: active ? 600 : 400,
    boxShadow: active ? `0 1px 3px ${C.border}` : "none",
    transition: "all 0.15s",
  }}>{children}</button>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label, birthYear }: any) => {
  if (!active || !payload?.length) return null;
  const parts = (label as string).split(" ");
  const yr = parts.length === 2 ? parseInt(parts[1]) : null;
  const age = yr && birthYear ? yr - birthYear : null;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ color: C.inkSoft, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}{age ? ` · Age ${age}` : ""}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.color ?? C.inkSoft }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
            {fmtM(p.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  livePrices:       LivePrices;
  pricesUpdatedAt:  Date | null;
  pricesFetching:   boolean;
  onRefreshPrices:  () => void;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function RightPanel({ livePrices, pricesUpdatedAt, pricesFetching, onRefreshPrices }: Props) {
  const { snapshot, config } = useFinancialStore();
  const [chartView, setChartView] = useState<ChartView>("wealth");

  // AI Analysis
  type AnalysisStatus = "On Track" | "At Risk" | "Needs Attention";
  interface Analysis {
    retirementStatus: AnalysisStatus;
    retirementExplanation: string;
    fiStatus: AnalysisStatus;
    fiExplanation: string;
    strengths: string[];
    risks: string[];
    tips: string[];
    rawOutput?: string;
  }
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Year currently hovered on the chart — reveals subtle (secondary) milestones
  const [hoverYear, setHoverYear] = useState<string | null>(null);

  // ── Derive live GOOG price and overall price status ───────────────────────
  const googInfo     = livePrices["GOOG"] ?? livePrices["GOOGL"];
  const liveGoogPrice = googInfo?.price ?? 0;
  const priceStatus   = !googInfo
    ? "loading"
    : googInfo.source === "yahoo" ? "live" : "fallback";

  // ── Enrich snapshot with live prices for ALL holdings ────────────────────
  // This is what the simulation engine actually sees — never stale.
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map(inv => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  // ── Simulations (all use enriched snapshot) ───────────────────────────────
  const trajectoryData = useMemo(
    () => runSimulation(enrichedSnapshot, config, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );

  const earlierData = useMemo(() =>
    runSimulation(enrichedSnapshot, { ...config, career_path: { ...config.career_path, exit_year: config.career_path.exit_year - 1 } }, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );
  const laterData = useMemo(() =>
    runSimulation(enrichedSnapshot, { ...config, career_path: { ...config.career_path, exit_year: config.career_path.exit_year + 1 } }, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );

  // Key metrics
  const indepPoint     = trajectoryData.find(d => d.isIndependent);
  const todayPoint     = trajectoryData[0];
  const currentNW      = todayPoint?.totalNetWorth ?? 0;
  const swrTarget      = todayPoint?.swrTarget ?? 0;
  const progress       = swrTarget > 0 ? Math.min(100, (currentNW / swrTarget) * 100) : 0;
  const birthYear      = config.birth_year ?? 1980;

  // Chart data
  const chartData = useMemo(() => trajectoryData.map((pt, i) => ({
    ...pt,
    earlierNetWorth:  earlierData[i]?.totalNetWorth ?? 0,
    laterNetWorth:    laterData[i]?.totalNetWorth   ?? 0,
    // Use the pre-computed net fields — no subtraction, no negatives
    salaryAndEquity:  pt.salaryAndEquityNet,
    rentalNet:        pt.rentalIncomeNet,
    socialSecurity:   pt.socialSecurityNet,
    lifestyleExpense: pt.lifestyleExpense || 0,
    healthcareCost:   pt.healthcareCost   || 0,
    mortgagePayment:  pt.mortgagePayment  || 0,
  })), [trajectoryData, earlierData, laterData]);

  // Reference lines for phases / milestones
  const findDate = (pred: (p: TrajectoryPoint) => boolean) => trajectoryData.find(pred)?.date;

  const retireDateStr  = findDate(p => p.date.includes(String(config.career_path.exit_year)));
  const sabbDateStr    = trajectoryData.some(d => d.currentPhase === "SABBATICAL") ? findDate(d => d.currentPhase === "SABBATICAL") : null;
  const jumpDateStr    = trajectoryData.some(d => d.currentPhase === "JUMP")       ? findDate(d => d.currentPhase === "JUMP")       : null;
  const bridgeDateStr  = trajectoryData.some(d => d.currentPhase === "BRIDGE")     ? findDate(d => d.currentPhase === "BRIDGE")     : null;
  const ssDateStr      = config.social_security ? findDate(p => p.date.includes(String(birthYear + config.social_security!.start_age))) : null;
  const medDateStr     = config.medicare        ? findDate(p => p.date.includes(String(birthYear + config.medicare!.start_age)))        : null;
  const mortgageDateStr = findDate(p => p.date === "Jun 2051");
  const enDateStr      = config.spending.empty_nest_year ? findDate(p => p.date.includes(String(config.spending.empty_nest_year))) : null;

  // Compact label for a life event ("Oona — College Year 1" → "🎓 Oona Yr1")
  const lifeEventLabel = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("college")) {
      const child = name.split("—")[0].trim().split(" ")[0];
      const yr    = (name.match(/year\s*(\d)/i) || [])[1];
      return `🎓 ${child}${yr ? ` Yr${yr}` : ""}`;
    }
    if (lower.includes("renov")) return "🏠 Reno";
    if (lower.includes("wedding")) return "💍";
    return name.length > 12 ? name.slice(0, 12) + "…" : name;
  };

  const yearOf = (dateStr: string) => dateStr.split(" ")[1] ?? dateStr;

  // Milestone model: `primary` ones are always visible; `secondary` ones render
  // subtly (faint line, no pill) until the user hovers over that year on the chart.
  type Milestone = { x: string; stroke: string; label: string; primary: boolean };

  const milestones: Milestone[] = (() => {
    const m: Milestone[] = [];
    // Primary — the headline financial milestones
    if (retireDateStr)   m.push({ x: retireDateStr,   stroke: "#2a7a68", label: "Retire",     primary: true  });
    if (indepPoint)      m.push({ x: indepPoint.date, stroke: "#80c4ae", label: "FI",         primary: true  });
    if (mortgageDateStr) m.push({ x: mortgageDateStr, stroke: "#9bbdb4", label: "Paid Off",   primary: true  });
    if (enDateStr)       m.push({ x: enDateStr,       stroke: C.warm,    label: "Empty Nest", primary: true  });
    // Secondary — career phases, benefits, and life events (subtle until hovered)
    if (sabbDateStr)     m.push({ x: sabbDateStr,     stroke: C.warm,    label: "Sabbatical", primary: false });
    if (jumpDateStr)     m.push({ x: jumpDateStr,     stroke: "#4aab92", label: "Jump",       primary: false });
    if (bridgeDateStr)   m.push({ x: bridgeDateStr,   stroke: C.teal,    label: "Bridge",     primary: false });
    if (ssDateStr)       m.push({ x: ssDateStr,       stroke: C.warm,    label: "Soc. Sec.",  primary: false });
    if (medDateStr)      m.push({ x: medDateStr,      stroke: "#9bbdb4", label: "Medicare",   primary: false });
    // Life events from config (college years, renovation, …)
    for (const ev of config.life_events ?? []) {
      const x = findDate(p => p.date.includes(String(ev.year)));
      if (x) m.push({ x, stroke: "#b9895e", label: lifeEventLabel(ev.name), primary: false });
    }
    return m;
  })();

  // yOffset staggering so simultaneously-visible pills don't overlap.
  const renderRefLines = () => (
    <>
      {milestones.map(({ x, stroke, label, primary }, i) => {
        const revealed = primary || yearOf(x) === hoverYear;
        const yOffset  = (i % 3) * 22;
        return (
          <ReferenceLine
            key={`${label}-${x}`}
            x={x}
            stroke={stroke}
            strokeDasharray="3 3"
            strokeWidth={revealed ? 1.3 : 1}
            strokeOpacity={revealed ? 0.75 : 0.18}
            label={revealed ? <RefLabel value={label} fill={stroke} yOffset={yOffset} /> : undefined}
          />
        );
      })}
    </>
  );

  return (
    <main style={{ flex: 1, background: C.bg, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── GOOG price bar ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 16px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: priceStatus === "live" ? C.teal : C.warm, boxShadow: priceStatus === "live" ? `0 0 6px ${C.teal}` : "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMid }}>GOOG</span>
          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: C.ink }}>
            {liveGoogPrice > 0 ? `$${liveGoogPrice.toFixed(2)}` : "–"}
          </span>
          {pricesUpdatedAt && (
            <span style={{ fontSize: 9, color: C.inkFaint, letterSpacing: "0.03em" }}>
              as of {pricesUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={onRefreshPrices} disabled={pricesFetching} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex", alignItems: "center", padding: 0 }}>
            <RefreshCw size={12} style={{ animation: pricesFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <SummaryCard
          label="Independence Date"
          value={indepPoint ? indepPoint.date : "30+ Yrs"}
          sub={indepPoint ? "You are on track to reach FI." : "Adjust strategy to reach FI."}
          icon={Flag}
          iconBg={indepPoint ? C.tealWash : C.borderSoft}
          iconColor={indepPoint ? C.teal : C.inkFaint}
        />
        <SummaryCard
          label="Target Net Worth"
          value={`$${(swrTarget / 1_000_000).toFixed(2)}M`}
          sub={`Based on $${((config.spending.monthly_lifestyle + config.spending.healthcare_premium) / 1000).toFixed(1)}k/mo spend`}
          icon={CheckCircle}
          iconBg={C.tealWash}
          iconColor={C.teal}
        />
        <SummaryCard
          label="Portfolio Strength"
          value={`${progress.toFixed(0)}%`}
          sub=""
          icon={TrendingUp}
          iconBg={C.warmWash}
          iconColor={C.warm}
        >
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 99, background: C.borderSoft }}>
              <div style={{ height: "100%", borderRadius: 99, background: C.teal, width: `${progress}%`, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 4 }}>
              ${(currentNW / 1_000_000).toFixed(2)}M of ${(swrTarget / 1_000_000).toFixed(2)}M target
            </div>
          </div>
        </SummaryCard>
      </div>

      {/* ── Main chart ── */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
        display: "flex", flexDirection: "column",
        height: chartView === "timeline" ? 580 : 536,
        transition: "height 0.3s ease",
      }}>
        {/* Chart header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
              {chartView === "timeline" ? "Life & Career Timeline" :
               chartView === "income"   ? "Income Breakdown" :
               chartView === "expenses" ? "Expense Breakdown" :
               "Wealth Trajectory"}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
              {chartView === "timeline" ? "Month-by-month phases & milestones" : "Nominal 30-year projection (future dollars)"}
            </div>
          </div>

          <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, gap: 2 }}>
            {(["wealth", "income", "expenses"] as ChartView[]).map(v => (
              <TabBtn key={v} active={chartView === v} onClick={() => setChartView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </TabBtn>
            ))}
            <div style={{ width: 1, background: C.border, margin: "4px 2px" }} />
            <TabBtn active={chartView === "timeline"} onClick={() => setChartView("timeline")}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <CalendarDays size={11} /> Timeline
              </span>
            </TabBtn>
          </div>
        </div>

        {/* Chart body */}
        <div style={{ flex: 1, padding: "8px 20px 16px", minHeight: 0, overflow: "hidden" }}>
          {chartView === "timeline" ? (
            <LifeCalendar data={trajectoryData} config={config} />
          ) : (
            <ResponsiveContainer width="100%" height={446}>
              <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                onMouseMove={(s: any) => { if (s?.activeLabel) setHoverYear(yearOf(String(s.activeLabel))); }}
                onMouseLeave={() => setHoverYear(null)}>
                <defs>
                  <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.teal} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal}  stopOpacity={0.8} />
                    <stop offset="95%" stopColor={C.teal}  stopOpacity={0.3} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderSoft} />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fill: C.inkFaint, fontSize: 10 }} minTickGap={32} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: C.inkFaint, fontSize: 10 }}
                  tickFormatter={fmtM} width={52}
                  domain={chartView === "wealth" ? ["auto", "auto"] : [0, "auto"]} />
                <Tooltip content={<ChartTooltip birthYear={birthYear} />} />

                {chartView === "wealth" && (
                  <>
                    <Area type="monotone" dataKey="totalNetWorth" stroke={C.teal} strokeWidth={2.5}
                      fill="url(#wealthGrad)" name="Active Strategy" />
                    <Line type="monotone" dataKey="earlierNetWorth" stroke="#80c4ae" strokeWidth={1.5}
                      strokeDasharray="4 4" dot={false} name="Exit 1yr Early" />
                    <Line type="monotone" dataKey="laterNetWorth" stroke={C.warm} strokeWidth={1.5}
                      strokeDasharray="4 4" dot={false} name="Exit 1yr Late" />
                    {renderRefLines()}
                  </>
                )}

                {chartView === "income" && (
                  <>
                    <Area type="monotone" dataKey="salaryAndEquity" stackId="1" stroke={C.teal}    fill={C.teal}    fillOpacity={0.7} name="Salary & Equity" />
                    <Area type="monotone" dataKey="rentalNet"       stackId="1" stroke="#4aab92"   fill="#4aab92"   fillOpacity={0.7} name="Rental Income" />
                    <Area type="monotone" dataKey="socialSecurity"  stackId="1" stroke={C.warm}    fill={C.warm}    fillOpacity={0.7} name="Social Security" />
                  </>
                )}

                {chartView === "expenses" && (
                  <>
                    <Area type="monotone" dataKey="lifestyleExpense" stackId="1" stroke={C.teal}    fill={C.teal}    fillOpacity={0.7} name="Lifestyle" />
                    <Area type="monotone" dataKey="healthcareCost"   stackId="1" stroke="#c4784e"   fill="#c4784e"   fillOpacity={0.7} name="Healthcare" />
                    <Area type="monotone" dataKey="mortgagePayment"  stackId="1" stroke="#9bbdb4"   fill="#9bbdb4"   fillOpacity={0.7} name="Mortgage" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Career phase legend ── */}
      {chartView === "wealth" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Active Strategy",  color: C.teal,    dash: false },
            { label: "Exit 1yr Early",   color: "#80c4ae", dash: true  },
            { label: "Exit 1yr Late",    color: C.warm,    dash: true  },
            { label: "Retire",           color: "#2a7a68", dash: true  },
            { label: "FI",              color: "#80c4ae", dash: true  },
            { label: "Mortgage Free",    color: C.inkFaint, dash: true },
          ].map(({ label, color, dash }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.inkSoft }}>
              <div style={{ width: 20, height: 2, background: color, opacity: dash ? 0.8 : 1, borderRadius: 1,
                backgroundImage: dash ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)` : undefined }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* ── AI Analysis ── */}
      {(() => {
        const handleAnalyze = async () => {
          setAnalyzing(true);
          try {
            const res  = await fetch("/api/analyze", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ config, snapshot, trajectory: trajectoryData }),
            });
            const data = await res.json();
            if (!res.ok || !data.analysis) {
              const detail = data.detail || data.error || "Unknown error.";
              setAnalysis({
                retirementStatus: "Needs Attention",
                retirementExplanation: detail,
                fiStatus: "Needs Attention",
                fiExplanation: data.error || "Analysis unavailable.",
                strengths: [],
                risks: [detail],
                tips: ["Update GEMINI_API_KEY in .env.local, then restart the dev server."],
              });
            } else {
              setAnalysis(data.analysis);
            }
          } catch {
            setAnalysis({
              retirementStatus: "Needs Attention",
              retirementExplanation: "Failed to reach analysis service.",
              fiStatus: "Needs Attention",
              fiExplanation: "Failed to reach analysis service.",
              strengths: [],
              risks: ["Analysis request failed — check your connection."],
              tips: ["Try again in a moment."],
            });
          } finally {
            setAnalyzing(false);
          }
        };

        const statusColors: Record<string, { bg: string; border: string; text: string }> = {
          "On Track":        { bg: C.tealWash,  border: C.tealLight, text: C.tealDark  },
          "At Risk":         { bg: "#fef2f2",   border: "#fecaca",   text: "#b91c1c"   },
          "Needs Attention": { bg: C.warmWash,  border: C.warmLight, text: C.warm      },
        };

        return (
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, marginBottom: 16, borderBottom: `1px solid ${C.borderSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={16} color={C.teal} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>AI Plan Analysis</div>
                  <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 1 }}>Powered by Gemini</div>
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 8,
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  color: C.teal, fontSize: 11, fontWeight: 600, cursor: analyzing ? "wait" : "pointer",
                  opacity: analyzing ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} style={{ animation: analyzing ? "spin 1s linear infinite" : "none" }} />
                {analyzing ? "Analyzing…" : analysis ? "Refresh Analysis" : "Run Analysis"}
              </button>
            </div>

            {/* Body */}
            {analyzing ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12, color: C.inkSoft }}>
                <div style={{ width: 32, height: 32, border: `3px solid ${C.tealLight}`, borderTopColor: C.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 12, fontStyle: "italic" }}>Analyzing your financial future…</span>
              </div>
            ) : analysis ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Status cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Retirement Track", status: analysis.retirementStatus, text: analysis.retirementExplanation },
                    { label: "FI Track",          status: analysis.fiStatus,         text: analysis.fiExplanation         },
                  ].map(({ label, status, text }) => {
                    const colors = statusColors[status] ?? statusColors["Needs Attention"];
                    return (
                      <div key={label} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.text, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 6 }}>{status}</div>
                        <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5, opacity: 0.85 }}>{text}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Strengths + Risks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { title: "Key Strengths",    icon: "✓", items: analysis.strengths, color: C.teal     },
                    { title: "Potential Risks",  icon: "⚠", items: analysis.risks,    color: C.warm     },
                  ].map(({ title, icon, items, color }) => (
                    <div key={title} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color }}>{icon}</span> {title}
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                        {items.map((item, i) => (
                          <li key={i} style={{ fontSize: 11, color: C.inkMid, display: "flex", gap: 6, lineHeight: 1.5 }}>
                            <span style={{ color: C.inkFaint, flexShrink: 0 }}>·</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Tips */}
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={12} color={C.warm} /> Optimization Tips
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                    {analysis.tips.map((tip, i) => (
                      <li key={i} style={{ fontSize: 11, color: C.inkMid, display: "flex", gap: 6, lineHeight: 1.5 }}>
                        <span style={{ color: C.warm, flexShrink: 0 }}>→</span> {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {analysis.rawOutput && (
                  <details style={{ fontSize: 10, color: C.inkFaint }}>
                    <summary style={{ cursor: "pointer" }}>Raw output (debug)</summary>
                    <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 9 }}>{analysis.rawOutput}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 10, background: C.bg, borderRadius: 8, border: `1px dashed ${C.border}` }}>
                <Sparkles size={28} color={C.inkFaint} style={{ opacity: 0.4 }} />
                <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, textAlign: "center", maxWidth: 280 }}>
                  Click <strong>Run Analysis</strong> to get a personalized AI assessment of your retirement plan.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
