export type SpacingIntensity = 'low' | 'medium' | 'high';

// Per-sentence probability that ANY imperfection fires in that sentence.
const SENTENCE_HIT_RATE: Record<SpacingIntensity, number> = {
  low:    0.25,
  medium: 0.40,
  high:   0.55,
};

// Minimum imperfections per 100 words (guaranteed floor)
const MIN_PER_100: Record<SpacingIntensity, number> = {
  low:    2,
  medium: 3,
  high:   5,
};

// Patterns that must never receive spacing injections
const SKIP_PATTERNS = [
  /^```/,
  /^https?:\/\//,
  /^\s*\d+\.\s/,
  /^\s*[-*]\s/,
  /^\s*#/,
];

function isSkippable(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) return true;
  if (SKIP_PATTERNS.some(p => p.test(trimmed))) return true;
  if (/https?:\/\//.test(trimmed)) return true;
  if (/`[^`]+`/.test(trimmed)) return true;
  if (trimmed.split(/\s+/).length < 5) return true;
  return false;
}

// Split text into sentence-like chunks, preserving paragraph structure
function chunkSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by a space
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter(p => p.length > 0);
}

type Injector = (s: string) => string;

// Inject a space before the terminal punctuation of a sentence
const injectSpaceBeforePunct: Injector = (s) => {
  // Match the last punctuation mark
  return s.replace(/([.!?])$/, ' $1');
};

// Inject a space before a comma found mid-sentence
const injectSpaceBeforeComma: Injector = (s) => {
  const idx = s.indexOf(',');
  if (idx > 1 && s[idx - 1] !== ' ') {
    return s.slice(0, idx) + ' ,' + s.slice(idx + 1);
  }
  return s;
};

// Inject a double space between two words somewhere in the middle
const injectDoubleSpace: Injector = (s) => {
  const words = s.split(' ');
  if (words.length < 5) return s;
  const lo = Math.floor(words.length * 0.3);
  const hi = Math.floor(words.length * 0.7);
  const pos = lo + Math.floor(Math.random() * (hi - lo));
  words[pos] = words[pos] + ' '; // append extra space so join creates double
  return words.join(' ');
};

const INJECTORS: Injector[] = [
  injectSpaceBeforePunct,
  injectSpaceBeforeComma,
  injectDoubleSpace,
];

/**
 * Applies random spacing imperfections to text.
 * Completely independent of AI detection scores — purely user-driven.
 */
export function applyRandomSpacing(text: string, intensity: SpacingIntensity): string {
  console.log('[spacing] applyRandomSpacing called, intensity:', intensity);

  const chunks = chunkSentences(text);
  console.log('[spacing] sentence chunks:', chunks.length);

  if (chunks.length === 0) return text;

  const hitRate = SENTENCE_HIT_RATE[intensity];
  const wordCount = text.split(/\s+/).length;
  const minGuaranteed = Math.max(2, Math.ceil((wordCount / 100) * MIN_PER_100[intensity]));

  console.log('[spacing] hitRate:', hitRate, 'wordCount:', wordCount, 'minGuaranteed:', minGuaranteed);

  let totalInjected = 0;

  const modified = chunks.map((chunk, idx) => {
    // Never touch first sentence
    if (idx === 0) return chunk;
    if (isSkippable(chunk)) return chunk;

    if (Math.random() >= hitRate) return chunk;

    // Choose injector randomly
    const available = chunk.split(/\s+/).length >= 6
      ? INJECTORS
      : INJECTORS.slice(0, 2);
    const injector = available[Math.floor(Math.random() * available.length)];
    const result = injector(chunk);
    if (result !== chunk) {
      totalInjected++;
      console.log(`[spacing] injected in sentence ${idx}: "${chunk.slice(0, 40)}..." -> "${result.slice(0, 40)}..."`);
    }
    return result;
  });

  // Minimum guarantee: force-inject on eligible sentences if needed
  if (totalInjected < minGuaranteed) {
    console.log(`[spacing] guarantee: need ${minGuaranteed}, have ${totalInjected}, forcing more`);
    const eligible = modified
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i > 0 && !isSkippable(c));

    // Shuffle for randomness
    eligible.sort(() => Math.random() - 0.5);

    for (const { i } of eligible) {
      if (totalInjected >= minGuaranteed) break;
      // Alternate between injector types for variety
      const injector = INJECTORS[totalInjected % INJECTORS.length];
      const result = injector(modified[i]);
      if (result !== modified[i]) {
        console.log(`[spacing] force-injected in sentence ${i}`);
        modified[i] = result;
        totalInjected++;
      }
    }
  }

  console.log('[spacing] total injected:', totalInjected);

  // Rejoin with spaces (since we split on space after punctuation)
  return modified.join(' ');
}
