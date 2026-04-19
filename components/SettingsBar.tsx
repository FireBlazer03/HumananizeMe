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

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex">
      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-[9px] font-bold cursor-default select-none hover:bg-gray-300 transition-colors">?</span>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-gray-800 text-white text-[10px] leading-relaxed rounded-lg px-3 py-2 whitespace-nowrap shadow-lg max-w-[220px] whitespace-normal text-center">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      </div>
    </div>
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
    <div className="flex bg-gray-100/70 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-md capitalize transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            value === opt
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
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
        {/* Mode */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Mode</span>
          <div className="flex bg-gray-100/70 rounded-lg p-0.5">
            <button
              onClick={() => onSettingsChange({ ...settings, professionalMode: false })}
              disabled={isProcessing}
              title="Casual, conversational tone with natural quirks"
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                !settings.professionalMode
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Natural
            </button>
            <button
              onClick={() => onSettingsChange({ ...settings, professionalMode: true })}
              disabled={isProcessing}
              title="Formal, polished tone suitable for work documents"
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.professionalMode
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Professional
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-gray-600 bg-transparent border border-gray-200 rounded-full hover:border-gray-300 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <button
            onClick={onHumanize}
            disabled={!hasInput || isProcessing}
            className="btn-primary px-7 py-2.5 text-xs font-semibold text-white rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Humanize
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-gray-100" />

      {/* Row 2: Fine-tuning */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Imperfections</label>
          <Tooltip text="How many natural human quirks to inject — typos, contractions, filler words. Higher = more human, less polished." />
          <SegmentGroup
            options={imperfectionLevels}
            value={settings.imperfectionLevel}
            onChange={(v) => onSettingsChange({ ...settings, imperfectionLevel: v })}
            disabled={isProcessing}
          />
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-150" />

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Burstiness</label>
          <Tooltip text="Controls sentence-length variation. Humans mix long and short sentences. Higher = more varied rhythm." />
          <SegmentGroup
            options={burstinessModes}
            value={settings.burstinessMode}
            onChange={(v) => onSettingsChange({ ...settings, burstinessMode: v })}
            disabled={isProcessing}
          />
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-150" />

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Spacing</label>
          <Tooltip text="Adds subtle random whitespace variations that mimic human typing patterns." />
          <button
            type="button"
            role="switch"
            aria-checked={settings.randomSpacingEnabled}
            onClick={() => onSettingsChange({ ...settings, randomSpacingEnabled: !settings.randomSpacingEnabled })}
            disabled={isProcessing}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
              settings.randomSpacingEnabled ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${
              settings.randomSpacingEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`} />
          </button>
          {settings.randomSpacingEnabled && (
            <select
              value={settings.randomSpacingIntensity}
              onChange={(e) => onSettingsChange({ ...settings, randomSpacingIntensity: e.target.value as SpacingIntensity })}
              disabled={isProcessing || settings.professionalMode}
              className="px-2.5 py-1 text-[11px] font-medium border border-gray-200 rounded-lg bg-white text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 disabled:opacity-40"
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
