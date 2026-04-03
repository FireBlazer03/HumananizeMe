'use client';

import { DetectionReport as DetectionReportType } from '@/types';

interface DetectionReportProps {
  report: DetectionReportType | null;
}

function getScoreInfo(score: number): { label: string; color: string; textColor: string; bgColor: string } {
  if (score >= 80) return { label: 'Almost certainly AI', color: '#e24b4a', textColor: 'text-red-700', bgColor: 'bg-red-500' };
  if (score >= 60) return { label: 'Likely AI-generated', color: '#ef9f27', textColor: 'text-orange-700', bgColor: 'bg-orange-500' };
  if (score >= 40) return { label: 'Possibly AI-assisted', color: '#efc027', textColor: 'text-yellow-700', bgColor: 'bg-yellow-500' };
  if (score >= 20) return { label: 'Mostly human', color: '#97c459', textColor: 'text-lime-700', bgColor: 'bg-lime-500' };
  return { label: 'Looks human', color: '#639922', textColor: 'text-green-700', bgColor: 'bg-green-500' };
}

function ScoreMeter({ score }: { score: number }) {
  const info = getScoreInfo(score);

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
            stroke={info.color}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${info.textColor}`}>{score}</span>
        </div>
      </div>
      <div className={`text-xs font-semibold ${info.textColor}`}>{info.label}</div>
      <div className="mt-1 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${info.bgColor} transition-all duration-500`} style={{ width: `${score}%` }} />
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

function SignalBar({ name, score, maxScore, detail }: { name: string; score: number; maxScore: number; detail: string }) {
  const pct = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
  const barColor = score <= 0 ? 'bg-green-400' : score < maxScore * 0.5 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{name}</span>
        <span className="text-gray-500">+{Math.max(0, score)}/{maxScore}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-gray-400">{detail}</div>
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
      </div>

      {/* Signal Breakdown */}
      {report.signals && report.signals.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">Signal Breakdown</h4>
          <div className="space-y-2.5">
            {report.signals.map((signal, i) => (
              <SignalBar
                key={i}
                name={signal.name}
                score={signal.score}
                maxScore={signal.maxScore}
                detail={signal.detail}
              />
            ))}
          </div>
        </div>
      )}

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
