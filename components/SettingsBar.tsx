'use client';

import { HumanizerSettings, ImperfectionLevel, BurstinessMode } from '@/types';

interface SettingsBarProps {
  settings: HumanizerSettings;
  onSettingsChange: (settings: HumanizerSettings) => void;
  onHumanize: () => void;
  onClear: () => void;
  isProcessing: boolean;
  hasInput: boolean;
}

export default function SettingsBar({
  settings,
  onSettingsChange,
  onHumanize,
  onClear,
  isProcessing,
  hasInput,
}: SettingsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
      <button
        onClick={onHumanize}
        disabled={!hasInput || isProcessing}
        className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Humanize'}
      </button>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">Imperfections</label>
        <select
          value={settings.imperfectionLevel}
          onChange={(e) =>
            onSettingsChange({ ...settings, imperfectionLevel: e.target.value as ImperfectionLevel })
          }
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="subtle">Subtle</option>
          <option value="moderate">Moderate</option>
          <option value="realistic">Realistic</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">Burstiness</label>
        <select
          value={settings.burstinessMode}
          onChange={(e) =>
            onSettingsChange({ ...settings, burstinessMode: e.target.value as BurstinessMode })
          }
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="mild">Mild</option>
          <option value="strong">Strong</option>
          <option value="aggressive">Aggressive</option>
        </select>
      </div>

      <button
        onClick={onClear}
        disabled={isProcessing}
        className="ml-auto px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Clear
      </button>
    </div>
  );
}
