'use client';

import { useMemo, useState } from 'react';

interface OutputPanelProps {
  originalText: string;
  outputText: string;
}

interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

function computeWordDiff(original: string, modified: string): DiffSegment[] {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);
  const m = origWords.length;
  const n = modWords.length;

  if (m * n > 1000000) return simpleDiff(origWords, modWords);

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = origWords[i - 1] === modWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = m, j = n;
  const raw: { type: DiffSegment['type']; text: string }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
      raw.unshift({ type: 'same', text: origWords[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: 'added', text: modWords[j - 1] }); j--;
    } else {
      raw.unshift({ type: 'removed', text: origWords[i - 1] }); i--;
    }
  }
  for (const item of raw) {
    if (segments.length > 0 && segments[segments.length - 1].type === item.type) {
      segments[segments.length - 1].text += item.text;
    } else {
      segments.push({ ...item });
    }
  }
  return segments;
}

function simpleDiff(origWords: string[], modWords: string[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = 0, j = 0;
  while (i < origWords.length && j < modWords.length) {
    if (origWords[i] === modWords[j]) {
      if (segments.length > 0 && segments[segments.length - 1].type === 'same') {
        segments[segments.length - 1].text += origWords[i];
      } else { segments.push({ type: 'same', text: origWords[i] }); }
      i++; j++;
    } else {
      let foundI = -1, foundJ = -1;
      const lookAhead = Math.min(20, Math.max(origWords.length - i, modWords.length - j));
      for (let k = 1; k < lookAhead; k++) {
        if (i + k < origWords.length && origWords[i + k] === modWords[j]) { foundI = i + k; break; }
        if (j + k < modWords.length && origWords[i] === modWords[j + k]) { foundJ = j + k; break; }
      }
      if (foundI >= 0) { segments.push({ type: 'removed', text: origWords.slice(i, foundI).join('') }); i = foundI; }
      else if (foundJ >= 0) { segments.push({ type: 'added', text: modWords.slice(j, foundJ).join('') }); j = foundJ; }
      else { segments.push({ type: 'removed', text: origWords[i] }); segments.push({ type: 'added', text: modWords[j] }); i++; j++; }
    }
  }
  while (i < origWords.length) { segments.push({ type: 'removed', text: origWords[i] }); i++; }
  while (j < modWords.length) { segments.push({ type: 'added', text: modWords[j] }); j++; }
  return segments;
}

export default function OutputPanel({ originalText, outputText }: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<'output' | 'changes'>('output');
  const [copied, setCopied] = useState(false);
  const wordCount = outputText.trim() ? outputText.trim().split(/\s+/).length : 0;
  const diffSegments = useMemo(() => {
    if (!originalText || !outputText) return [];
    return computeWordDiff(originalText, outputText);
  }, [originalText, outputText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = outputText; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Output</h2>
          <div className="flex bg-gray-100/70 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('output')}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                activeTab === 'output' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >Text</button>
            <button
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                activeTab === 'changes' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >Diff</button>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-medium text-gray-300 tabular-nums">{wordCount} words</span>
          {outputText && (
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-all duration-200 active:scale-95 ${
                copied
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'text-gray-400 border border-gray-200 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[280px] rounded-2xl inner-card overflow-auto">
        {!outputText ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 p-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="text-center space-y-3">
              <p className="text-xs font-medium text-gray-400">Humanized text appears here</p>
              <ol className="text-[11px] text-gray-300 space-y-1 text-left list-none">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0">1</span>
                  Paste AI text on the left
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0">2</span>
                  Choose your mode &amp; settings
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0">3</span>
                  Click <strong className="text-gray-400">Humanize</strong> to transform
                </li>
              </ol>
            </div>
          </div>
        ) : activeTab === 'output' ? (
          <pre className="p-5 text-sm text-gray-700 whitespace-pre-wrap font-sans animate-fade-in" style={{ lineHeight: '1.85' }}>
            {outputText}
          </pre>
        ) : (
          <div className="p-5 text-sm animate-fade-in" style={{ lineHeight: '1.85' }}>
            {diffSegments.map((seg, i) => {
              if (seg.type === 'same') return <span key={i} className="text-gray-700">{seg.text}</span>;
              if (seg.type === 'removed') return <span key={i} className="bg-red-50 text-red-600 line-through rounded px-0.5">{seg.text}</span>;
              return <mark key={i} className="bg-emerald-50 text-emerald-700 rounded px-0.5">{seg.text}</mark>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
