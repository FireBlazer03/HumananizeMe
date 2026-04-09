import { vocabReplacements } from './vocabMap';

// ── PHASE 5: Blocklist — words that must NEVER be replaced via Datamuse ──
// These are high-risk words where even a "synonym" changes meaning or tone.

const DONT_REPLACE = new Set([
  // Technical / domain terms
  'algorithm', 'implementation', 'infrastructure', 'authentication',
  'authorization', 'configuration', 'documentation', 'optimization',
  'cryptocurrency', 'blockchain', 'artificial', 'intelligence',
  'architecture', 'distribution', 'environment', 'application',
  'information', 'communication', 'organization', 'administration',
  'automatically', 'approximately', 'particularly', 'specifically',
  'relationship', 'development', 'performance', 'experience',
  // Structural / formal words where synonyms degrade tone
  'organizations', 'strategy', 'strategies', 'framework', 'frameworks',
  'integration', 'methodology', 'structure', 'analysis',
  'management', 'assessment', 'evaluation', 'community', 'communities',
  'individual', 'individuals', 'system', 'systems',
  'component', 'components', 'platform', 'mechanism', 'mechanisms',
  'intervention', 'interventions', 'predisposition', 'stimuli',
]);

// ── PHASE 3: Protected phrases — component words must NOT be individually replaced ──

const PROTECTED_PHRASES = [
  'machine learning', 'deep learning', 'artificial intelligence',
  'change management', 'risk management', 'project management',
  'data analysis', 'user experience', 'quality assurance',
  'decision making', 'supply chain', 'mental health', 'public health',
  'climate change', 'social media', 'natural language',
  'operating system', 'best practices', 'case study', 'case studies',
  'open source', 'due diligence', 'market research',
  'human resources', 'civil rights', 'foreign policy', 'public policy',
  'regulatory landscape', 'cognitive development', 'genetic predisposition',
  'socioeconomic status', 'academic performance', 'evidence based',
  'longitudinal research', 'environmental stimuli', 'theoretical frameworks',
  'educational policy', 'student outcomes', 'processing time',
  'operational efficiency', 'governance mechanisms', 'support programs',
  'developmental processes', 'marginalized communities',
];

// Build set of words that appear inside protected phrases
function buildProtectedWords(text: string): Set<string> {
  const lower = text.toLowerCase();
  const protectedWords = new Set<string>();
  for (const phrase of PROTECTED_PHRASES) {
    if (lower.includes(phrase)) {
      for (const word of phrase.split(/\s+/)) {
        if (word.length >= 4) protectedWords.add(word);
      }
    }
  }
  return protectedWords;
}

// ── Known bad Datamuse results: specific pairs to always reject ──

const KNOWN_BAD_SYNONYMS: Record<string, Set<string>> = {
  'integration': new Set(['desegregation', 'consolidation', 'unification']),
  'implementation': new Set(['effectuation']),
  'organization': new Set(['arrangement', 'formation', 'brass']),
  'established': new Set(['accomplished', 'effected', 'constituted']),
  'demonstrated': new Set(['manifested', 'evidenced']),
  'significant': new Set(['pregnant', 'meaning']),
  'performance': new Set(['execution', 'carrying out']),
  'community': new Set(['residential district', 'biotic community']),
  'management': new Set(['direction']),
  'development': new Set(['exploitation', 'growing']),
  'experience': new Set(['know', 'get']),
  'environment': new Set(['surroundings', 'environs']),
  'challenges': new Set(['gainsay']),
  'comprehensive': new Set(['across-the-board']),
  'understanding': new Set(['reason', 'intellect', 'discernment']),
  'improvement': new Set(['melioration']),
  'traditional': new Set(['ethnic']),
  'professional': new Set(['master']),
};

// Words already handled by the static vocab map
const vocabKeys = new Set(vocabReplacements.map(([phrase]) => phrase.toLowerCase()));

