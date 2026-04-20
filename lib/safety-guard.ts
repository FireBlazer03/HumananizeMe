// SafetyGuard — meaning-preservation layer for the humanizer pipeline.
//
// Three responsibilities:
//   1. extractInvariants — capture facts from the ORIGINAL text that must not change.
//   2. maskProtected / unmaskProtected — replace invariants with TYPED sentinels so
//      downstream passes can't touch them. Sentinels carry grammatical metadata
//      (plurality, proper-noun flag) so agreement is preserved on unmask.
//   3. validatePass — per-pass gate that reverts any mutation violating invariants.
//
// Applied in lib/humanizer.ts around the main pass loop.

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface Invariants {
  numbers: string[];
  urls: string[];
  code: string[];
  quotes: string[];
  entities: string[];
  negationCount: number;
  polarityVerbs: Set<string>;
  quantifierCount: Record<string, number>;
  connectives: Set<string>;
  antecedents: Map<string, number>; // proper noun → first sentence index where it appears
  wordCount: number;
}

export interface SentinelInfo {
  text: string;
  type: 'NUM' | 'ENTITY' | 'URL' | 'CODE' | 'QUOTE';
  isPlural: boolean;
  isProperNoun: boolean;
}

export type RestoreMap = Map<string, SentinelInfo>;

export interface PassPolicy {
  mayReorder?: boolean;
  mayInsertSentence?: boolean;
  maySplitSentence?: boolean;
  mayMergeSentence?: boolean;
}

export interface Verdict {
  ok: boolean;
  reason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Lexical sets
// ──────────────────────────────────────────────────────────────────────────────

const NEGATION_WORDS = [
  "\\bnot\\b", "\\bnever\\b", "\\bno\\b", "\\bnone\\b", "\\bcannot\\b",
  "\\bn't\\b", "\\bwithout\\b", "\\bneither\\b", "\\bnor\\b",
  "\\brarely\\b", "\\bhardly\\b", "\\bscarcely\\b", "\\bbarely\\b",
];
const NEGATION_RE = new RegExp(NEGATION_WORDS.join("|"), "gi");

// Verbs that encode negation/limitation without containing "not".
// Stems/lemmas — matched with word-boundary + optional suffix.
const POLARITY_LEMMAS = [
  'refus', 'fail', 'lack', 'prevent', 'deny', 'prohibit', 'decline',
  'reject', 'avoid', 'ceas', 'stop', 'neglect', 'omit', 'forbid',
  'block', 'ban', 'disallow', 'forbade', 'forbidden',
];

const QUANTIFIER_WORDS = ['only', 'all', 'every', 'most', 'least', 'some', 'few', 'many', 'any', 'each'];

const CONNECTIVE_WORDS = ['because', 'since', 'although', 'unless', 'if', 'until', 'when', 'so', 'therefore', 'however', 'though', 'whereas', 'while'];

const PRONOUN_OPENERS = new Set(['it', 'he', 'she', 'they', 'this', 'that', 'these', 'those', 'its', 'their', 'his', 'her']);

// Very small English stopword set for cosine bag-of-words.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'as', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'you',
  'he', 'she', 'we', 'they', 'them', 'his', 'her', 'their', 'our',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can',
  'could', 'may', 'might', 'must', 'should', 'shall',
]);

// ──────────────────────────────────────────────────────────────────────────────
// Regexes for invariant extraction
// ──────────────────────────────────────────────────────────────────────────────

