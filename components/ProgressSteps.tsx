'use client';

import { PipelineStep } from '@/types';

interface ProgressStepsProps {
  steps: PipelineStep[];
  visible: boolean;
}

export default function ProgressSteps({ steps, visible }: ProgressStepsProps) {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      {steps.map((step) => (
        <div
          key={step.id}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
            step.status === 'complete'
              ? 'bg-green-100 text-green-700'
              : step.status === 'active'
              ? 'bg-blue-200 text-blue-800 animate-pulse'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {step.status === 'complete' ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : step.status === 'active' ? (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-gray-300" />
          )}
          {step.label}
        </div>
      ))}
    </div>
  );
}