// Static offline fallback: formal words → natural equivalents of equal or greater formality.
// RULES: only entries where replacement maintains tone, precision, and register.
// Entries that reduce formality, change meaning, or sound casual have been removed.
const STATIC_SIMPLIFY: [string, string][] = [
  ['acknowledgement', 'recognition'],    // equivalent formality
  ['circumstances', 'situation'],        // equivalent
  ['collaboration', 'teamwork'],         // equivalent formality
  ['collaborating', 'working together'], // natural phrasing
  ['collaborators', 'partners'],         // equivalent
  ['comprehension', 'understanding'],    // equivalent
  ['coordination', 'teamwork'],          // equivalent
  ['disadvantages', 'downsides'],        // equivalent
  ['particularly', 'especially'],        // equivalent
  ['possibilities', 'options'],          // equivalent
  ['practitioners', 'experts'],          // equivalent
  ['responsibilities', 'duties'],        // equivalent formality
  ['potentially', 'possibly'],           // equivalent
  ['typically', 'usually'],              // equivalent
];

// Perplexity boosters: applied stochastically (25%) to raise perplexity.
// RULES: ALL alternatives must maintain formal register and equal precision.
// Casual alternatives (fix, need, spot, carry on, keep going, upsides) have been removed.
const PERPLEXITY_BOOSTERS: [string, string[]][] = [
  ['approach', ['method', 'angle']],           // formal equivalents
  ['provide', ['supply', 'offer']],            // formal equivalents
  ['require', ['call for', 'demand']],         // formal; removed 'need' (casual)
  ['achieve', ['attain', 'reach']],            // formal equivalents
  ['address', ['tackle', 'confront']],         // formal; removed 'deal with' (casual)
  ['consider', ['weigh', 'examine']],          // formal equivalents
  ['identify', ['pinpoint', 'determine']],     // formal; removed 'spot' (casual)
  ['evaluate', ['gauge', 'assess']],           // formal equivalents
  ['benefits', ['advantages', 'merits']],      // formal; removed 'upsides'/'gains' (casual)
  ['industry', ['sector', 'field']],           // formal equivalents
  ['solution', ['resolution', 'remedy']],      // formal; removed 'fix'/'answer' (casual)
  // removed: ['continue', ['carry on', 'keep going']] — both alternatives too casual
  ['relevant', ['pertinent', 'applicable']],   // formal equivalents
  ['specific', ['particular', 'precise']],     // formal equivalents
];

// ── Helpers ──

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

// ── PHASE 2: Candidate Filtering + Quality Scoring ──

interface ScoredCandidate {
  word: string;
  freq: number;
  score: number;
}

function scoreCandidate(original: string, candidate: string, freq: number): number {
  let score = 0;

  // 1. Length similarity (±3 chars)
  const lenDiff = Math.abs(original.length - candidate.length);
  if (lenDiff <= 2) score += 2;      // very similar length = good
  else if (lenDiff <= 3) score += 1;  // acceptable
  else score -= 2;                    // too different = likely tone shift

  // 2. Syllable similarity (±1)
  const origSyll = countSyllables(original);
  const candSyll = countSyllables(candidate);
  if (Math.abs(origSyll - candSyll) <= 1) score += 1;
  else score -= 1;

  // 3. Frequency — common words are safer replacements
  if (freq >= 5.0) score += 2;       // very common = safe
  else if (freq >= 2.0) score += 1;  // moderately common
  else if (freq < 1.0) score -= 2;   // rare = risky

  // 4. Multi-word penalty (phrases are harder to validate contextually)
  if (candidate.includes(' ')) score -= 1;

  return score;
}

// ── Quality Gate: validates tone + precision before any replacement ──
// Returns false if the replacement would degrade tone, formality, or precision.
// Applied to ALL replacement sources: curated, static, and Datamuse.