// URLs / emails / handles / hashtags
const URL_RE = /(https?:\/\/[^\s)\]]+|[\w.+-]+@[\w.-]+\.\w+|@\w+|#\w+)/g;
// Fenced code blocks and inline backtick spans
const FENCED_CODE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
// "double-quoted" spans — use non-greedy to prevent spanning multiple quotes
const DQUOTE_RE = /"[^"\n]+"/g;
// Numbers: currency, percent, counts with commas, decimals, years
const NUMBER_RE = /(\$\s?\d[\d,]*(?:\.\d+)?(?:[KMB])?|\d[\d,]*(?:\.\d+)?%|\d[\d,]*(?:\.\d+)?)/g;
// Proper noun runs: 1-3 consecutive Capitalized words (excluding sentence-initial single word)
const CAP_RUN_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
// All-caps acronyms (2-5 letters)
const ACRONYM_RE = /\b[A-Z]{2,5}\b/g;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function splitSentences(text: string): string[] {
  const parts: string[] = [];
  const re = /[^.!?]+[.!?]+\s*/g;
  let match: RegExpExecArray | null;
  let lastIdx = 0;
  while ((match = re.exec(text)) !== null) {
    parts.push(match[0]);
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

function isPluralToken(text: string): boolean {
  // Heuristic: ends with s/es but not "ss", "us", "is".
  const w = text.toLowerCase().trim().replace(/[^\w]/g, '');
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return false;
  return w.endsWith('s') || w.endsWith('es');
}

function extractPolarityLemmas(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const stem of POLARITY_LEMMAS) {
    // match stem followed by common inflection suffixes
    const re = new RegExp(`\\b${stem}(?:e|es|ed|ing|s)?\\b`, 'i');
    if (re.test(lower)) found.add(stem);
  }
  return found;
}

function extractQuantifierCounts(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const result: Record<string, number> = {};
  for (const q of QUANTIFIER_WORDS) {
    const re = new RegExp(`\\b${q}\\b`, 'g');
    result[q] = (lower.match(re) || []).length;
  }
  return result;
}

function extractConnectives(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const c of CONNECTIVE_WORDS) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(lower)) found.add(c);
  }
  return found;
}

function bagOfWords(text: string): Map<string, number> {
  const bag = new Map<string, number>();
  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2) continue;
    bag.set(t, (bag.get(t) || 0) + 1);
  }
  return bag;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  for (const [k, v] of a) {
    const vb = b.get(k);
    if (vb) dot += v * vb;
  }
  if (na === 0 || nb === 0) return 1; // both empty / one empty - treat as identical
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function adaptiveCosineThreshold(wordCount: number): number {
  // Per-pass thresholds. Each pass should make small deltas, so thresholds are tight.
  if (wordCount < 30) return 0.65;
  if (wordCount < 100) return 0.75;
  return 0.82;
}

// ──────────────────────────────────────────────────────────────────────────────
// extractInvariants
// ──────────────────────────────────────────────────────────────────────────────

