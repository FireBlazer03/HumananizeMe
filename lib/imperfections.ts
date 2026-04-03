import { ImperfectionLevel } from '@/types';

interface Rates {
  spacePunct: number;
  doubleSpace: number;
  splice: number;
  typo: number;
}

const RATE_TABLE: Record<ImperfectionLevel, Rates> = {
  subtle:    { spacePunct: 0.08, doubleSpace: 0.02,  splice: 0,     typo: 0 },
  moderate:  { spacePunct: 0.15, doubleSpace: 0.05,  splice: 0.04,  typo: 0 },
  realistic: { spacePunct: 0.22, doubleSpace: 0.08,  splice: 0.07,  typo: 0.01 },
};

const TYPO_MAP: Record<string, string> = {
  ' the ': ' teh ',
  ' and ': ' adn ',
  ' that ': ' taht ',
  ' with ': ' wiht ',
  ' have ': ' ahve ',
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
  console.log('[imperfections] START', { intensity, wordCount: text.split(/\s+/).length });

  const sentences = safeSplitSentences(text);
  if (sentences.length < 3) {
    console.log('[imperfections] END — too few sentences, skipping');
    return text;
  }

  const r = RATE_TABLE[intensity];
  const targetPer500 = { subtle: 2.5, moderate: 5, realistic: 8.5 }[intensity];
  const wordCount = text.split(/\s+/).length;
  const totalTarget = Math.max(1, Math.round((wordCount / 500) * targetPer500));

  // Clustering state machine — scale gap to text length
  let injected = 0;
  let sinceLastCluster = 0;
  let clusterRemaining = 0;
  const baseGap = sentences.length < 12 ? 2 : 8;
  const gapRange = sentences.length < 12 ? 3 : 8;
  const nextClusterGap = () => baseGap + Math.floor(Math.random() * gapRange);
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
    if (Math.random() < effectiveRate) {
      modified = modified.replace(/([.!?])(\s*)$/, ' $1$2');
      didInject = true;
    }

    // Space before a comma
    if (!didInject && Math.random() < effectiveRate * 0.6) {
      const commaIdx = modified.indexOf(',');
      if (commaIdx > 1 && modified[commaIdx - 1] !== ' ' && modified[commaIdx - 1] !== '\n') {
        modified = modified.slice(0, commaIdx) + ' ,' + modified.slice(commaIdx + 1);
        didInject = true;
      }
    }

    // Double space
    if (!didInject && Math.random() < r.doubleSpace * clusterBoost) {
      const words = modified.split(' ');
      if (words.length > 4) {
        const idx = 1 + Math.floor(Math.random() * (words.length - 2));
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

  // Comma splice — merge adjacent short sentences occasionally
  if (r.splice > 0) {
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i].trim();
      const b = result[i + 1]?.trim();
      if (
        b &&
        Math.random() < r.splice &&
        a.split(' ').length < 10 &&
        b.split(' ').length < 10 &&
        !a.startsWith('#') &&
        !b.startsWith('#') &&
        injected < totalTarget + 2
      ) {
        const merged =
          a.replace(/[.!?]\s*$/, '') +
          ' , ' +
          b.charAt(0).toLowerCase() +
          b.slice(1);
        result[i] = merged;
        result.splice(i + 1, 1);
        injected++;
      }
    }
  }

  // Typo injection — max 1 per document in realistic
  if (r.typo > 0 && Math.random() < 0.4) {
    const entries = Object.entries(TYPO_MAP);
    for (const [word, typo] of entries) {
      if (Math.random() > 0.3) continue;
      for (let i = 1; i < result.length; i++) {
        if (result[i].includes(word)) {
          result[i] = result[i].replace(word, typo);
          break;
        }
      }
      break;
    }
  }

  console.log('[imperfections] END', { injected, totalTarget });
  return result.join('');
}