const TONE_DEGRADING: Record<string, Set<string>> = {
  'organizations':  new Set(['groups', 'group']),
  'organization':   new Set(['groups', 'group']),
  'stakeholders':   new Set(['groups', 'group']),
  'stakeholder':    new Set(['groups', 'group']),
  'consideration':  new Set(['thought', 'thoughts']),
  'considerations': new Set(['thoughts']),
  'requirements':   new Set(['needs', 'need']),
  'requirement':    new Set(['needs', 'need']),
  'fundamental':    new Set(['basic', 'simple', 'plain']),
  'opportunity':    new Set(['chance']),
  'consequently':   new Set(['so']),
  'subsequently':   new Set(['then', 'next']),
  'approximately':  new Set(['about']),
  'additionally':   new Set(['also', 'too']),
  'essentially':    new Set(['basically']),
  'therefore':      new Set(['so']),
  'necessary':      new Set(['needed']),
  'currently':      new Set(['now']),
  'determination':  new Set(['drive', 'push']),
  'facilitate':     new Set(['help', 'aid']),
  'facilitates':    new Set(['helps', 'aids']),
  'facilitated':    new Set(['helped', 'aided']),
  'empower':        new Set(['help', 'aid', 'allow']),
  'empowering':     new Set(['helping', 'aiding']),
  'resilience':     new Set(['strength', 'toughness']),
  'resilient':      new Set(['strong', 'tough']),
  'equitable':      new Set(['fair', 'equal']),
  'disruption':     new Set(['change', 'shift']),
  'strategic':      new Set(['planned', 'calculated']),
  'navigate':       new Set(['handle', 'manage', 'deal with']),
  'navigating':     new Set(['handling', 'managing', 'dealing with']),
  'efficiently':    new Set(['quickly', 'fast', 'rapidly']),
  'increasingly':   new Set(['more and more', 'more']),
  'independently':  new Set(['on their own', 'alone', 'by themselves']),
  'predominantly':  new Set(['mostly', 'mainly']),
  'consistently':   new Set(['steadily']),  // different meaning
  'categorically':  new Set(['clearly']),   // different meaning
};

// Casual single-syllable words that must not replace formal multi-syllable words.
const CASUAL_WORDS = new Set([
  'so', 'now', 'then', 'next', 'also', 'just', 'very', 'much',
  'well', 'good', 'bad', 'big', 'try', 'use', 'show', 'help',
  'make', 'get', 'put', 'set', 'run', 'work', 'call', 'need',
]);

function isQualityReplacement(original: string, candidate: string): boolean {
  const orig = original.toLowerCase().replace(/[^a-z]/g, '');
  const repl = candidate.toLowerCase().trim();
  const replFirst = repl.split(' ')[0];

  // Gate 1: known tone-degrading pairs
  if (TONE_DEGRADING[orig]?.has(repl)) return false;

  // Gate 2: formal multi-syllable word → casual single-syllable word
  if (countSyllables(orig) >= 3 && CASUAL_WORDS.has(replFirst)) return false;

  return true;
}

// ── PHASE 1: Controlled Datamuse Fetch with All Filters ──

