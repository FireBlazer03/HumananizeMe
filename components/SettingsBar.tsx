'use client';

import { HumanizerSettings, ImperfectionLevel, BurstinessMode, SpacingIntensity } from '@/types';

interface SettingsBarProps {
  settings: HumanizerSettings;
  onSettingsChange: (settings: HumanizerSettings) => void;
  onHumanize: () => void;
  onClear: () => void;
  isProcessing: boolean;
  hasInput: boolean;
}

function ModeButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
          : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
      }`}
    >
      {label}
    </button>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-indigo-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
          enabled ? 'translate-x-6 shadow-md' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SegmentGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex bg-gray-100/80 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            value === opt
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function SettingsBar({
  settings,
  onSettingsChange,
  onHumanize,
  onClear,
  isProcessing,
  hasInput,
}: SettingsBarProps) {
  const imperfectionLevels: ImperfectionLevel[] = ['subtle', 'moderate', 'realistic'];
  const burstinessModes: BurstinessMode[] = ['mild', 'strong', 'aggressive'];

  return (
    <div className="space-y-5">
      {/* Row 1: Mode + Actions */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Mode</span>
          <div className="flex bg-gray-100/80 rounded-xl p-1">
            <ModeButton
              label="Natural"
              active={!settings.professionalMode}
              onClick={() => onSettingsChange({ ...settings, professionalMode: false })}
              disabled={isProcessing}
            />
            <ModeButton
              label="Professional"
              active={settings.professionalMode}
              onClick={() => onSettingsChange({ ...settings, professionalMode: true })}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="px-5 py-2.5 text-sm font-medium text-gray-500 bg-white/80 border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <button
            onClick={onHumanize}
            disabled={!hasInput || isProcessing}
            className="btn-primary-glow px-8 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Humanize
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Gradient separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200/80 to-transparent" />

      {/* Row 2: Fine-tuning controls */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {/* Imperfections */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Imperfections</label>
          <SegmentGroup
            options={imperfectionLevels}
            value={settings.imperfectionLevel}
            onChange={(v) => onSettingsChange({ ...settings, imperfectionLevel: v })}
            disabled={isProcessing}
          />
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-200/70" />

        {/* Burstiness */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Burstiness</label>
          <SegmentGroup
            options={burstinessModes}
            value={settings.burstinessMode}
            onChange={(v) => onSettingsChange({ ...settings, burstinessMode: v })}
            disabled={isProcessing}
          />
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-200/70" />

        {/* Random Spacing Toggle */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Spacing</label>
          <ToggleSwitch
            enabled={settings.randomSpacingEnabled}
            onChange={(val) => onSettingsChange({ ...settings, randomSpacingEnabled: val })}
            disabled={isProcessing}
          />
          {settings.randomSpacingEnabled && (
            <select
              value={settings.randomSpacingIntensity}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  randomSpacingIntensity: e.target.value as SpacingIntensity,
                })
              }
              disabled={isProcessing || settings.professionalMode}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-40"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
