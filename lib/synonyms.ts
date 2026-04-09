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

// Static offline fallback: long/formal words → shorter plain alternatives
// Only covers single words (phrases handled by vocabMap).
// Ordered longest-first to avoid partial collision.
// CURATED: removed entries that break meaning in common contexts.
// e.g. "experienced difficulties" ≠ "skilled difficulties",
//      "established company" ≠ "set up company",
//      "committed a crime" ≠ "dedicated a crime"
const STATIC_SIMPLIFY: [string, string][] = [
  ['acknowledgement', 'recognition'],
  ['categorically', 'clearly'],
  ['circumstances', 'situation'],
  ['collaboration', 'teamwork'],
  ['collaborating', 'working together'],
  ['collaborators', 'partners'],
  ['communicating', 'sharing'],
  ['comprehension', 'understanding'],
  ['consideration', 'thought'],
  ['contributions', 'input'],
  ['significantly', 'greatly'],
  ['continuously', 'steadily'],
  ['coordination', 'teamwork'],
  ['determination', 'drive'],
  ['disadvantages', 'downsides'],
  ['exceptionally', 'very'],
  ['increasingly', 'more and more'],
  ['independently', 'on their own'],
  ['organizations', 'groups'],
  ['organization', 'group'],
  ['nevertheless', 'still'],
  ['particularly', 'especially'],
  ['possibilities', 'options'],
  ['practitioners', 'experts'],
  ['predominantly', 'mostly'],
  ['consistently', 'steadily'],
  ['requirements', 'needs'],
  ['responsibilities', 'duties'],
  ['approximately', 'about'],
  ['additionally', 'also'],
  ['consequently', 'so'],
  ['subsequently', 'then'],
  ['fundamental', 'basic'],
  ['essentially', 'basically'],
  ['potentially', 'possibly'],
  ['efficiently', 'quickly'],
  ['immediately', 'right away'],
  ['opportunity', 'chance'],
  ['therefore', 'so'],
  ['necessary', 'needed'],
  ['currently', 'now'],
  ['extremely', 'very'],
  ['typically', 'usually'],
];

// Perplexity boosters: common AI-predictable words → less predictable alternatives
// Applied stochastically (25% of occurrences) to raise perplexity.
// CURATED: only entries where ALL alternatives preserve meaning in most contexts.
const PERPLEXITY_BOOSTERS: [string, string[]][] = [
  ['approach', ['method', 'angle']],
  ['provide', ['supply', 'offer']],
  ['require', ['call for', 'need']],
  ['achieve', ['attain', 'reach']],
  ['address', ['tackle', 'deal with']],
  ['consider', ['weigh', 'examine']],
  ['identify', ['pinpoint', 'spot']],
  ['evaluate', ['gauge', 'assess']],
  ['benefits', ['upsides', 'gains']],
  ['industry', ['sector', 'field']],
  ['solution', ['fix', 'answer']],
  ['continue', ['carry on', 'keep going']],
  ['relevant', ['pertinent', 'applicable']],
  ['specific', ['particular', 'precise']],
];

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

// Perplexity-aware synonym selection: instead of always picking the most common
// synonym, randomly select across frequency tiers to increase unpredictability.
async function getPerplexityAwareSynonym(word: string): Promise<string | null> {
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

    const origSyllables = countSyllables(lower);
    const withFreq = data
      .map(item => {
        const fTag = item.tags?.find(t => t.startsWith('f:'));
        const freq = fTag ? parseFloat(fTag.slice(2)) : 0;
        return { word: item.word, freq };
      })
      // Reject synonyms that are way more complex (3+ more syllables) or very rare
      .filter(s => s.freq >= 0.5 && countSyllables(s.word) <= origSyllables + 2);

    if (withFreq.length === 0) {
      synonymCache.set(lower, null);
      return null;
    }

    // Sort by frequency descending
    withFreq.sort((a, b) => b.freq - a.freq);

    // Perplexity-aware weighted selection:
    // 40% → most common, 35% → mid-frequency, 25% → less common
    let picked: typeof withFreq[0];
    const roll = Math.random();
    if (roll < 0.40 || withFreq.length === 1) {
      picked = withFreq[0]; // most common
    } else if (roll < 0.75 && withFreq.length >= 3) {
      picked = withFreq[1 + Math.floor(Math.random() * Math.min(2, withFreq.length - 1))]; // mid
    } else if (withFreq.length >= 4) {
      const lo = Math.min(3, withFreq.length - 1);
      picked = withFreq[lo + Math.floor(Math.random() * (withFreq.length - lo))]; // less common
    } else {
      picked = withFreq[Math.floor(Math.random() * withFreq.length)]; // fallback
    }

    synonymCache.set(lower, picked.word);
    return picked.word;
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
        const syn = await getPerplexityAwareSynonym(w);
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

  // Step 0: Apply perplexity boosters stochastically (25% of occurrences)
  let result = text;
  for (const [word, alternatives] of PERPLEXITY_BOOSTERS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, (matched) => {
      if (Math.random() > 0.25) return matched; // keep original 75% of the time
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      return preserveCase(matched, alt);
    });
  }

  // Step 1: Apply static offline fallback (always runs, no network needed)
  for (const [formal, simple] of STATIC_SIMPLIFY) {
    if (vocabKeys.has(formal.toLowerCase())) continue;
    const regex = new RegExp(`\\b${formal}\\b`, 'gi');
    result = result.replace(regex, (matched) => preserveCase(matched, simple));
  }

  // Datamuse API DISABLED — context-blind synonym lookup produces incorrect
  // substitutions (e.g. "integration" → "desegregation"). Static replacements
  // are safer because they are manually curated for meaning preservation.

  return result;
}
