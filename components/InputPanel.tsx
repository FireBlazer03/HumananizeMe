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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Input</h2>
        <span className="text-xs text-gray-400">{wordCount} words</span>
      </div>
      <div className="relative flex-1">
        <textarea
          className="w-full h-full min-h-[250px] p-4 border border-gray-200 rounded-lg resize-y bg-white text-gray-800 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
          placeholder="Paste AI-generated text here..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={isProcessing}
        />
      </div>
      <button
        onClick={onScan}
        disabled={!text.trim() || isProcessing}
        className="mt-3 w-full py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Scan for AI patterns
      </button>
    </div>
  );
}
