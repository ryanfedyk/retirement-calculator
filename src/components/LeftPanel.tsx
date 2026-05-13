
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Sliders, RotateCcw, Wallet, Trash2, PlusCircle } from 'lucide-react';

export const LeftPanel: React.FC = () => {
  const { config, snapshot, updateNestedConfig, updateNestedSnapshot, updateConfig } = useStore();

  const [newEvent, setNewEvent] = useState({ name: '', year: 2030, cost: 50000 });
  const [newInv, setNewInv] = useState({ symbol: '', shares: '' });

  const handleReset = () => {
    updateConfig({
      career_path: {
        exit_year: 2030,
        use_jump: false,
        jump_duration: 4,
        use_sabbatical: false,
        sabbatical_duration: 1,
        use_bridge: true,
        bridge_duration: 5
      },
      market_assumptions: { goog_growth_rate: 11.5, market_return_rate: 7.0, inflation_rate: 3.0, volatility_drag: 1.5 },
      divestment_strategy: { type: 'progressive', start_year: 2030, end_year: 2035 },
      spending: { monthly_lifestyle: 8750, healthcare_premium: 2500, mortgage_payment: 7507 }
    });
  };

  return (
    <aside className="w-full md:w-80 flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-gray-200 lg:overflow-y-auto flex flex-col h-auto md:h-full">
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-500" />
            Current Assets & Liabilities
          </h2>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors" title="Reset All Params">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Liquid Assets</label>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Current Liquid Cash (Net)</label>
                <input
                  type="number"
                  value={snapshot.liquid_assets.cash_savings}
                  onChange={(e) => updateNestedSnapshot('liquid_assets', { cash_savings: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Retirement Accounts</label>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">401(k) Balance</label>
                <input
                  type="number"
                  value={snapshot.retirement_assets.k401}
                  onChange={(e) => updateNestedSnapshot('retirement_assets', { k401: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          Configuration
        </h2>


        {/* Career Section */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
            Career Trajectory
          </h3>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <label className="text-slate-600 font-medium">Google Exit Year</label>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{config.career_path.exit_year}</span>
            </div>
            <input
              type="range"
              min={2024}
              max={2040}
              step={1}
              value={config.career_path.exit_year}
              onChange={(e) => {
                const newExitYear = parseInt(e.target.value);
                updateNestedConfig('career_path', { exit_year: newExitYear });
                if (config.divestment_strategy.type === 'progressive') {
                  const windowSize = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
                  updateNestedConfig('divestment_strategy', { 
                    start_year: newExitYear,
                    end_year: newExitYear + windowSize
                  });
                }
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-4">
            {/* Sabbatical Section - Inserted before Jump */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-700 font-medium">Take a Sabbatical?</label>
              <input
                type="checkbox"
                checked={config.career_path.use_sabbatical}
                onChange={(e) => updateNestedConfig('career_path', { use_sabbatical: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>

            {config.career_path.use_sabbatical && (
              <div className="pl-3 border-l-2 border-indigo-100 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Sabbatical Duration (Years)</label>
                  <input
                    type="number"
                    value={config.career_path.sabbatical_duration}
                    onChange={(e) => updateNestedConfig('career_path', { sabbatical_duration: parseInt(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-700 font-medium">Model Career Jump?</label>
              <input
                type="checkbox"
                checked={config.career_path.use_jump}
                onChange={(e) => updateNestedConfig('career_path', { use_jump: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>

            {config.career_path.use_jump && (
              <div className="pl-3 border-l-2 border-indigo-100 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Jump Duration (Years)</label>
                  <input
                    type="number"
                    value={config.career_path.jump_duration}
                    onChange={(e) => updateNestedConfig('career_path', { jump_duration: parseInt(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Jump Annual Base Salary</label>
                  <input
                    type="number"
                    value={config.income_profile.jump_gross_annual}
                    onChange={(e) => updateNestedConfig('income_profile', { jump_gross_annual: parseFloat(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Jump Bonus Target (%)</label>
                  <input
                    type="number"
                    value={config.income_profile.jump_bonus_rate || 0}
                    onChange={(e) => updateNestedConfig('income_profile', { jump_bonus_rate: parseFloat(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 15"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Jump Annual Equity ($)</label>
                  <input
                    type="number"
                    value={config.income_profile.jump_grant_monthly * 12} // Display as annual
                    onChange={(e) => updateNestedConfig('income_profile', { jump_grant_monthly: parseFloat(e.target.value) / 12 })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="text-sm text-slate-700 font-medium">Model Bridge Role?</label>
              <input
                type="checkbox"
                checked={config.career_path.use_bridge}
                onChange={(e) => updateNestedConfig('career_path', { use_bridge: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>

            {config.career_path.use_bridge && (
              <div className="pl-3 border-l-2 border-indigo-100 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Bridge Duration (Years)</label>
                  <input
                    type="number"
                    value={config.career_path.bridge_duration}
                    onChange={(e) => updateNestedConfig('career_path', { bridge_duration: parseInt(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Bridge Annual Gross Salary ($)</label>
                  <input
                    type="number"
                    value={config.income_profile.bridge_gross_annual || 0}
                    onChange={(e) => updateNestedConfig('income_profile', { bridge_gross_annual: parseFloat(e.target.value) })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5"
                  />
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="bridge_health"
                    checked={config.income_profile.bridge_has_health_insurance || false}
                    onChange={(e) => updateNestedConfig('income_profile', { bridge_has_health_insurance: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="bridge_health" className="text-xs text-slate-700 font-medium ml-2">Supplies Health Ins.</label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Income Parameters */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
            Income Modeling
          </h3>

          <div className="mb-4">
            <label className="text-xs text-slate-500 block mb-1">Gross Annual Salary ($)</label>
            <input
              type="number"
              step="1000"
              value={config.income_profile.gross_annual_salary || 0}
              onChange={(e) => {
                const gross = parseInt(e.target.value) || 0;
                // Auto-calculate Net Monthly using tax engine logic simulation
                // For now, simpler approximation or import tax calc?
                // Since importing tax engine might cycle deps or be heavy, let's use a robust approximation:
                // Net ~ Gross * 0.65 (Effective tax rate 35% for high earners in CA/NY)
                // This is a placeholder until we wire up the full engine reactively if needed, 
                // but user asked for "calculate everything for them".
                // We can use the updateNestedConfig to update BOTH gross and net.
                const estimatedNetAnnual = gross * 0.65;
                const estimatedNetMonthly = Math.round(estimatedNetAnnual / 12);

                updateNestedConfig('income_profile', {
                  gross_annual_salary: gross,
                  google_net_monthly: estimatedNetMonthly
                });
              }}
              className="w-full text-sm border border-slate-200 rounded p-1.5"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-right">
              Est. Net Monthly: ${config.income_profile.google_net_monthly.toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Annual Raise (%)</label>
              <input
                type="number"
                step="0.1"
                value={config.income_profile.income_growth_rate ?? 0}
                onChange={(e) => updateNestedConfig('income_profile', { income_growth_rate: parseFloat(e.target.value) })}
                className="w-full text-sm border border-slate-200 rounded p-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target Bonus (%)</label>
              <input
                type="number"
                step="1"
                value={config.income_profile.target_bonus_rate ?? 0}
                onChange={(e) => updateNestedConfig('income_profile', { target_bonus_rate: parseFloat(e.target.value) })}
                className="w-full text-sm border border-slate-200 rounded p-1.5"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Current Unvested Shares (Count)</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="number"
                  step="1"
                  placeholder="Total Shares"
                  value={config.income_profile.initial_unvested_shares ?? 0}
                  onChange={(e) => updateNestedConfig('income_profile', { initial_unvested_shares: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  step="1"
                  placeholder="Years"
                  title="Vesting Period (Years)"
                  value={config.income_profile.vesting_years ?? 4}
                  onChange={(e) => updateNestedConfig('income_profile', { vesting_years: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-500 block mb-1">Annual Equity Refresher ($)</label>
            <input
              type="number"
              step="1000"
              value={config.income_profile.annual_equity_grant ?? 0}
              onChange={(e) => updateNestedConfig('income_profile', { annual_equity_grant: parseInt(e.target.value) })}
              className="w-full text-sm border border-slate-200 rounded p-1.5"
            />
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-500 block mb-1">Monthly Rental Income ($)</label>
            <input
              type="number"
              step="100"
              placeholder="Net Cash Flow"
              value={config.income_profile.monthly_rental_income ?? 0}
              onChange={(e) => updateNestedConfig('income_profile', { monthly_rental_income: parseInt(e.target.value) })}
              className="w-full text-sm border border-slate-200 rounded p-1.5"
            />
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Partner Income</h4>
              <input
                type="checkbox"
                checked={config.income_profile.use_partner_income || false}
                onChange={(e) => updateNestedConfig('income_profile', { use_partner_income: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </div>

            {config.income_profile.use_partner_income && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <div className="mb-3">
                  <label className="text-xs text-slate-500 block mb-1">Gross Annual Salary ($)</label>
                  <input
                    type="number"
                    step="1000"
                    value={config.income_profile.partner_gross_annual_salary || 0}
                    onChange={(e) => updateNestedConfig('income_profile', { partner_gross_annual_salary: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm border border-slate-200 rounded p-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Start Year</label>
                    <input
                      type="number"
                      min={2024}
                      max={2060}
                      step={1}
                      value={config.income_profile.partner_employment_start_year || new Date().getFullYear()}
                      onChange={(e) => updateNestedConfig('income_profile', { partner_employment_start_year: parseInt(e.target.value) })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Retirement Year</label>
                    <input
                      type="number"
                      min={2024}
                      max={2060}
                      step={1}
                      value={config.income_profile.partner_retirement_year || 2030}
                      onChange={(e) => updateNestedConfig('income_profile', { partner_retirement_year: parseInt(e.target.value) || 2030 })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5"
                    />
                  </div>
                </div>
                <div className="flex items-center mt-2 mb-3">
                  <input
                    type="checkbox"
                    id="partner_health"
                    checked={config.income_profile.partner_has_health_insurance || false}
                    onChange={(e) => updateNestedConfig('income_profile', { partner_has_health_insurance: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="partner_health" className="text-xs text-slate-700 font-medium ml-2">Supplies Health Ins.</label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Market & Lifestyle Section */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
            Market & Lifestyle Assumptions
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Market Return (%)</label>
              <input
                type="number"
                step="0.1"
                value={config.market_assumptions.market_return_rate}
                onChange={(e) => updateNestedConfig('market_assumptions', { market_return_rate: parseFloat(e.target.value) })}
                className="w-full text-sm border border-slate-200 rounded p-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Volatility Drag (%)</label>
              <input
                type="number"
                step="0.1"
                value={config.market_assumptions.volatility_drag}
                onChange={(e) => updateNestedConfig('market_assumptions', { volatility_drag: parseFloat(e.target.value) })}
                className="w-full text-sm border border-slate-200 rounded p-1.5"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <label className="text-slate-700 font-medium">Monthly Spend</label>
              <span className="font-mono font-bold text-slate-900">${config.spending.monthly_lifestyle.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={5000}
              max={35000}
              step={500}
              value={config.spending.monthly_lifestyle}
              onChange={(e) => updateNestedConfig('spending', { monthly_lifestyle: parseInt(e.target.value) })}
              className="w-full accent-rose-500 mb-2 cursor-pointer"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={config.spending.monthly_lifestyle}
                onChange={(e) => updateNestedConfig('spending', { monthly_lifestyle: parseInt(e.target.value) })}
                className="w-full text-sm border border-slate-200 rounded p-1.5"
              />
            </div>
          </div>

          <div className="mb-4 pt-4 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Monthly Mortgage Payment ($)</label>
            <input
              type="number"
              value={config.spending.mortgage_payment}
              onChange={(e) => updateNestedConfig('spending', { mortgage_payment: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border border-slate-200 rounded p-1.5"
            />
            <div className="text-[10px] text-slate-400 mt-1">
              Note: Automatically ends in June 2051.
            </div>
          </div>

          <div className="mb-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 mb-2">Empty Nest Phase</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Start Year</label>
                <input
                  type="number"
                  min={2024}
                  max={2060}
                  step={1}
                  value={config.spending.empty_nest_year || 2038}
                  onChange={(e) => updateNestedConfig('spending', { empty_nest_year: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Monthly Spend ($)</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.spending.empty_nest_monthly_spend || 0}
                  onChange={(e) => updateNestedConfig('spending', { empty_nest_monthly_spend: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded p-1.5"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <label className="text-slate-700">Inflation</label>
              <span className="font-mono font-bold text-slate-900">{config.market_assumptions.inflation_rate}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={config.market_assumptions.inflation_rate}
              onChange={(e) => updateNestedConfig('market_assumptions', { inflation_rate: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        {/* Divestment Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 mb-4">Divestment Strategy</h3>

          <div className="flex gap-2 mb-4">
            {['none', 'progressive', 'immediate'].map((type) => (
              <button
                key={type}
                onClick={() => updateNestedConfig('divestment_strategy', { type: type as any })}
                className={`flex-1 py-2 text-xs font-medium rounded-md border ${config.divestment_strategy.type === type
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {config.divestment_strategy.type === 'progressive' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Start: {config.divestment_strategy.start_year}</span>
                <span>End: {config.divestment_strategy.end_year}</span>
              </div>
              <input
                type="range"
                min={2024}
                max={2040}
                value={config.divestment_strategy.start_year}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val < config.divestment_strategy.end_year) {
                    updateNestedConfig('divestment_strategy', { start_year: val });
                  }
                }}
                className="mb-2"
              />
              <input
                type="range"
                min={2024}
                max={2045}
                value={config.divestment_strategy.end_year}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val > config.divestment_strategy.start_year) {
                    updateNestedConfig('divestment_strategy', { end_year: val });
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Tax Profiling Section */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 mb-4">Tax Profiling</h3>

          <div className="mb-4">
            <label className="text-xs font-medium text-slate-700 block mb-1">Filing Status</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-md py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              value={config.tax_assumptions?.filing_status ?? 'single'}
              onChange={e => updateNestedConfig('tax_assumptions', { filing_status: e.target.value as any })}
            >
              <option value="single">Single</option>
              <option value="married_joint">Married Filing Jointly</option>
              <option value="married_separate">Married Filing Separately</option>
              <option value="head_household">Head of Household</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-slate-700 block mb-1">State of Residence</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-md py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              value={config.tax_assumptions?.state_of_residence ?? 'CA'}
              onChange={e => updateNestedConfig('tax_assumptions', { state_of_residence: e.target.value as any })}
            >
              <option value="CA">California</option>
              <option value="WA">Washington</option>
              <option value="TX">Texas</option>
              <option value="NY">New York</option>
              <option value="NONE">No State Tax</option>
            </select>
          </div>
        </div>

        {/* Life Events Section */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 mb-4">Life Events</h3>

          <div className="space-y-3 mb-4">
            {config.life_events?.map((event, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{event.name}</div>
                  <div className="text-xs text-slate-500">{event.year} • ${event.cost.toLocaleString()}</div>
                </div>
                <button
                  onClick={() => {
                    const newEvents = [...(config.life_events || [])];
                    newEvents.splice(index, 1);
                    updateNestedConfig('life_events', newEvents as any);
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <h4 className="text-xs font-medium text-slate-700 mb-2">Add New Event</h4>
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                placeholder="Event Name"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-md py-1.5 px-3"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Year"
                  value={newEvent.year}
                  onChange={(e) => setNewEvent({ ...newEvent, year: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded-md py-1.5 px-3"
                />
                <input
                  type="number"
                  placeholder="Cost"
                  value={newEvent.cost}
                  onChange={(e) => setNewEvent({ ...newEvent, cost: parseInt(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded-md py-1.5 px-3"
                />
              </div>
              <button
                className="w-full bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 text-xs font-medium py-2 rounded-md transition-colors mt-1"
                onClick={() => {
                  if (newEvent.name && newEvent.year && newEvent.cost) {
                    // Fix: Create fresh array copy
                    const currentEvents = config.life_events ? [...config.life_events] : [];
                    updateNestedConfig('life_events', [...currentEvents, newEvent] as any);
                    setNewEvent({ name: '', year: 2030, cost: 50000 });
                  }
                }}
              >
                + Add Event
              </button>
            </div>
          </div>

        </div>

        {/* Other Investments Section */}
        <div className="mb-20 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
            Portfolio Holdings
          </h3>

          <div className="space-y-3 mb-4">
            {snapshot.other_investments?.map((inv, idx) => (
              <InvestmentListItem
                key={inv.id || idx}
                inv={inv}
                onRemove={() => {
                  const newInv = [...(snapshot.other_investments || [])];
                  newInv.splice(idx, 1);
                  updateNestedSnapshot('other_investments', newInv as any);
                }}
                onUpdate={(updated) => {
                  const newInv = [...(snapshot.other_investments || [])];
                  newInv[idx] = updated;
                  updateNestedSnapshot('other_investments', newInv as any);
                }}
              />
            ))}
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <h4 className="text-xs font-medium text-slate-700 mb-2">Add Holding</h4>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                placeholder="Ticker"
                value={newInv.symbol}
                onChange={(e) => setNewInv({ ...newInv, symbol: e.target.value.toUpperCase() })}
                className="col-span-1 text-sm border p-1 rounded uppercase"
              />
              <input
                type="number"
                placeholder="Shares"
                value={newInv.shares}
                onChange={(e) => setNewInv({ ...newInv, shares: e.target.value })}
                className="col-span-1 text-sm border p-1 rounded"
              />
              <input
                type="number"
                placeholder="Ret %"
                title="Expected Annual Return %"
                value={(newInv as any).returnRate || ''}
                onChange={(e) => setNewInv({ ...newInv, returnRate: e.target.value } as any)}
                className="col-span-1 text-sm border p-1 rounded"
              />
            </div>
            <button
              onClick={() => {
                const sh = parseFloat(newInv.shares);
                if (newInv.symbol && sh) {
                  const investment = {
                    id: Date.now().toString(),
                    name: newInv.symbol,
                    symbol: newInv.symbol,
                    shares: sh,
                    cost_basis: 0,
                    current_price: 0, // In a real app we'd fetch this or ask for it
                    expected_return: (newInv as any).returnRate ? parseFloat((newInv as any).returnRate) : undefined
                  };
                  // Fix: Create a fresh array copy to avoid mutation issues
                  const currentInvestments = snapshot.other_investments ? [...snapshot.other_investments] : [];
                  updateNestedSnapshot('other_investments', [...currentInvestments, investment] as any);
                  setNewInv({ symbol: '', shares: '', returnRate: '' } as any);
                }
              }}
              className="w-full bg-amber-100 text-amber-800 text-xs font-bold py-2 rounded hover:bg-amber-200 transition-colors"
            >
              + Add Investment
            </button>
          </div>
        </div>

        {/* Education Assets (529) */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
            Education Assets (529)
          </h3>

          <div className="space-y-3 mb-4">
            {(snapshot.education_assets?.accounts || []).map((acc, index) => (
              <div key={acc.id || index} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100 group">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={acc.name}
                    onChange={(e) => {
                      const newAccounts = [...(snapshot.education_assets.accounts || [])];
                      newAccounts[index] = { ...acc, name: e.target.value };
                      updateNestedSnapshot('education_assets', { accounts: newAccounts });
                    }}
                    className="text-sm font-medium bg-transparent border-b border-transparent focus:border-indigo-300 outline-none w-full"
                    placeholder="Account Name"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      value={acc.balance}
                      onChange={(e) => {
                        const newAccounts = [...(snapshot.education_assets.accounts || [])];
                        newAccounts[index] = { ...acc, balance: parseFloat(e.target.value) };
                        updateNestedSnapshot('education_assets', { accounts: newAccounts });
                      }}
                      className="text-sm font-mono bg-transparent border-b border-transparent focus:border-indigo-300 outline-none w-full text-right"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newAccounts = (snapshot.education_assets.accounts || []).filter((_, i) => i !== index);
                    updateNestedSnapshot('education_assets', { accounts: newAccounts });
                  }}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const newAccounts = [...(snapshot.education_assets.accounts || []), { id: crypto.randomUUID(), name: 'New 529 Account', balance: 0 }];
              updateNestedSnapshot('education_assets', { accounts: newAccounts });
            }}
            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 border-dashed transition-colors"
          >
            <PlusCircle size={14} />
            Add 529 Account
          </button>
        </div>


      </div>

    </aside >
  );
};

const InvestmentListItem = ({ inv, onRemove, onUpdate }: { inv: any, onRemove: () => void, onUpdate: (updated: any) => void }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedSymbol, setEditedSymbol] = React.useState(inv.symbol);
  const [editedShares, setEditedShares] = React.useState(inv.shares);
  const [editedReturnRate, setEditedReturnRate] = React.useState(inv.expected_return ?? '');

  React.useEffect(() => {
    if (!isEditing) {
      setEditedSymbol(inv.symbol);
      setEditedShares(inv.shares);
      setEditedReturnRate(inv.expected_return ?? '');
    }
  }, [inv, isEditing]);

  const handleSave = () => {
    onUpdate({
      ...inv,
      symbol: editedSymbol,
      shares: parseFloat(editedShares),
      expected_return: editedReturnRate !== '' ? parseFloat(editedReturnRate) : undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSymbol(inv.symbol);
    setEditedShares(inv.shares);
    setEditedReturnRate(inv.expected_return ?? '');
    setIsEditing(false);
  };

  return (
    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex justify-between items-center group">
      {isEditing ? (
        <div className="flex flex-col gap-2 w-full">
          <input
            type="text"
            value={editedSymbol}
            onChange={(e) => setEditedSymbol(e.target.value.toUpperCase())}
            className="w-full text-sm border p-1 rounded uppercase"
            placeholder="Ticker"
          />
          <input
            type="number"
            value={editedShares}
            onChange={(e) => setEditedShares(e.target.value)}
            className="w-full text-sm border p-1 rounded"
            placeholder="Shares"
          />
          <input
            type="number"
            value={editedReturnRate}
            onChange={(e) => setEditedReturnRate(e.target.value)}
            className="w-full text-sm border p-1 rounded"
            placeholder="Return %"
            title="Expected Annual Return %"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-amber-200 text-amber-800 text-xs font-bold py-1.5 rounded hover:bg-amber-300 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs font-medium py-1.5 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="font-bold text-slate-800 text-sm">{inv.symbol}</div>
            <div className="text-xs text-slate-500">{inv.shares} shares</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono font-semibold text-slate-700">
              ${(inv.shares * (inv.current_price || 0)).toLocaleString()}
              {inv.expected_return !== undefined && (
                <span className="ml-2 text-xs text-slate-500">({inv.expected_return}%)</span>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Edit
              </button>
              <button
                onClick={onRemove}
                className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
