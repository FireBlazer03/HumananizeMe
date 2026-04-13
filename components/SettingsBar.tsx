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
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
          : 'text-gray-600 hover:bg-gray-100'
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-indigo-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
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
    <div className="space-y-4">
      {/* Row 1: Mode selector + action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <button
          onClick={onClear}
          disabled={isProcessing}
          className="px-5 py-2.5 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          onClick={onHumanize}
          disabled={!hasInput || isProcessing}
          className="px-7 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
            'Humanize'
          )}
        </button>
      </div>

      {/* Row 2: Fine-tuning controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-gray-200/60">
        {/* Imperfections */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Imperfections</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {imperfectionLevels.map((level) => (
              <button
                key={level}
                onClick={() => onSettingsChange({ ...settings, imperfectionLevel: level })}
                disabled={isProcessing}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  settings.imperfectionLevel === level
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Burstiness */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Burstiness</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {burstinessModes.map((mode) => (
              <button
                key={mode}
                onClick={() => onSettingsChange({ ...settings, burstinessMode: mode })}
                disabled={isProcessing}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  settings.burstinessMode === mode
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Random Spacing Toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Spacing</label>
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
              className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-40"
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
