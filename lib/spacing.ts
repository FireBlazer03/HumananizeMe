export type SpacingIntensity = 'low' | 'medium' | 'high';

// Per-sentence probability that ANY imperfection fires in that sentence.
// The actual type (space-before-punct vs double-space) is chosen randomly within.
const SENTENCE_HIT_RATE: Record<SpacingIntensity, number> = {
  low:    0.10, // ~10% of sentences get one imperfection
  medium: 0.18, // ~18%
  high:   0.28, // ~28%
};

// Minimum imperfections per 100 words (guaranteed floor)
const MIN_PER_100: Record<SpacingIntensity, number> = {
  low:    1,
  medium: 2,
  high:   3,
};

// Patterns that must never receive spacing injections
const SKIP_PATTERNS = [
  /^```/,                      // code block
  /^https?:\/\//,              // URL line
  /^\s*\d+\.\s/,               // numbered list item
  /^\s*[-*]\s/,                // bullet list item
  /^\s*#/,                     // heading
];

function isSkippable(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) return true;
  if (SKIP_PATTERNS.some(p => p.test(trimmed))) return true;
  // Skip sentences that contain URLs, numbers with decimals, or code-like patterns
  if (/https?:\/\//.test(trimmed)) return true;
  if (/`[^`]+`/.test(trimmed)) return true;
  // Too short to safely inject into
  if (trimmed.split(/\s+/).length < 5) return true;
  return false;
}

// Split text into sentence-like chunks, preserving paragraph structure
function chunkSentences(text: string): string[] {
  const chunks: string[] = [];
  const regex = /[^.!?\n]+[.!?]*\n?/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    chunks.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }
  return chunks;
}

type Injector = (s: string) => string;

// Inject a space before the terminal punctuation of a sentence
const injectSpaceBeforePunct: Injector = (s) =>
  s.replace(/([.!?,])(\s*)$/, ' $1$2');

// Inject a space before the first comma found mid-sentence
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
  // Pick a position in the middle third of the sentence
  const lo = Math.floor(words.length * 0.3);
  const hi = Math.floor(words.length * 0.7);
  const pos = lo + Math.floor(Math.random() * (hi - lo));
  words[pos] = ' ' + words[pos]; // prepend extra space
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
 *
 * @param text      - The text to apply imperfections to
 * @param intensity - 'low' | 'medium' | 'high'
 * @returns Modified text with subtle spacing imperfections
 */
export function applyRandomSpacing(text: string, intensity: SpacingIntensity): string {
  const chunks = chunkSentences(text);
  if (chunks.length === 0) return text;

  const hitRate = SENTENCE_HIT_RATE[intensity];
  const wordCount = text.split(/\s+/).length;
  const minGuaranteed = Math.max(1, Math.floor((wordCount / 100) * MIN_PER_100[intensity]));

  let totalInjected = 0;

  // Track positions already modified to avoid double-imperfection on same sentence
  const modified = chunks.map((chunk, idx) => {
    // Never touch first sentence
    if (idx === 0) return chunk;
    if (isSkippable(chunk)) return chunk;
    // Max 2 imperfections per sentence (enforce here with a single-inject limit)
    if (Math.random() >= hitRate) return chunk;

    // Choose injector randomly; avoid double-space on short sentences
    const available = chunk.split(/\s+/).length >= 6
      ? INJECTORS
      : INJECTORS.slice(0, 2); // only punct-based on short sentences
    const injector = available[Math.floor(Math.random() * available.length)];
    const result = injector(chunk);
    if (result !== chunk) totalInjected++;
    return result;
  });

  // Minimum guarantee: if not enough injected, force-inject on eligible sentences
  // starting from the middle (not the first or last)
  if (totalInjected < minGuaranteed) {
    const eligible = modified
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i > 0 && !isSkippable(c) && !/  /.test(c));

    // Shuffle eligible list for randomness
    eligible.sort(() => Math.random() - 0.5);

    for (const { i } of eligible) {
      if (totalInjected >= minGuaranteed) break;
      const result = injectSpaceBeforePunct(modified[i]);
      if (result !== modified[i]) {
        modified[i] = result;
        totalInjected++;
      }
    }
  }

  return modified.join('');
}
