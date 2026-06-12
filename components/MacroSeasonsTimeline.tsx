"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { C } from "@/config/colors";
import { HORIZON_CONFIG } from "@/config/horizonConfig";
import {
  getCurrentPhase,
  getMonthsInCurrentPhase,
  getMonthsUntilNextPhase,
} from "@/lib/horizonUtils";
import { useRetirementDate } from "@/hooks/useRetirementDate";

const PHASE_ACTIONS: Record<number, { focus: string; actions: string[] }> = {
  1: {
    focus: "Remove yourself as the single point of failure.",
    actions: [
      "Document every key process you own — start this week.",
      "Identify your three most capable direct reports and begin deliberate succession prep.",
      "Stop being the default escalation path. Route decisions back downstream.",
      "Replace 80% of ad-hoc interruptions with one structured 'office hours' block.",
      "Write down what only you know. That list is your delegation backlog.",
    ],
  },
  2: {
    focus: "Force autonomy. Stop rescuing people from their own decisions.",
    actions: [
      "Remove yourself from at least two recurring meetings this month.",
      "Let a decision made without you stand — even if imperfect. Resist the urge to correct it.",
      "Stop responding to messages after 6pm. Permanently. No exceptions.",
      "Measure your team's autonomy score, not your own heroism score.",
      "Cancel one commitment per week that doesn't require you specifically.",
    ],
  },
  3: {
    focus: "Become the advisor, not the operator.",
    actions: [
      "Your calendar should carry 40% unscheduled white space. Protect it aggressively.",
      "Begin the formal succession conversation with HR this quarter.",
      "Ask 'What do you think?' instead of answering. Every single time.",
      "Take one external advisory role as a bridge — board seat, mentor, consultant.",
      "Start a private 'exit memo' — what the org needs to know before you leave.",
    ],
  },
  4: {
    focus: "Execute the glide slope. Nothing new, everything handed off.",
    actions: [
      "Documentation sprint: every system, every contact, every context — written down.",
      "No new long-term commitments. Zero. Full stop.",
      "Plan a proper farewell — not a ghost exit.",
      "Begin living the retirement daily schedule 6 months before you retire.",
      "Schedule your last day and count backward from it.",
    ],
  },
};

const PHASE_PERMISSION: Record<number, string> = {
  1: "You are permitted to stop attending meetings where your presence is optional.",
  2: "You are permitted to let imperfect decisions stand without intervening.",
  3: "You are permitted to take a full week off without checking in.",
  4: "You are permitted to say no to anything that doesn't directly serve the handoff.",
};

