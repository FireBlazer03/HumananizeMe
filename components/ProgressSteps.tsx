'use client';

import { useState } from 'react';
import { PipelineStep } from '@/types';

interface ProgressStepsProps {
  steps: PipelineStep[];
  visible: boolean;
}

export default function ProgressSteps({ steps, visible }: ProgressStepsProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!visible) return null;

  const completedCount = steps.filter(s => s.status === 'complete').length;
  const activeStep = steps.find(s => s.status === 'active');
  const progress = (completedCount / steps.length) * 100;
  const isComplete = completedCount === steps.length;

  return (
    <div className="rounded-2xl inner-card overflow-hidden animate-fade-in">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 hover:bg-gray-50/40 transition-colors duration-200"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Processing</h3>
            {activeStep && !isComplete && (
              <span className="text-[11px] font-medium text-indigo-500 animate-pulse">{activeStep.label}...</span>
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
            <span className="text-[11px] font-mono text-gray-300 tabular-nums">{completedCount}/{steps.length}</span>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isComplete ? 'bg-emerald-400' : 'bg-indigo-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </button>

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
                ) : step.status === 'active' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
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
