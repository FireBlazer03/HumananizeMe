'use client';

import { useRef, useEffect, useState } from 'react';
import { HumanizerSettings, ImperfectionLevel, BurstinessMode, SpacingIntensity } from '@/types';

interface SettingsBarProps {
  settings: HumanizerSettings;
  onSettingsChange: (settings: HumanizerSettings) => void;
  onHumanize: () => void;
  onClear: () => void;
  isProcessing: boolean;
  hasInput: boolean;
}

const IMPERFECTION_LEVELS: ImperfectionLevel[] = ['subtle', 'moderate', 'realistic'];
const BURSTINESS_MODES: BurstinessMode[] = ['mild', 'strong', 'aggressive'];
const SPACING_STOPS: { label: string; value: SpacingIntensity }[] = [
  { label: 'LO', value: 'low' },
  { label: 'MD', value: 'medium' },
  { label: 'HI', value: 'high' },
];

export default function SettingsBar({
  settings,
  onSettingsChange,
  onHumanize,
  onClear,
  isProcessing,
  hasInput,
}: SettingsBarProps) {
  const impBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pinLeft, setPinLeft] = useState<string>('50%');

  useEffect(() => {
    const idx = IMPERFECTION_LEVELS.indexOf(settings.imperfectionLevel);
    const btn = impBtnRefs.current[idx];
    if (!btn) return;
    const scale = btn.closest('.ctl-scale') as HTMLElement | null;
    if (!scale) return;
    const scaleRect = scale.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPinLeft(`${btnRect.left - scaleRect.left + btnRect.width / 2}px`);
  }, [settings.imperfectionLevel]);

  return (
    <div className="space-y-5">
      {/* Row 1: Mode + Actions */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode — dark graphite rail */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Mode</span>
          <div className="ctl-rail">
            <div
              className="puck"
              style={{ left: settings.professionalMode ? 'calc(50% + 1px)' : '3px' }}
            />
            <button
              className={!settings.professionalMode ? 'on' : ''}
              onClick={() => onSettingsChange({ ...settings, professionalMode: false })}
              disabled={isProcessing}
            >Natural</button>
            <button
              className={settings.professionalMode ? 'on' : ''}
              onClick={() => onSettingsChange({ ...settings, professionalMode: true })}
              disabled={isProcessing}
            >Professional</button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-gray-600 bg-transparent border border-gray-200 rounded-full hover:border-gray-300 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >Clear</button>
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

      <div className="h-px bg-gray-100" />

      {/* Row 2: Fine-tuning controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Imperfections — tick scale */}
        <div className="flex items-center gap-2.5">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Imperfections</label>
          <div className="ctl-scale">
            <div className="rule" />
            <div className="pin" style={{ left: pinLeft }} />
            <div className="ticks">
              {IMPERFECTION_LEVELS.map((level, i) => (
                <button
                  key={level}
                  ref={el => { impBtnRefs.current[i] = el; }}
                  className={settings.imperfectionLevel === level ? 'on' : ''}
                  onClick={() => onSettingsChange({ ...settings, imperfectionLevel: level })}
                  disabled={isProcessing}
                >{level}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-100" />

        {/* Burstiness — pearl pills */}
        <div className="flex items-center gap-2.5">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Burstiness</label>
          <div className="ctl-pills">
            {BURSTINESS_MODES.map((mode) => (
              <button
                key={mode}
                className={settings.burstinessMode === mode ? 'on' : ''}
                onClick={() => onSettingsChange({ ...settings, burstinessMode: mode })}
                disabled={isProcessing}
              >{mode}</button>
            ))}
          </div>
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-100" />

        {/* Spacing — dark toggle + LO/MD/HI stops */}
        <div className="flex items-center gap-2.5">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Spacing</label>
          <button
            type="button"
            role="switch"
            aria-checked={settings.randomSpacingEnabled}
            onClick={() => onSettingsChange({ ...settings, randomSpacingEnabled: !settings.randomSpacingEnabled })}
            disabled={isProcessing}
            className={`ctl-switch${settings.randomSpacingEnabled ? ' on' : ''}`}
          >
            <span className="thumb" />
          </button>
          {settings.randomSpacingEnabled && (
            <div className="ctl-stops">
              {SPACING_STOPS.map(({ label, value }) => (
                <button
                  key={value}
                  className={settings.randomSpacingIntensity === value ? 'on' : ''}
                  onClick={() => onSettingsChange({ ...settings, randomSpacingIntensity: value })}
                  disabled={isProcessing || settings.professionalMode}
                >{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
