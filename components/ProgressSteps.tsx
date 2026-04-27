'use client';

import { useState } from 'react';
import { PipelineStep } from '@/types';

interface ProgressStepsProps {
  steps: PipelineStep[];
  visible: boolean;
}

const STAGES = [
  { num: '01', name: 'Cleanup',  range: [0, 4]  },
  { num: '02', name: 'Rewrite',  range: [5, 9]  },
  { num: '03', name: 'Shape',    range: [10, 14] },
  { num: '04', name: 'Polish',   range: [15, 19] },
];

export default function ProgressSteps({ steps, visible }: ProgressStepsProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!visible) return null;

  const completedCount = steps.filter(s => s.status === 'complete').length;
  const activeStep = steps.find(s => s.status === 'active');
  const progress = (completedCount / steps.length) * 100;
  const isComplete = completedCount === steps.length;

  return (
    <div
      className="rounded-[18px] overflow-hidden animate-fade-in"
      style={{
        background: 'radial-gradient(120% 80% at 50% 0%, rgba(196,181,253,0.12), transparent 60%), linear-gradient(180deg, #ffffff 0%, #f7f8fc 100%)',
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03), 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 text-left hover:bg-gray-50/40 transition-colors duration-200"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Processing</h3>
            {activeStep && !isComplete && (
              <span className="flex items-center gap-[7px] text-[11px] font-medium text-indigo-600">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  style={{ boxShadow: '0 0 0 4px rgba(99,102,241,0.18)', animation: 'reactor-pulse 1.4s ease-in-out infinite' }}
                />
                {activeStep.label}
              </span>
            )}
            {isComplete && (
              <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Done
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] text-gray-300 tabular-nums">
              <strong className="text-gray-700 font-bold">{completedCount}</strong>/{steps.length} steps
            </span>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* 4-stage reactor grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {STAGES.map((stage) => {
            const stageSteps = steps.slice(stage.range[0], stage.range[1] + 1);
            const stageDone = stageSteps.filter(s => s.status === 'complete').length;
            const stageActive = stageSteps.find(s => s.status === 'active');
            const isStageComplete = stageDone === stageSteps.length;
            const isStageActive = !!stageActive && !isStageComplete;
            const stageState = isStageComplete ? 'done' : isStageActive ? 'active' : 'pending';

            return (
              <div
                key={stage.num}
                className="relative rounded-[14px] transition-all duration-300"
                style={{
                  background: stageState === 'done'
                    ? 'linear-gradient(180deg,#f0fdf4,#ffffff)'
                    : stageState === 'active'
                    ? 'linear-gradient(180deg,#eef2ff,#ffffff 80%)'
                    : '#ffffff',
                  border: stageState === 'done'
                    ? '1px solid #bbf7d0'
                    : stageState === 'active'
                    ? '1px solid #818cf8'
                    : '1px solid #eef0f4',
                  boxShadow: stageState === 'active'
                    ? '0 0 0 4px rgba(99,102,241,0.10), 0 8px 24px -8px rgba(99,102,241,0.30)'
                    : 'none',
                  transform: stageState === 'active' ? 'translateY(-2px)' : 'none',
                }}
              >
                {isStageActive && <div className="stage-gloss" />}
                {/* Stage number (Instrument Serif italic) */}
                <span
                  className="absolute -top-[9px] left-3 font-display italic text-lg leading-none px-1.5"
                  style={{
                    color: stageState === 'done' ? '#10b981' : stageState === 'active' ? '#4338ca' : '#c4b5fd',
                    background: '#f8f9fc',
                  }}
                >
                  {stage.num}
                </span>

                {/* Inner content raised above gloss */}
                <div className="relative pt-4 pb-3.5 px-3 flex flex-col gap-2.5" style={{ zIndex: 1 }}>
                {/* Stage title + count */}
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-[11px] font-bold tracking-[-0.01em]"
                    style={{ color: stageState === 'done' ? '#059669' : stageState === 'active' ? '#4338ca' : '#4b5563' }}
                  >
                    {stage.name}
                  </span>
                  <span
                    className="font-mono text-[9px] tabular-nums"
                    style={{ color: stageState === 'done' ? '#10b981' : stageState === 'active' ? '#6366f1' : '#c4b5fd' }}
                  >
                    {stageDone}/{stageSteps.length}
                  </span>
                </div>

                {/* Bead row */}
                <div className="flex gap-1 items-center">
                  {stageSteps.map((step, i) => {
                    const isBeadActive = step.status === 'active';
                    const isBeadDone = step.status === 'complete';
                    return (
                      <div
                        key={i}
                        className="relative flex-1 h-[18px] rounded-[5px] overflow-hidden transition-all duration-300"
                        style={{
                          background: isBeadDone
                            ? 'linear-gradient(180deg,#34d399,#10b981)'
                            : isBeadActive
                            ? 'linear-gradient(180deg,#a5b4fc,#6366f1)'
                            : '#f1f3f8',
                          boxShadow: isBeadActive ? '0 0 12px rgba(99,102,241,0.55)' : 'none',
                        }}
                      >
                        {isBeadActive && (
                          <span
                            className="absolute inset-0"
                            style={{
                              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                              backgroundSize: '60% 100%',
                              backgroundRepeat: 'no-repeat',
                              animation: 'reactor-scan 1.2s linear infinite',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Current step label */}
                <div
                  className="font-mono text-[10px] flex items-center gap-1.5"
                  style={{ color: stageState === 'done' ? '#10b981' : stageState === 'active' ? '#6366f1' : '#d1d5db' }}
                >
                  {stageState === 'done' ? (
                    <span>✓ {stageSteps[stageSteps.length - 1].label}</span>
                  ) : stageState === 'active' && stageActive ? (
                    <><span className="text-[#c4b5fd]">▸</span>{stageActive.label}</>
                  ) : (
                    <span>Awaiting {STAGES[STAGES.findIndex(s => s.name === stage.name) - 1]?.name ?? '…'}</span>
                  )}
                </div>
                </div>{/* end inner content wrapper */}
              </div>
            );
          })}
        </div>

        {/* Master progress bar */}
        <div className="mt-4 relative h-1.5 bg-[#eef0f4] rounded-full overflow-hidden">
          <div className="absolute top-0 bottom-0 w-px bg-black/[0.06]" style={{ left: '25%' }} />
          <div className="absolute top-0 bottom-0 w-px bg-black/[0.06]" style={{ left: '50%' }} />
          <div className="absolute top-0 bottom-0 w-px bg-black/[0.06]" style={{ left: '75%' }} />
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: isComplete
                ? '#34d399'
                : 'linear-gradient(90deg, #34d399 0%, #6366f1 65%, #c4b5fd 100%)',
              boxShadow: isComplete ? 'none' : '0 0 12px rgba(99,102,241,0.4)',
            }}
          />
        </div>
      </button>

      {/* Expanded step list */}
      {isOpen && (
        <div className="px-5 pb-4 border-t border-gray-100/60 animate-fade-in">
          <div className="flex flex-wrap gap-1.5 pt-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-300 ${
                  step.status === 'complete' ? 'bg-emerald-50/80 text-emerald-500'
                  : step.status === 'active' ? 'bg-indigo-50/80 text-indigo-500 animate-pulse'
                  : 'bg-gray-50/60 text-gray-300'
                }`}
              >
                {step.status === 'complete' ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${step.status === 'active' ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                )}
                {step.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
