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

  // Simple LCS-based diff
  const m = origWords.length;
  const n = modWords.length;

  // For very large texts, use a simpler approach
  if (m * n > 1000000) {
    return simpleDiff(origWords, modWords);
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === modWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const segments: DiffSegment[] = [];
  let i = m, j = n;
  const raw: { type: DiffSegment['type']; text: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
      raw.unshift({ type: 'same', text: origWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: 'added', text: modWords[j - 1] });
      j--;
    } else {
      raw.unshift({ type: 'removed', text: origWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive segments of same type
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
      } else {
        segments.push({ type: 'same', text: origWords[i] });
      }
      i++;
      j++;
    } else {
      // Look ahead to find next match
      let foundI = -1, foundJ = -1;
      const lookAhead = Math.min(20, Math.max(origWords.length - i, modWords.length - j));
      for (let k = 1; k < lookAhead; k++) {
        if (i + k < origWords.length && origWords[i + k] === modWords[j]) {
          foundI = i + k;
          break;
        }
        if (j + k < modWords.length && origWords[i] === modWords[j + k]) {
          foundJ = j + k;
          break;
        }
      }

      if (foundI >= 0) {
        // Words were removed from original
        const removed = origWords.slice(i, foundI).join('');
        segments.push({ type: 'removed', text: removed });
        i = foundI;
      } else if (foundJ >= 0) {
        // Words were added in modified
        const added = modWords.slice(j, foundJ).join('');
        segments.push({ type: 'added', text: added });
        j = foundJ;
      } else {
        segments.push({ type: 'removed', text: origWords[i] });
        segments.push({ type: 'added', text: modWords[j] });
        i++;
        j++;
      }
    }
  }

  while (i < origWords.length) {
    segments.push({ type: 'removed', text: origWords[i] });
    i++;
  }
  while (j < modWords.length) {
    segments.push({ type: 'added', text: modWords[j] });
    j++;
  }

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = outputText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('output')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'output'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Output
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'changes'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Changes highlighted
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{wordCount} words</span>
          {outputText && (
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[250px] border border-gray-200 rounded-lg bg-white overflow-auto">
        {!outputText ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Humanized text will appear here
          </div>
        ) : activeTab === 'output' ? (
          <pre className="p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
            {outputText}
          </pre>
        ) : (
          <div className="p-4 text-sm leading-relaxed">
            {diffSegments.map((seg, i) => {
              if (seg.type === 'same') {
                return <span key={i}>{seg.text}</span>;
              }
              if (seg.type === 'removed') {
                return (
                  <span key={i} className="bg-red-100 text-red-800 line-through">
                    {seg.text}
                  </span>
                );
              }
              return (
                <mark key={i} className="bg-green-100 text-green-800">
                  {seg.text}
                </mark>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
