'use client';

import { DetectionReport as DetectionReportType } from '@/types';

interface DetectionReportProps {
  report: DetectionReportType | null;
}

function ScoreMeter({ score }: { score: number }) {
  const getColor = () => {
    if (score <= 30) return 'bg-green-500';
    if (score <= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLabel = () => {
    if (score <= 20) return 'Very Human';
    if (score <= 40) return 'Mostly Human';
    if (score <= 60) return 'Mixed';
    if (score <= 80) return 'Likely AI';
    return 'Very AI-like';
  };

  const getTextColor = () => {
    if (score <= 30) return 'text-green-700';
    if (score <= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-2">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={score <= 30 ? '#22c55e' : score <= 60 ? '#eab308' : '#ef4444'}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${getTextColor()}`}>{score}</span>
        </div>
      </div>
      <div className={`text-xs font-semibold ${getTextColor()}`}>{getLabel()}</div>
      <div className="mt-1 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${getColor()} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-lg font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default function DetectionReport({ report }: DetectionReportProps) {
  if (!report) return null;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">AI Detection</h3>

      <ScoreMeter score={report.estimatedAIScore} />

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="AI Vocab Hits" value={report.aiVocabHits.length} />
        <StatCard label="Chatbot Artifacts" value={report.chatbotArtifacts.length} />
        <StatCard label="Passive Voice" value={report.passiveVoiceCount} />
        <StatCard label="Burstiness" value={report.burstinessLabel} />
        <StatCard label="Em Dashes" value={report.emDashCount} />
        <StatCard label="Inflation Phrases" value={report.significanceInflation} />
      </div>

      {report.aiVocabHits.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">AI Vocabulary Found</h4>
          <div className="flex flex-wrap gap-1">
            {report.aiVocabHits.slice(0, 20).map((hit, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded-full border border-red-200"
              >
                {hit}
              </span>
            ))}
            {report.aiVocabHits.length > 20 && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                +{report.aiVocabHits.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}

      {report.chatbotArtifacts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">Chatbot Artifacts</h4>
          <div className="flex flex-wrap gap-1">
            {report.chatbotArtifacts.map((artifact, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 rounded-full border border-orange-200"
              >
                {artifact}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-xs text-gray-400">
        {report.hasEmojis && <span className="px-2 py-0.5 bg-gray-100 rounded-full">Has Emojis</span>}
        {report.hasCurlyQuotes && <span className="px-2 py-0.5 bg-gray-100 rounded-full">Curly Quotes</span>}
      </div>
    </div>
  );
}
