'use client';

interface InputPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  onScan: () => void;
  isProcessing: boolean;
}

export default function InputPanel({ text, onTextChange, onScan, isProcessing }: InputPanelProps) {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Input</h2>
        <span className="text-[11px] font-medium text-gray-300 tabular-nums">{wordCount} words</span>
      </div>

      <div className="relative flex-1 rounded-2xl inner-card overflow-hidden">
        {!text && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3" aria-hidden="true">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <span className="text-xs text-gray-300">Paste your AI text here</span>
          </div>
        )}
        <textarea
          className="w-full h-full min-h-[280px] p-5 resize-y bg-transparent text-gray-700 text-sm focus:outline-none placeholder-transparent rounded-2xl relative z-10"
          placeholder="Paste AI-generated text here..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      <button
        onClick={onScan}
        disabled={!text.trim() || isProcessing}
        className="mt-3 w-full py-2 px-4 text-[11px] font-medium text-gray-400 hover:text-gray-600 border border-gray-200 rounded-full hover:border-gray-300 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Scan for AI patterns
        </span>
      </button>
    </div>
  );
}
