'use client';

import { useState, useEffect, useRef } from 'react';
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
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle cx="38" cy="38" r={radius} fill="none" stroke={info.color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 38 38)" className="transition-all duration-700 ease-out" />
        <text x="38" y="38" textAnchor="middle" dominantBaseline="central"
          fontSize="16" fontWeight="600" fill={info.color}>{score}</text>
      </svg>
      <div>
        <div style={{ color: info.color }} className="text-sm font-semibold">{info.label}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">AI Detection Score</div>
      </div>
    </div>
  );
}

function SignalBar({ name, score, maxScore, detail }: { name: string; score: number; maxScore: number; detail: string }) {
  const pct = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
  const barColor = score <= 0 ? 'bg-emerald-400' : score < maxScore * 0.5 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-gray-600">{name}</span>
        <span className="text-gray-300 font-mono tabular-nums">+{Math.max(0, score)}/{maxScore}</span>
      </div>
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-gray-400">{detail}</div>
    </div>
  );
}

export default function DetectionReport({ report }: DetectionReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const prevReport = useRef<DetectionReportType | null>(null);

  useEffect(() => {
    if (report && report !== prevReport.current) {
      setIsOpen(true);
      prevReport.current = report;
    }
  }, [report]);

  if (!report) return null;

  return (
    <div className="rounded-2xl inner-card overflow-hidden animate-fade-in">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/40 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Detection Report</h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: getScoreInfo(report.estimatedAIScore).color, backgroundColor: `${getScoreInfo(report.estimatedAIScore).color}10` }}>
            {report.estimatedAIScore}
          </span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-100/60 animate-fade-in">
          <div className="pt-4"><ScoreMeter score={report.estimatedAIScore} /></div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'AI Vocab', value: report.aiVocabHits.length },
              { label: 'Artifacts', value: report.chatbotArtifacts.length },
              { label: 'Passive Voice', value: report.passiveVoiceCount },
              { label: 'Burstiness', value: report.burstinessLabel },
            ].map((stat) => (
              <div key={stat.label} className="p-2.5 bg-gray-50/50 rounded-xl text-center">
                <div className="text-sm font-bold text-gray-700">{stat.value}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {report.signals && report.signals.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-2.5">Signals</h4>
              <div className="space-y-3">
                {report.signals.map((signal, i) => (
                  <SignalBar key={i} name={signal.name} score={signal.score} maxScore={signal.maxScore} detail={signal.detail} />
                ))}
              </div>
            </div>
          )}

          {report.aiVocabHits.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-2">AI Vocabulary</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.aiVocabHits.slice(0, 20).map((hit, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-red-50/70 text-red-500 rounded-md border border-red-100">{hit}</span>
                ))}
                {report.aiVocabHits.length > 20 && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 rounded-md">+{report.aiVocabHits.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {report.chatbotArtifacts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-2">Artifacts</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.chatbotArtifacts.map((a, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-amber-50/70 text-amber-600 rounded-md border border-amber-100">{a}</span>
                ))}
              </div>
            </div>
          )}

          {(report.hasEmojis || report.hasCurlyQuotes) && (
            <div className="flex gap-1.5">
              {report.hasEmojis && <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 rounded-md">Emojis</span>}
              {report.hasCurlyQuotes && <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 rounded-md">Curly Quotes</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
