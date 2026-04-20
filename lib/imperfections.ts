import { ImperfectionLevel } from '@/types';
import { rng } from './rng';

interface Rates {
  spacePunct: number;
  doubleSpace: number;
}

const RATE_TABLE: Record<ImperfectionLevel, Rates> = {
  subtle:    { spacePunct: 0.08, doubleSpace: 0.02 },
  moderate:  { spacePunct: 0.15, doubleSpace: 0.05 },
  realistic: { spacePunct: 0.22, doubleSpace: 0.08 },
};

// Safe sentence splitter that preserves trailing text
function safeSplitSentences(text: string): string[] {
  const parts: string[] = [];
  const regex = /[^.!?]+[.!?]+\s*/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    parts.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function isEligible(sentence: string, index: number): boolean {
  if (index === 0) return false;
  const trimmed = sentence.trim();
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('>')) return false;
  if (trimmed.startsWith('```')) return false;
  if (/^\d+\./.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 6) return false;
  return true;
}

export function injectImperfections(text: string, intensity: ImperfectionLevel): string {
  const sentences = safeSplitSentences(text);
  if (sentences.length < 3) return text;

  const r = RATE_TABLE[intensity];
  const targetPer500 = { subtle: 4, moderate: 8, realistic: 12 }[intensity];
  const wordCount = text.split(/\s+/).length;
  // Always inject at least 2 imperfections regardless of text length
  const totalTarget = Math.max(2, Math.round((wordCount / 500) * targetPer500));

  // Clustering state machine — scale gap to text length
  let injected = 0;
  let sinceLastCluster = 0;
  let clusterRemaining = 0;
  const baseGap = sentences.length < 12 ? 2 : 8;
  const gapRange = sentences.length < 12 ? 3 : 8;
  const nextClusterGap = () => baseGap + Math.floor(rng() * gapRange);
  let gapTarget = nextClusterGap();

  const result = sentences.map((s, i) => {
    if (!isEligible(s, i) || injected >= totalTarget) return s;

    // Clustering logic
    if (clusterRemaining <= 0) {
      sinceLastCluster++;
      if (sinceLastCluster < gapTarget) return s;
      // Start a new cluster
      clusterRemaining = 2;
      sinceLastCluster = 0;
      gapTarget = nextClusterGap();
    }

    let modified = s;
    let didInject = false;

    // When inside a cluster, boost the rate to ensure imperfections actually land
    const clusterBoost = clusterRemaining > 0 ? 2.5 : 1;
    const effectiveRate = Math.min(r.spacePunct * clusterBoost, 0.85);

    // Space before sentence-ending punctuation
    if (rng() < effectiveRate) {
      modified = modified.replace(/([.!?])(\s*)$/, ' $1$2');
      didInject = true;
    }

    // Space before a comma
    if (!didInject && rng() < effectiveRate * 0.6) {
      const commaIdx = modified.indexOf(',');
      if (commaIdx > 1 && modified[commaIdx - 1] !== ' ' && modified[commaIdx - 1] !== '\n') {
        modified = modified.slice(0, commaIdx) + ' ,' + modified.slice(commaIdx + 1);
        didInject = true;
      }
    }

    // Double space
    if (!didInject && rng() < r.doubleSpace * clusterBoost) {
      const words = modified.split(' ');
      if (words.length > 4) {
        const idx = 1 + Math.floor(rng() * (words.length - 2));
        words[idx] = ' ' + words[idx];
        modified = words.join(' ');
        didInject = true;
      }
    }

    if (didInject) {
      injected++;
      clusterRemaining--;
    }

    return modified;
  });

  // Guarantee at least 1 space-before-punctuation even if clustering missed all sentences
  if (injected === 0) {
    for (let i = result.length - 1; i >= 1; i--) {
      if (isEligible(result[i], i)) {
        result[i] = result[i].replace(/([.!?])(\s*)$/, ' $1$2');
        injected++;
        break;
      }
    }
  }

  return result.join('');
}