async function getFilteredSynonym(
  word: string,
  protectedWords: Set<string>,
): Promise<string | null> {
  const lower = word.toLowerCase();

  // Gate 1: Blocklist
  if (DONT_REPLACE.has(lower)) return null;
  if (vocabKeys.has(lower)) return null;

  // Gate 2: Protected phrase component
  if (protectedWords.has(lower)) return null;

  // Gate 3: Too short or too few syllables for safe replacement
  if (lower.length < 7 || countSyllables(lower) < 3) return null;

  // Check cache
  if (synonymCache.has(lower)) return synonymCache.get(lower) ?? null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(lower)}&md=f&max=8`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const data: Array<{ word: string; tags?: string[] }> = await res.json();

    if (!data || data.length === 0) {
      synonymCache.set(lower, null);
      return null;
    }

    // Parse frequency and build candidates
    const origSyllables = countSyllables(lower);
    const badSet = KNOWN_BAD_SYNONYMS[lower];

    const candidates: ScoredCandidate[] = data
      .map(item => {
        const fTag = item.tags?.find(t => t.startsWith('f:'));
        const freq = fTag ? parseFloat(fTag.slice(2)) : 0;
        return { word: item.word, freq, score: 0 };
      })
      .filter(c => {
        // Filter 2a: reject known bad synonyms
        if (badSet?.has(c.word)) return false;
        // Filter 2b: reject if too rare (freq < 1.5)
        if (c.freq < 1.5) return false;
        // Filter 2c: reject if syllable count differs by more than 1
        if (Math.abs(countSyllables(c.word) - origSyllables) > 1) return false;
        // Filter 2d: reject if length differs by more than 3 chars
        if (Math.abs(c.word.length - lower.length) > 3) return false;
        // Filter 2e: reject multi-word results
        if (c.word.includes(' ')) return false;
        // Filter 2f: reject if candidate is a blocked word itself
        if (DONT_REPLACE.has(c.word)) return false;
        return true;
      })
      .map(c => ({ ...c, score: scoreCandidate(lower, c.word, c.freq) }));

    // Gate 4: Only accept candidates with quality score ≥ 3
    const accepted = candidates.filter(c => c.score >= 3);

    if (accepted.length === 0) {
      synonymCache.set(lower, null);
      return null;
    }

    // Sort by score descending, then by frequency descending
    accepted.sort((a, b) => b.score - a.score || b.freq - a.freq);

    // Pick the best candidate (deterministic for consistency)
    const picked = accepted[0];

    synonymCache.set(lower, picked.word);
    return picked.word;
  } catch {
    synonymCache.set(lower, null);
    return null;
  }
}

// Process fetches in small batches
async function batchFetch(
  words: string[],
  protectedWords: Set<string>,
  concurrency: number,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  for (let i = 0; i < words.length; i += concurrency) {
    const batch = words.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async w => {
        const syn = await getFilteredSynonym(w, protectedWords);
        return { word: w, syn };
      }),
    );
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        results.set(r.value.word, r.value.syn);
      }
    }
  }
  return results;
}

// ── PHASE 4: Post-replacement adjacency check ──

function hasAdjacentDuplicate(text: string, replacement: string): boolean {
  const lower = replacement.toLowerCase();
  // Check if the replacement word would appear right next to itself
  const pattern = new RegExp(`\\b${lower}\\s+${lower}\\b`, 'i');
  return pattern.test(text);
}

// ── PHASE 3: Hybrid System — Main Export ──
// NEW Priority: curated (validated) → Datamuse (filtered) → static fallback
// ALL replacements must pass isQualityReplacement before being applied.

export async function applyDynamicSynonyms(text: string): Promise<string> {
  // Build the per-document protected word set from phrases found in this text
  const protectedWords = buildProtectedWords(text);

  // Collect Datamuse candidates from original text: 3+ syllables, 7+ chars, not protected/blocked
  const candidates: Set<string> = new Set();
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const raw = words[i].replace(/[^a-zA-Z]/g, '');
      if (!raw) continue;
      const lower = raw.toLowerCase();
      if (lower.length < 7 || countSyllables(lower) < 3) continue;
      // Skip proper nouns (capitalized, not first word)
      if (i > 0 && raw[0] === raw[0].toUpperCase() && raw[0] !== raw[0].toLowerCase()) continue;
      if (DONT_REPLACE.has(lower) || vocabKeys.has(lower) || protectedWords.has(lower)) continue;
      candidates.add(lower);
    }
  }

  // Step 1: Perplexity boosters — curated, stochastic 25%, quality-checked
  let result = text;
  for (const [word, alternatives] of PERPLEXITY_BOOSTERS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, (matched) => {
      if (Math.random() > 0.25) return matched;
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      // Quality gate: reject if replacement degrades tone or precision
      if (!isQualityReplacement(matched, alt)) return matched;
      return preserveCase(matched, alt);
    });
  }

  // Step 2: Datamuse — filtered by quality score AND quality gate, capped
  const datamused = new Set<string>(); // track which words Datamuse replaced

  if (candidates.size > 0) {
    const synonyms = await batchFetch(Array.from(candidates), protectedWords, 4);
    let replacementCount = 0;
    const MAX_DATAMUSE_REPLACEMENTS = 5;

    for (const [original, synonym] of synonyms) {
      if (!synonym) continue;
      if (replacementCount >= MAX_DATAMUSE_REPLACEMENTS) break;
      // Quality gate: reject tone-degrading Datamuse results
      if (!isQualityReplacement(original, synonym)) continue;

      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      const tentative = result.replace(regex, (matched) => preserveCase(matched, synonym));
      if (hasAdjacentDuplicate(tentative, synonym)) continue;

      result = tentative;
      datamused.add(original.toLowerCase());
      replacementCount++;
    }
  }

  // Step 3: Static fallback — only for words Datamuse did NOT replace, quality-checked
  // Also respects DONT_REPLACE blocklist (previously unguarded).
  for (const [formal, simple] of STATIC_SIMPLIFY) {
    const formalLower = formal.toLowerCase();
    if (vocabKeys.has(formalLower)) continue;       // already handled by vocabMap
    if (DONT_REPLACE.has(formalLower)) continue;    // in blocklist — never downgrade
    if (datamused.has(formalLower)) continue;        // Datamuse already found a better synonym
    // Quality gate: reject if this curated pair would degrade tone or precision
    if (!isQualityReplacement(formal, simple)) continue;
    const regex = new RegExp(`\\b${formal}\\b`, 'gi');
    result = result.replace(regex, (matched) => preserveCase(matched, simple));
  }

  return result;
}
