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
const STATIC_SIMPLIFY: [string, string][] = [
  ['acknowledgement', 'recognition'],
  ['categorically', 'clearly'],
  ['circumstances', 'situation'],
  ['collaboration', 'teamwork'],
  ['collaborating', 'working'],
  ['collaborators', 'partners'],
  ['communicating', 'sharing'],
  ['comprehension', 'grasp'],
  ['consideration', 'thought'],
  ['contributions', 'input'],
  ['significantly', 'greatly'],
  ['specifically', 'exactly'],
  ['continuously', 'steadily'],
  ['coordination', 'teamwork'],
  ['demonstrated', 'showed'],
  ['demonstrates', 'shows'],
  ['determination', 'drive'],
  ['disadvantages', 'downsides'],
  ['effectiveness', 'results'],
  ['establishment', 'creation'],
  ['exceptionally', 'very'],
  ['implementation', 'use'],
  ['increasingly', 'more and more'],
  ['independently', 'on their own'],
  ['individually', 'each person'],
  ['organizations', 'groups'],
  ['organization', 'group'],
  ['nevertheless', 'still'],
  ['individually', 'each'],
  ['particularly', 'especially'],
  ['possibilities', 'options'],
  ['practitioners', 'experts'],
  ['predominantly', 'mostly'],
  ['consistently', 'steadily'],
  ['requirements', 'needs'],
  ['relationship', 'connection'],
  ['responsibilities', 'duties'],
  ['approximately', 'about'],
  ['additionally', 'also'],
  ['consequently', 'so'],
  ['subsequently', 'then'],
  ['fundamental', 'basic'],
  ['essentially', 'basically'],
  ['potentially', 'possibly'],
  ['established', 'set up'],
  ['effectively', 'well'],
  ['efficiently', 'quickly'],
  ['challenging', 'hard'],
  ['experienced', 'skilled'],
  ['significant', 'major'],
  ['responsible', 'in charge'],
  ['immediately', 'right away'],
  ['opportunity', 'chance'],
  ['understand', 'grasp'],
  ['therefore', 'so'],
  ['successful', 'good'],
  ['committed', 'dedicated'],
  ['necessary', 'needed'],
  ['currently', 'now'],
  ['extremely', 'very'],
  ['typically', 'usually'],
  ['implement', 'use'],
];

// Perplexity boosters: common AI-predictable words → less predictable alternatives
// Applied stochastically (30% of occurrences) to raise perplexity
const PERPLEXITY_BOOSTERS: [string, string[]][] = [
  ['important', ['consequential', 'material', 'non-trivial']],
  ['effective', ['potent', 'productive', 'serviceable']],
  ['approach', ['tack', 'angle', 'method']],
  ['various', ['assorted', 'sundry', 'miscellaneous']],
  ['process', ['mechanism', 'routine', 'sequence']],
  ['provide', ['furnish', 'supply', 'yield']],
  ['require', ['call for', 'demand', 'necessitate']],
  ['develop', ['cultivate', 'forge', 'evolve']],
  ['achieve', ['attain', 'pull off', 'secure']],
  ['support', ['bolster', 'underpin', 'sustain']],
  ['improve', ['refine', 'sharpen', 'elevate']],
  ['address', ['tackle', 'confront', 'deal with']],
  ['maintain', ['uphold', 'preserve', 'sustain']],
  ['increase', ['ramp up', 'amplify', 'swell']],
  ['decrease', ['shrink', 'taper', 'dwindle']],
  ['consider', ['weigh', 'mull over', 'examine']],
  ['identify', ['pinpoint', 'spot', 'single out']],
  ['generate', ['produce', 'spawn', 'yield']],
  ['evaluate', ['gauge', 'appraise', 'assess']],
  ['benefits', ['perks', 'upsides', 'gains']],
  ['features', ['traits', 'aspects', 'qualities']],
  ['industry', ['sector', 'field', 'trade']],
  ['solution', ['fix', 'remedy', 'answer']],
  ['strategy', ['game plan', 'playbook', 'blueprint']],
  ['continue', ['keep at', 'carry on', 'persist']],
  ['emerging', ['rising', 'budding', 'up-and-coming']],
  ['relevant', ['pertinent', 'applicable', 'germane']],
  ['specific', ['particular', 'precise', 'exact']],
  ['positive', ['favorable', 'upbeat', 'encouraging']],
  ['ensuring', ['guaranteeing', 'making certain', 'seeing to it']],
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

  // Step 0: Apply perplexity boosters stochastically (30% of occurrences)
  let result = text;
  for (const [word, alternatives] of PERPLEXITY_BOOSTERS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, (matched) => {
      if (Math.random() > 0.30) return matched; // keep original 70% of the time
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      return preserveCase(matched, alt);
    });
  }

  // Step 1: Apply static offline fallback first (always runs, no network needed)
  for (const [formal, simple] of STATIC_SIMPLIFY) {
    // Skip if already handled by vocabMap
    if (vocabKeys.has(formal.toLowerCase())) continue;
    const regex = new RegExp(`\\b${formal}\\b`, 'gi');
    result = result.replace(regex, (matched) => preserveCase(matched, simple));
  }

  if (candidates.size === 0) return result;

  // Step 2: Try Datamuse API for remaining complex candidates (browser only)
  const synonyms = await batchFetch(Array.from(candidates), 5);
  for (const [original, synonym] of synonyms) {
    if (!synonym) continue;
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    result = result.replace(regex, (matched) => preserveCase(matched, synonym));
  }

  return result;
}
