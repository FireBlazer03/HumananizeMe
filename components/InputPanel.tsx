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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Input</h2>
        <span className="text-xs font-medium text-gray-400">{wordCount} words</span>
      </div>

      {/* Textarea Card */}
      <div className="relative flex-1 rounded-xl border border-gray-200/80 bg-white/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        <textarea
          className="w-full h-full min-h-[280px] p-5 resize-y bg-transparent text-gray-700 text-sm leading-relaxed focus:outline-none placeholder-gray-400"
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
        className="mt-3 w-full py-2.5 px-4 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
