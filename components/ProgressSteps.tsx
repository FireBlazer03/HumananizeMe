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
    <div className="rounded-xl border border-gray-200/60 bg-white/60 overflow-hidden animate-fade-in">
      {/* Header with progress bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3 hover:bg-gray-50/50 transition-colors duration-200"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Processing Details</h3>
            {activeStep && !isComplete && (
              <span className="text-xs font-medium text-indigo-600 animate-pulse">
                {activeStep.label}...
              </span>
            )}
            {isComplete && (
              <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Complete
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{completedCount}/{steps.length}</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isComplete ? 'bg-green-400' : 'bg-indigo-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </button>

      {/* Collapsible step details */}
      {isOpen && (
        <div className="px-5 pb-4 border-t border-gray-100 animate-fade-in">
          <div className="flex flex-wrap gap-1.5 pt-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-300 ${
                  step.status === 'complete'
                    ? 'bg-green-50 text-green-600'
                    : step.status === 'active'
                    ? 'bg-indigo-50 text-indigo-600 animate-pulse'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {step.status === 'complete' ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === 'active' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
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