export default function MacroSeasonsTimeline() {
  const { retirementDate } = useRetirementDate();
  const current          = getCurrentPhase(retirementDate);
  const monthsIn         = getMonthsInCurrentPhase(retirementDate);
  const monthsUntilNext  = getMonthsUntilNextPhase(retirementDate);
  const [expanded, setExpanded] = useState<number>(current.id);

  const totalPhaseMonths = 12;
  const phaseProgress    = Math.min(100, Math.round((monthsIn / totalPhaseMonths) * 100));

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-10">
        <h2 style={{ color: C.ink }} className="text-2xl font-light tracking-tight mb-2">
          Macro-Seasons
        </h2>
        <p style={{ color: C.inkSoft }} className="text-sm">
          Four phases, four years. A systematic reduction in corporate intensity — each season
          expanding your freedom until the exit is effortless.
        </p>
      </div>

      {/* ── Phase Roadmap Bar ── */}
      <div className="mb-10 p-6 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-4">
          The Taper Roadmap
        </p>

        {/* Segmented bar */}
        <div className="flex rounded-xl overflow-hidden h-8 mb-3" style={{ gap: 2 }}>
          {HORIZON_CONFIG.phases.map((phase, i) => {
            const isActive = phase.id === current.id;
            const isPast   = phase.id < current.id;
            return (
              <div
                key={phase.id}
                className="flex-1 relative flex items-center justify-center cursor-pointer transition-all duration-200"
                style={{
                  backgroundColor: isPast ? `${C.phase[i]}55` : isActive ? C.phase[i] : `${C.phase[i]}33`,
                  borderBottom: isActive ? `3px solid ${C.phase[i]}` : "none",
                }}
                onClick={() => setExpanded(phase.id)}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: isPast ? C.inkFaint : isActive ? "white" : C.inkFaint }}>
                  {phase.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                       style={{ background: C.phase[i] }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Phase labels row */}
        <div className="flex" style={{ gap: 2 }}>
          {HORIZON_CONFIG.phases.map((phase, i) => (
            <div key={phase.id} className="flex-1 text-center">
              <p className="text-[10px]" style={{ color: phase.id === current.id ? C.phase[i] : C.inkFaint }}>
                {phase.name}
              </p>
            </div>
          ))}
        </div>

        {/* Taper curve — SVG intensity visualization */}
        <div className="mt-6">
          <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-3">
            Intensity Taper
          </p>
          <div className="relative" style={{ height: 64 }}>
            <svg width="100%" height="64" preserveAspectRatio="none" viewBox="0 0 400 64">
              {/* Shaded area under the curve */}
              <defs>
                <linearGradient id="taperGrad" x1="0" y1="0" x2="1" y2="0">
                  {HORIZON_CONFIG.phases.map((p, i) => (
                    <stop key={i} offset={`${i * 25 + 12.5}%`} stopColor={C.phase[i]} stopOpacity="0.25" />
                  ))}
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path
                d={`M 0 ${64 - (85 / 100) * 64} L 100 ${64 - (85 / 100) * 64} L 200 ${64 - (65 / 100) * 64} L 300 ${64 - (40 / 100) * 64} L 400 ${64 - (20 / 100) * 64} L 400 64 L 0 64 Z`}
                fill="url(#taperGrad)"
              />
              {/* Line */}
              <polyline
                points={`0,${64 - (85 / 100) * 64} 100,${64 - (85 / 100) * 64} 200,${64 - (65 / 100) * 64} 300,${64 - (40 / 100) * 64} 400,${64 - (20 / 100) * 64}`}
                fill="none"
                stroke={C.teal}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Phase dots */}
              {[85, 65, 40, 20].map((intensity, i) => (
                <circle
                  key={i}
                  cx={i === 0 ? 0 : i * 100}
                  cy={64 - (intensity / 100) * 64}
                  r="4"
                  fill={i + 1 === current.id ? C.teal : C.border}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </svg>
            {/* Y-axis labels */}
            <div className="absolute top-0 left-0 flex flex-col justify-between h-full" style={{ gap: 0, pointerEvents: "none" }}>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>100%</span>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>50%</span>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Current Phase Callout ── */}
      <div className="mb-8 p-6 rounded-2xl" style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-1">
              You are here — {current.label}
            </p>
            <h3 style={{ color: C.ink }} className="text-xl font-semibold mb-1">{current.name}</h3>
            <p style={{ color: C.inkMid }} className="text-sm italic mb-4">{current.tagline}</p>

            {/* Throttle permission */}
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "white", border: `1px solid ${C.tealLight}` }}>
              <div className="w-1 h-full min-h-full rounded-full shrink-0" style={{ background: C.teal, alignSelf: "stretch", minHeight: 20 }} />
              <p style={{ color: C.inkMid }} className="text-sm leading-relaxed">
                <span style={{ color: C.teal }} className="font-semibold">Permission: </span>
                {PHASE_PERMISSION[current.id]}
              </p>
            </div>
          </div>

          <div className="flex gap-6 shrink-0 flex-wrap">
            <div className="text-center">
              <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-1">Months In</p>
              <p style={{ color: C.ink }} className="text-3xl font-extralight tabular-nums">{monthsIn}</p>
              <div className="w-16 h-0.5 rounded-full mt-2 mx-auto" style={{ background: C.border }}>
                <div className="h-full rounded-full" style={{ width: `${phaseProgress}%`, background: C.teal }} />
              </div>
              <p style={{ color: C.inkFaint }} className="text-[10px] mt-1">{phaseProgress}% through</p>
            </div>

            {current.id < 4 && (
              <div className="text-center">
                <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-1">Next Phase In</p>
                <p style={{ color: C.ink }} className="text-3xl font-extralight tabular-nums">{monthsUntilNext}</p>
                <p style={{ color: C.inkFaint }} className="text-[10px] mt-1">months</p>
              </div>
            )}

            <div className="text-center">
              <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-1">Throttle</p>
              <p style={{ color: C.phase[current.id - 1] }} className="text-3xl font-extralight tabular-nums">
                {current.intensity}%
              </p>
              <p style={{ color: C.inkFaint }} className="text-[10px] mt-1">of full output</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Phase Cards — expandable ── */}
      <div className="space-y-3">
        {HORIZON_CONFIG.phases.map((phase, i) => {
          const isActive   = phase.id === current.id;
          const isPast     = phase.id < current.id;
          const isExpanded = expanded === phase.id;
          const color      = C.phase[i];
          const data       = PHASE_ACTIONS[phase.id];

          return (
            <div
              key={phase.id}
              className="rounded-2xl border transition-all duration-300 overflow-hidden"
              style={{
                background:  isExpanded ? C.bgCard : "transparent",
                borderColor: isExpanded ? C.borderSoft : C.borderSoft,
                opacity:     isPast && !isExpanded ? 0.45 : 1,
                boxShadow:   isExpanded && isActive ? "0 2px 20px 0 rgba(58,158,135,0.1)" : "none",
              }}
            >
              {/* Header row — always visible, click to expand */}
              <button
                className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? 0 : phase.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Phase color swatch */}
                  <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${color}22`, color }}>
                        {phase.label}
                      </span>
                      {isActive && (
                        <span style={{ color: C.teal }} className="text-[10px] uppercase tracking-widest font-medium">
                          ← You are here
                        </span>
                      )}
                    </div>
                    <h3 style={{ color: C.ink }} className="text-base font-medium">{phase.name}</h3>
                    {!isExpanded && (
                      <p style={{ color: C.inkSoft }} className="text-xs italic truncate">{phase.tagline}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {/* Intensity mini-bar */}
                  <div className="text-right hidden sm:block">
                    <p style={{ color }} className="text-lg font-extralight tabular-nums">{phase.intensity}%</p>
                    <div className="w-16 h-0.5 rounded-full mt-1 ml-auto" style={{ background: C.border }}>
                      <div className="h-full rounded-full" style={{ width: `${phase.intensity}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div style={{ color: C.inkFaint }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </button>

              {/* Expanded body */}
              {isExpanded && (
                <div className="px-5 pb-6 border-t" style={{ borderColor: C.borderSoft }}>
                  <p style={{ color: C.inkSoft }} className="text-sm italic mt-4 mb-5">{phase.tagline}</p>

                  {/* Weekly focus */}
                  <div className="mb-5 p-4 rounded-xl flex items-start gap-3"
                       style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
                    <div className="w-1 rounded-full shrink-0 mt-0.5" style={{ background: color, alignSelf: "stretch", minHeight: 16 }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color }}>This Phase's Focus</p>
                      <p style={{ color: C.ink }} className="text-sm font-medium leading-relaxed">{data.focus}</p>
                    </div>
                  </div>

                  {/* Action list */}
                  <ul className="space-y-3">
                    {data.actions.map((action, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm" style={{ color: C.inkMid }}>
                        <span className="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold mt-0.5"
                              style={{ borderColor: color, color }}>
                          {j + 1}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
