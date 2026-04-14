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
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-sm font-bold text-gray-700 tracking-wide">INPUT</h2>
        <span className="text-xs font-medium text-gray-400 tabular-nums">{wordCount} words</span>
      </div>
      <div className="h-px bg-gray-200/60 mb-4" />

      {/* Textarea Card */}
      <div className="relative flex-1 rounded-xl inner-card overflow-hidden group">
        {/* Subtle icon watermark */}
        {!text && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <svg className="w-16 h-16 text-gray-200/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
        )}
        <textarea
          className="w-full h-full min-h-[300px] p-6 resize-y bg-gray-50/40 text-gray-700 text-sm focus:outline-none focus:bg-white/80 placeholder-gray-400/60 rounded-xl border border-transparent transition-all duration-200 relative z-10"
          placeholder="Paste AI-generated text here..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {/* Scan Button */}
      <button
        onClick={onScan}
        disabled={!text.trim() || isProcessing}
        className="mt-4 w-full py-2.5 px-4 text-sm font-medium text-gray-600 bg-white/80 border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 hover:shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Scan for AI patterns
        </span>
      </button>
    </div>
  );
}
