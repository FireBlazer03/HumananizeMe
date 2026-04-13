'use client';

import { useState } from 'react';
import { DetectionReport as DetectionReportType } from '@/types';

interface DetectionReportProps {
  report: DetectionReportType | null;
}

function getScoreInfo(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Almost certainly AI', color: '#e24b4a' };
  if (score >= 45) return { label: 'Likely AI-assisted', color: '#ef9f27' };
  if (score >= 25) return { label: 'Mostly human', color: '#97c459' };
  return { label: 'Looks human', color: '#22c55e' };
}

function ScoreMeter({ score }: { score: number }) {
  const info = getScoreInfo(score);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={info.color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          className="transition-all duration-500"
        />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central"
              fontSize="18" fontWeight="600" fill={info.color}>
          {score}
        </text>
      </svg>
      <div>
        <div style={{ color: info.color }} className="text-sm font-semibold">{info.label}</div>
        <div className="text-xs text-gray-400 mt-0.5">AI Detection Score</div>
      </div>
    </div>
  );
}

function SignalBar({ name, score, maxScore, detail }: { name: string; score: number; maxScore: number; detail: string }) {
  const pct = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
  const barColor = score <= 0 ? 'bg-green-400' : score < maxScore * 0.5 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{name}</span>
        <span className="text-gray-400 font-mono">+{Math.max(0, score)}/{maxScore}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-gray-400">{detail}</div>
    </div>
  );
}

export default function DetectionReport({ report }: DetectionReportProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!report) return null;

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white/60 overflow-hidden animate-fade-in">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Detection Report</h3>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              color: getScoreInfo(report.estimatedAIScore).color,
              backgroundColor: `${getScoreInfo(report.estimatedAIScore).color}15`,
            }}
          >
            Score: {report.estimatedAIScore}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-100 animate-fade-in">
          <div className="pt-4">
            <ScoreMeter score={report.estimatedAIScore} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'AI Vocab', value: report.aiVocabHits.length },
              { label: 'Artifacts', value: report.chatbotArtifacts.length },
              { label: 'Passive Voice', value: report.passiveVoiceCount },
              { label: 'Burstiness', value: report.burstinessLabel },
            ].map((stat) => (
              <div key={stat.label} className="p-2.5 bg-gray-50/80 rounded-lg text-center">
                <div className="text-base font-bold text-gray-700">{stat.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Signal Breakdown */}
          {report.signals && report.signals.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Signal Breakdown</h4>
              <div className="space-y-3">
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

          {/* Vocab Hits */}
          {report.aiVocabHits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Vocabulary Found</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.aiVocabHits.slice(0, 20).map((hit, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-600 rounded-md border border-red-100"
                  >
                    {hit}
                  </span>
                ))}
                {report.aiVocabHits.length > 20 && (
                  <span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500 rounded-md">
                    +{report.aiVocabHits.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Chatbot Artifacts */}
          {report.chatbotArtifacts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Chatbot Artifacts</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.chatbotArtifacts.map((artifact, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[11px] font-medium bg-orange-50 text-orange-600 rounded-md border border-orange-100"
                  >
                    {artifact}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extra flags */}
          {(report.hasEmojis || report.hasCurlyQuotes) && (
            <div className="flex gap-2">
              {report.hasEmojis && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500 rounded-md">Has Emojis</span>
              )}
              {report.hasCurlyQuotes && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500 rounded-md">Curly Quotes</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
