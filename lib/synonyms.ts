import { vocabReplacements } from './vocabMap';

// Technical terms that should never be simplified — meaning would change
const DONT_REPLACE = new Set([
  'algorithm', 'implementation', 'infrastructure', 'authentication',
  'authorization', 'configuration', 'documentation', 'optimization',
  'cryptocurrency', 'blockchain', 'artificial', 'intelligence',
  'architecture', 'distribution', 'environment', 'application',
  'information', 'communication', 'organization', 'administration',
  'automatically', 'approximately', 'particularly', 'specifically',
  'relationship', 'development', 'performance', 'experience',
]);

// Words already handled by the static vocab map
const vocabKeys = new Set(vocabReplacements.map(([phrase]) => phrase.toLowerCase()));

// Module-level cache to avoid duplicate API calls
const synonymCache = new Map<string, string | null>();

function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function preserveCase(original: string, replacement: string): string {
  if (!replacement) return replacement;
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

async function getSimplestSynonym(word: string): Promise<string | null> {
  const lower = word.toLowerCase();

  if (lower.length < 6 || countSyllables(lower) < 4) return null;
  if (DONT_REPLACE.has(lower)) return null;
  if (vocabKeys.has(lower)) return null;

  if (synonymCache.has(lower)) return synonymCache.get(lower) ?? null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(lower)}&md=f&max=8`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data: Array<{ word: string; tags?: string[] }> = await res.json();

    if (!data || data.length === 0) {
      synonymCache.set(lower, null);
      return null;
    }

    const withFreq = data.map(item => {
      const fTag = item.tags?.find(t => t.startsWith('f:'));
      const freq = fTag ? parseFloat(fTag.slice(2)) : 0;
      return { word: item.word, freq };
    });

    // Sort by frequency descending — highest freq = most common = most human
    withFreq.sort((a, b) => b.freq - a.freq);

    // Only replace if the synonym is simpler (fewer syllables)
    const best = withFreq[0];
    if (best && countSyllables(best.word) < countSyllables(lower)) {
      synonymCache.set(lower, best.word);
      return best.word;
    }

    synonymCache.set(lower, null);
    return null;
  } catch {
    synonymCache.set(lower, null);
    return null;
  }
}

// Process fetches in batches to avoid hammering the API
async function batchFetch(
  words: string[],
  concurrency: number
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  for (let i = 0; i < words.length; i += concurrency) {
    const batch = words.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async w => {
        const syn = await getSimplestSynonym(w);
        return { word: w, syn };
      })
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.word, result.value.syn);
      }
    }
  }
  return results;
}

export async function applyDynamicSynonyms(text: string): Promise<string> {
  // Find all candidate words: 4+ syllables, 6+ chars, not proper nouns
  const wordRegex = /\b([a-zA-Z]+)\b/g;
  const candidates: Set<string> = new Set();
  let match;

  // Track word positions for proper noun detection
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const raw = words[i].replace(/[^a-zA-Z]/g, '');
      if (!raw) continue;

      const lower = raw.toLowerCase();

      // Skip if too short or too few syllables
      if (lower.length < 6 || countSyllables(lower) < 4) continue;

      // Skip proper nouns: capitalized and not first word of sentence
      if (i > 0 && raw[0] === raw[0].toUpperCase() && raw[0] !== raw[0].toLowerCase()) continue;

      // Skip technical terms and vocab map words
      if (DONT_REPLACE.has(lower) || vocabKeys.has(lower)) continue;

      candidates.add(lower);
    }
  }

  if (candidates.size === 0) return text;

  // Fetch synonyms in batches of 5
  const synonyms = await batchFetch(Array.from(candidates), 5);

  // Apply replacements
  let result = text;
  for (const [original, synonym] of synonyms) {
    if (!synonym) continue;
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    result = result.replace(regex, (matched) => preserveCase(matched, synonym));
  }

  return result;
}