export function extractInvariants(text: string): Invariants {
  const numbers = text.match(NUMBER_RE) || [];
  const urls = text.match(URL_RE) || [];
  const code = [
    ...(text.match(FENCED_CODE_RE) || []),
    ...(text.match(INLINE_CODE_RE) || []),
  ];
  const quotes = text.match(DQUOTE_RE) || [];

  // Entities: acronyms + capitalized runs (skipping sentence-initial singletons)
  const entitySet = new Set<string>();
  for (const m of text.match(ACRONYM_RE) || []) entitySet.add(m);
  // Capitalized runs — skip when the run is a single capitalized word that starts a sentence
  const sentences = splitSentences(text);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    // Strip the first word if it's a lone capitalized word (likely sentence start)
    const rest = trimmed.replace(/^[A-Z][a-z]+\s/, '');
    const runs = rest.match(CAP_RUN_RE) || [];
    for (const run of runs) entitySet.add(run);
    // Also catch multi-word runs at the start (e.g., "The United Nations")
    const multiAtStart = trimmed.match(/^[A-Z][a-z]+\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (multiAtStart) entitySet.add(multiAtStart[1]);
  }

  // Antecedents: map proper noun → first sentence index where it appears
  const antecedents = new Map<string, number>();
  for (let i = 0; i < sentences.length; i++) {
    const sLower = sentences[i].toLowerCase();
    for (const entity of entitySet) {
      const eLower = entity.toLowerCase();
      if (sLower.includes(eLower) && !antecedents.has(eLower)) {
        antecedents.set(eLower, i);
      }
    }
  }

  return {
    numbers,
    urls,
    code,
    quotes,
    entities: Array.from(entitySet),
    negationCount: countMatches(text, NEGATION_RE),
    polarityVerbs: extractPolarityLemmas(text),
    quantifierCount: extractQuantifierCounts(text),
    connectives: extractConnectives(text),
    antecedents,
    wordCount: (text.match(/\S+/g) || []).length,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Masking / Unmasking
// ──────────────────────────────────────────────────────────────────────────────

export function maskProtected(text: string, _invariants: Invariants): { masked: string; restoreMap: RestoreMap } {
  const restoreMap: RestoreMap = new Map();
  let counter = 0;

  // Single-pass tokenizer. Priority is encoded by the order of the candidate
  // list; for every offset we consume the FIRST matching pattern so a quoted
  // span like `"... 40% ..."` is masked as one QUOTE rather than shredded into
  // NUMs. Running a single pass (instead of N regex replacements in sequence)
  // also prevents later patterns from matching digits / capitals that sit
  // INSIDE a sentinel from an earlier step (which previously produced garbage
  // like `__QUOTE___NUM_3____`).
  const candidates: Array<{ type: SentinelInfo['type']; re: RegExp; isProperNoun?: boolean }> = [
    { type: 'CODE',   re: /```[\s\S]*?```/y },
    { type: 'CODE',   re: /`[^`\n]+`/y },
    { type: 'URL',    re: /(?:https?:\/\/[^\s)\]]+|[\w.+-]+@[\w.-]+\.\w+|@\w+|#\w+)/y },
    { type: 'QUOTE',  re: /"[^"\n]+"/y },
    { type: 'NUM',    re: /(?:\$\s?\d[\d,]*(?:\.\d+)?(?:[KMB])?|\d[\d,]*(?:\.\d+)?%|\d[\d,]*(?:\.\d+)?)/y },
    { type: 'ENTITY', re: /[A-Z]{2,5}\b/y, isProperNoun: true },
    { type: 'ENTITY', re: /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/y, isProperNoun: true },
  ];

  let masked = '';
  let i = 0;
  while (i < text.length) {
    let matched: { type: SentinelInfo['type']; text: string; isProperNoun: boolean } | null = null;
    for (const c of candidates) {
      c.re.lastIndex = i;
      const m = c.re.exec(text);
      if (m && m.index === i) {
        matched = { type: c.type, text: m[0], isProperNoun: !!c.isProperNoun };
        break;
      }
    }
    if (matched) {
      const id = `__${matched.type}_${counter++}__`;
      const info: SentinelInfo = {
        text: matched.text,
        type: matched.type,
        isPlural: matched.type === 'NUM' ? /\d+s$/.test(matched.text) : isPluralToken(matched.text),
        isProperNoun: matched.isProperNoun,
      };
      restoreMap.set(id, info);
      masked += id;
      i += matched.text.length;
    } else {
      masked += text[i];
      i++;
    }
  }

  return { masked, restoreMap };
}

export function unmaskProtected(text: string, restoreMap: RestoreMap): string {
  let result = text;
  // Replace sentinels with their original text. Iterate in insertion order.
  for (const [sentinel, info] of restoreMap) {
    // Sentinels are safe literals; use split/join for reliability.
    result = result.split(sentinel).join(info.text);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// validatePass
// ──────────────────────────────────────────────────────────────────────────────

function countSentinels(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /__(NUM|ENTITY|URL|CODE|QUOTE)_\d+__/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  }
  return counts;
}

function sentinelSetsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function connectivesPreserved(before: string, after: string): boolean {
  const beforeSet = extractConnectives(before);
  const afterSet = extractConnectives(after);
  // Required: if `because` or `since` appeared before, at least one causal-family word must remain.
  const causalFamily = ['because', 'since', 'so', 'therefore', 'as', 'thus'];
  const conditionalFamily = ['if', 'unless', 'until', 'when'];
  const contrastFamily = ['although', 'though', 'however', 'whereas', 'but'];

  const hadCausal = causalFamily.some(w => beforeSet.has(w));
  const hasCausal = causalFamily.some(w => afterSet.has(w)) || /\b(because|since|as|so|therefore|thus|hence)\b/i.test(after);
  if (hadCausal && !hasCausal) return false;

  const hadConditional = conditionalFamily.some(w => beforeSet.has(w));
  const hasConditional = conditionalFamily.some(w => afterSet.has(w)) || /\b(if|unless|until|when|whenever)\b/i.test(after);
  if (hadConditional && !hasConditional) return false;

  const hadContrast = contrastFamily.some(w => beforeSet.has(w));
  const hasContrast = contrastFamily.some(w => afterSet.has(w)) || /\b(although|though|however|whereas|but|yet)\b/i.test(after);
  if (hadContrast && !hasContrast) return false;

  return true;
}

function checkAnaphora(text: string, invariants: Invariants): Verdict {
  const sentences = splitSentences(text);
  for (let i = 1; i < sentences.length; i++) {
    const curr = sentences[i].trim();
    const firstWord = curr.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
    if (!firstWord || !PRONOUN_OPENERS.has(firstWord)) continue;
    // Pronoun opener — check that prev sentence contains at least one known entity.
    const prevLower = (sentences[i - 1] || '').toLowerCase();
    let anchored = false;
    for (const ent of invariants.entities) {
      if (prevLower.includes(ent.toLowerCase())) { anchored = true; break; }
    }
    // Also accept if prev sentence contains any sentinel (masked entity).
    if (!anchored && /__(ENTITY|NUM|URL)_\d+__/.test(prevLower)) anchored = true;
    // Also accept if prev sentence contains a clear noun phrase (capital word or common noun heuristic).
    if (!anchored) {
      // Fallback: if prev sentence has 4+ words, assume there's a plausible antecedent.
      const prevWords = (sentences[i - 1] || '').trim().split(/\s+/).filter(Boolean);
      if (prevWords.length >= 4) anchored = true;
    }
    if (!anchored) {
      return { ok: false, reason: `anaphora: '${firstWord}' at sentence ${i} has no antecedent in prior sentence` };
    }
  }
  return { ok: true };
}

export function validatePass(
  before: string,
  after: string,
  invariants: Invariants,
  policy: PassPolicy = {},
): Verdict {
  // 1. Sentinel parity — every masked invariant must survive
  const beforeSentinels = countSentinels(before);
  const afterSentinels = countSentinels(after);
  if (!sentinelSetsEqual(beforeSentinels, afterSentinels)) {
    return { ok: false, reason: 'invariant sentinel lost or duplicated' };
  }

  // 2. Negation parity
  const negBefore = countMatches(before, NEGATION_RE);
  const negAfter = countMatches(after, NEGATION_RE);
  if (negBefore !== negAfter) {
    return { ok: false, reason: `negation count changed (${negBefore} → ${negAfter})` };
  }

  // 3. Polarity-verb parity (set equality)
  const polBefore = extractPolarityLemmas(before);
  const polAfter = extractPolarityLemmas(after);
  if (polBefore.size !== polAfter.size) {
    return { ok: false, reason: 'polarity verb set size changed' };
  }
  for (const p of polBefore) {
    if (!polAfter.has(p)) return { ok: false, reason: `polarity verb '${p}' lost/swapped` };
  }

  // 4. Quantifier parity
  const qBefore = extractQuantifierCounts(before);
  const qAfter = extractQuantifierCounts(after);
  for (const q of QUANTIFIER_WORDS) {
    // Allow +0 or -1 drift on 'some' / 'any' since they're weaker claims.
    const drift = (q === 'some' || q === 'any' || q === 'many') ? 1 : 0;
    if (Math.abs((qBefore[q] || 0) - (qAfter[q] || 0)) > drift) {
      return { ok: false, reason: `quantifier '${q}' count changed` };
    }
  }

  // 5. Connective preservation
  if (!connectivesPreserved(before, after)) {
    return { ok: false, reason: 'causal/conditional/contrast connective lost' };
  }

  // 6. Sentence-count delta within policy
  const sBefore = splitSentences(before).filter(s => s.trim()).length;
  const sAfter = splitSentences(after).filter(s => s.trim()).length;
  const splitAllowance = policy.maySplitSentence ? Math.max(3, Math.ceil(sBefore * 0.3)) : 0;
  const mergeAllowance = policy.mayMergeSentence ? Math.max(3, Math.ceil(sBefore * 0.3)) : 0;
  if (sAfter > sBefore + splitAllowance) {
    return { ok: false, reason: `sentence count grew (${sBefore} → ${sAfter}), mayInsertSentence=${!!policy.mayInsertSentence}` };
  }
  if (sAfter < sBefore - mergeAllowance) {
    return { ok: false, reason: `sentence count shrank (${sBefore} → ${sAfter})` };
  }
  if (!policy.mayInsertSentence && sAfter > sBefore + splitAllowance) {
    return { ok: false, reason: 'sentence inserted without mayInsertSentence' };
  }

  // 7. Adaptive cosine (bag-of-content-words)
  const bagBefore = bagOfWords(before);
  const bagAfter = bagOfWords(after);
  const cos = cosineSimilarity(bagBefore, bagAfter);
  const wordCount = (before.match(/\S+/g) || []).length;
  const threshold = adaptiveCosineThreshold(wordCount);
  if (cos < threshold) {
    return { ok: false, reason: `cosine ${cos.toFixed(2)} < threshold ${threshold} (wordCount=${wordCount})` };
  }

  // 8. Anaphora proximity — only when the pass may reorder
  if (policy.mayReorder) {
    const v = checkAnaphora(after, invariants);
    if (!v.ok) return v;
  }

  return { ok: true };
}
