import { preserveCase, splitSentences, isListDominatedText } from './humanizer-helpers';
import { rng, rngPick } from './rng';

// --- Pass: Remove Preambles ---

const PREAMBLE_PATTERNS: RegExp[] = [
  /^It is important to note that\s+/gim,
  /^It is worth noting that\s+/gim,
  /^It should be mentioned that\s+/gim,
  /^It is clear that\s+/gim,
  /^It is evident that\s+/gim,
  /^One must consider that\s+/gim,
  /^We can see that\s+/gim,
  /^In terms of this,\s*/gim,
  /^With regard to this,\s*/gim,
  /^In light of the above,\s*/gim,
  /^As previously mentioned,\s*/gim,
  /^As noted above,\s*/gim,
  /^At its core,\s*/gim,
  /^At the end of the day,\s*/gim,
  /^Needless to say,\s*/gim,
];

export function removePreambles(text: string): string {
  let result = text;
  for (const pattern of PREAMBLE_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, 'gim'), '');
  }
  result = result.replace(/\.\s+([a-z])/g, (_m, c) => '. ' + c.toUpperCase());
  result = result.replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase());
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass: Morphology Correction ---

const NOUN_STACK_PATTERNS: [RegExp, string][] = [
  [/\bthe implementation of\b/gi, 'implementing'],
  [/\bthe optimization of\b/gi, 'optimizing'],
  [/\bthe development of\b/gi, 'developing'],
  [/\bthe creation of\b/gi, 'creating'],
  [/\bthe establishment of\b/gi, 'establishing'],
  [/\bthe utilization of\b/gi, 'using'],
  [/\bthe achievement of\b/gi, 'achieving'],
  [/\bthe enhancement of\b/gi, 'improving'],
  [/\bthe reduction of\b/gi, 'reducing'],
  [/\bthe improvement of\b/gi, 'improving'],
  [/\bthe elimination of\b/gi, 'removing'],
  [/\bthe introduction of\b/gi, 'introducing'],
  [/\bthe application of\b/gi, 'applying'],
  [/\bthe integration of\b/gi, 'integrating'],
  [/\bthe adoption of\b/gi, 'adopting'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bwith respect to\b/gi, 'about'],
  [/\bin the context of\b/gi, 'in'],
];

export function morphologyCorrection(text: string): string {
  let result = text;
  for (const [pattern, replacement] of NOUN_STACK_PATTERNS) {
    result = result.replace(pattern, (match) => preserveCase(match, replacement));
  }
  result = result.replace(
    /\bin terms of\s+([a-zA-Z][a-zA-Z\s]{0,30}?)([,;.!?]|\s+(?:and|but|or|which|that|when|if)\b)/gi,
    (_m, noun, trailing) => `for ${noun}${trailing}`
  );
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass: N-gram Entropy Diversification ---

// Only entries whose alternatives are TRUE paraphrases preserving preposition semantics.
// Removed: 'of the' (possession ≠ 'within'/'from'), 'to the' (destination ≠ 'toward'/'into'),
//          'there is'/'there are' (existential swap loses the "find" framing).
const BIGRAM_ALTERNATIVES: Record<string, string[]> = {
  'in the': ['inside the', 'within the'],
  'on the': ['upon the'],
};

export function diversifyNgrams(text: string): string {
  let result = text;
  const bigramCount: Record<string, number> = {};

  for (const [bigram, alts] of Object.entries(BIGRAM_ALTERNATIVES)) {
    const regex = new RegExp(`\\b${bigram}\\b`, 'gi');
    bigramCount[bigram] = 0;
    result = result.replace(regex, (matched) => {
      bigramCount[bigram]++;
      if (bigramCount[bigram] <= 1) return matched;
      if (rng() > 0.50) return matched;
      const alt = rngPick(alts);
      return preserveCase(matched, alt);
    });
  }

  return result;
}

// --- Pass: Sentence Starter Diversity ---

const ARTICLE_OPENER_TRANSFORMS: Array<{ pattern: RegExp; replacements: string[] }> = [
  { pattern: /^The (\w+)/, replacements: ['That $1', 'A $1', 'One $1', 'Each $1'] },
  { pattern: /^This (\w+)/, replacements: ['That $1', 'Such a $1', 'One $1'] },
  { pattern: /^These (\w+)/, replacements: ['Such $1', 'Those $1', 'Many $1'] },
  { pattern: /^It is /, replacements: ['What matters is ', 'The point is ', 'The fact is '] },
  { pattern: /^There is /, replacements: ['One finds ', 'You see ', 'We see '] },
  { pattern: /^There are /, replacements: ['You find ', 'We see ', 'One finds '] },
];

export function diversifySentenceStarters(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return text;

  const starterFreq: Record<string, number[]> = {};
  for (let i = 0; i < sentences.length; i++) {
    const words = sentences[i].trim().split(/\s+/);
    if (words.length < 2) continue;
    const starter = words[0].toLowerCase();
    if (!starterFreq[starter]) starterFreq[starter] = [];
    starterFreq[starter].push(i);
  }

  for (const [, indices] of Object.entries(starterFreq)) {
    if (indices.length < 3) continue;
    for (let k = 1; k < indices.length; k++) {
      if (rng() > 0.6) continue;
      const idx = indices[k];
      const trimmed = sentences[idx].trim();
      for (const { pattern, replacements } of ARTICLE_OPENER_TRANSFORMS) {
        if (pattern.test(trimmed)) {
          const rep = rngPick(replacements);
          const transformed = trimmed.replace(pattern, rep);
          sentences[idx] = sentences[idx].replace(trimmed, transformed);
          break;
        }
      }
    }
  }

  for (let i = 1; i < sentences.length - 1; i++) {
    const prev = sentences[i - 1].trim().split(/\s+/)[0]?.toLowerCase();
    const curr = sentences[i].trim().split(/\s+/)[0]?.toLowerCase();
    const next = sentences[i + 1]?.trim().split(/\s+/)[0]?.toLowerCase();
    if (prev === curr && curr === next) {
      const trimmed = sentences[i].trim();
      const transitions = ['Meanwhile, ', 'At the same time, ', 'On a related note, ', 'Along those lines, '];
      const trans = rngPick(transitions);
      const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
      sentences[i] = sentences[i].replace(trimmed, trans + lowered);
    }
  }

  return sentences.join('');
}

// --- Pass: Punctuation Pattern Diversity ---

export function diversifyPunctuation(text: string): string {
  let result = text;

  result = result.replace(/,\s+and\s+/g, (matched) => {
    if (rng() > 0.10) return matched;
    return '; ';
  });

  const sentences = splitSentences(result);
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = sentences[i].trim();
    const b = sentences[i + 1]?.trim();
    if (!a || !b) continue;
    const aLen = a.split(/\s+/).length;
    const bLen = b.split(/\s+/).length;
    if (aLen < 12 && bLen < 12 && aLen > 4 && bLen > 4 && rng() < 0.08) {
      const aTrimmed = a.replace(/[.!?]\s*$/, '');
      const bLowered = b.charAt(0).toLowerCase() + b.slice(1);
      sentences[i] = aTrimmed + ': ';
      sentences[i + 1] = bLowered;
    }
  }
  result = sentences.join('');

  // Rule-of-three reshape: only fire when items look like filler (short nouns) so we
  // don't drop a load-bearing third item like "cost" in "safety, speed, and cost".
  const KNOWN_FILLER = new Set([
    'innovation', 'efficiency', 'excellence', 'quality', 'performance',
    'growth', 'value', 'scale', 'impact', 'success', 'synergy',
  ]);
  result = result.replace(/\b(\w+),\s+(\w+),\s+and\s+(\w+)\b/g, (matched, a, b, c) => {
    if (rng() > 0.05) return matched;
    if (!KNOWN_FILLER.has(a.toLowerCase()) || !KNOWN_FILLER.has(b.toLowerCase()) || !KNOWN_FILLER.has(c.toLowerCase())) {
      return matched;
    }
    return `${a} and ${b} (along with ${c})`;
  });

  return result;
}

// --- Pass: Perplexity Injection ---

const INFORMAL_CONNECTIVES = [
  'Honestly, ', 'In practice, ', 'The thing is, ', 'That said, ',
  'At the same time, ', 'To be fair, ', 'In reality, ', 'Worth noting, ',
];

const PARENTHETICALS = [
  '(at least in most cases)', '(or something close to it)',
  '(depending on the situation)', '(which is worth keeping in mind)',
  '(and this matters more than it seems)', '(though not always)',
];

export function perplexityInjection(text: string, isProfessional = false): string {
  if (isProfessional) return text;
  const sentences = splitSentences(text);
  if (sentences.length < 3) return text;

  return sentences.map((s, idx) => {
    if (idx === 0) return s;
    const trimmed = s.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) return s;
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 8) return s;
    if (/\(/.test(trimmed)) return s;
    if (rng() > 0.15) return s;

    const type = rng();

    if (type < 0.40) {
      const adverbials: Array<{ pattern: RegExp; fn: (m: RegExpMatchArray) => string }> = [
        { pattern: /^(.+?)\s+because\s+(.+\.)$/, fn: (m) => `Because ${m[2].replace(/\.$/, '')}, ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}.` },
        { pattern: /^(.+?)\s+since\s+(.+\.)$/, fn: (m) => `Since ${m[2].replace(/\.$/, '')}, ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}.` },
        { pattern: /^(.+?)\s+although\s+(.+\.)$/, fn: (m) => `Although ${m[2].replace(/\.$/, '')}, ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}.` },
        { pattern: /^(.+?)\s+when\s+(.+\.)$/, fn: (m) => `When ${m[2].replace(/\.$/, '')}, ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}.` },
      ];
      for (const { pattern, fn } of adverbials) {
        const match = trimmed.match(pattern);
        if (match && match[1].split(/\s+/).length > 4 && match[2].split(/\s+/).length > 4) {
          return s.replace(trimmed, fn(match));
        }
      }
      return s;
    } else if (type < 0.70) {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx > 10 && commaIdx < trimmed.length - 20) {
        const aside = rngPick(PARENTHETICALS);
        const before = trimmed.slice(0, commaIdx + 1);
        const after = trimmed.slice(commaIdx + 1);
        return s.replace(trimmed, before + ' ' + aside + after);
      }
      return s;
    } else {
      if (!/^(However|But|And|Or|So|Yet|Also|Still|Even|Just|Honestly|In practice|The thing)\b/.test(trimmed)) {
        const connective = rngPick(INFORMAL_CONNECTIVES);
        const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
        return s.replace(trimmed, connective + lowered);
      }
      return s;
    }
  }).join('');
}

// --- Pass: Semantic Non-linearity ---
//
// Formerly also injected invented "contrast sentences" (e.g. "Then again, not everyone
// sees it that way.") — that branch has been REMOVED because it fabricates content
// that was not in the input and thus changes meaning. The sentence-swap branch is
// preserved but is wrapped by the SafetyGuard (policy.mayReorder=true), which runs
// the anaphora check to reject swaps that would orphan a pronoun reference.
export function semanticNonLinearity(text: string, isProfessional = false): string {
  if (isProfessional) return text;
  const paragraphs = text.split(/\n\n+/);

  const processed = paragraphs.map(para => {
    if (para.trim().startsWith('#') || para.trim().startsWith('```')) return para;
    if (isListDominatedText(para)) return para;

    const sentences = splitSentences(para);
    if (sentences.length < 4) return para;

    if (rng() < 0.20) {
      const s1 = sentences[1]?.trim() || '';
      const s2 = sentences[2]?.trim() || '';
      // Extra guard: don't swap if the second sentence opens with a pronoun — its
      // antecedent must stay adjacent.
      const s2First = s2.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
      const PRONOUNS = new Set(['it', 'he', 'she', 'they', 'this', 'that', 'these', 'those', 'its', 'their']);
      if (s2First && PRONOUNS.has(s2First)) return para;
      if (s1 && s2 && !s1.endsWith('?') && !s2.endsWith('?')) {
        const swapped = [...sentences];
        swapped[1] = sentences[2];
        swapped[2] = sentences[1];
        return swapped.join('').trim();
      }
    }

    return para;
  });

  return processed.join('\n\n');
}

// --- Pass: Break Long Sentences ---

export function breakLongSentences(text: string): string {
  const sentences = splitSentences(text);
  return sentences.map(sentence => {
    const words = sentence.trim().split(/\s+/);
    if (words.length < 15) return sentence;

    // Do NOT split on causal/conditional connectives — that silently drops the
    // logical link between the two clauses. Only split on true coordinators.
    const conjPattern = /,\s+(and|but|so|yet|while|although)\s+/i;
    let match = conjPattern.exec(sentence);
    if (match && match.index !== undefined) {
      const before = sentence.slice(0, match.index);
      const after = sentence.slice(match.index + match[0].length);
      if (before.split(/\s+/).length > 6) {
        const first = before.trim().replace(/[,;]\s*$/, '') + '.';
        const second = after.trim();
        return first + ' ' + second.charAt(0).toUpperCase() + second.slice(1);
      }
    }

    const relPattern = /\s+(which|who|where)\s+/i;
    match = relPattern.exec(sentence);
    if (match && match.index !== undefined && words.length >= 18) {
      const before = sentence.slice(0, match.index);
      const pronoun = match[1].toLowerCase();
      const after = sentence.slice(match.index + match[0].length);
      if (before.split(/\s+/).length > 6 && after.split(/\s+/).length > 4) {
        const first = before.trim() + '.';
        const subst = pronoun === 'who' ? 'They' : pronoun === 'where' ? 'There' : 'It';
        return first + ' ' + subst + ' ' + after.trim();
      }
    }

    const semiIdx = sentence.indexOf(';');
    if (semiIdx > 0) {
      const before = sentence.slice(0, semiIdx).trim();
      const after = sentence.slice(semiIdx + 1).trim();
      if (before.split(/\s+/).length > 4 && after.split(/\s+/).length > 4) {
        return before + '. ' + after.charAt(0).toUpperCase() + after.slice(1);
      }
    }

    return sentence;
  }).join(' ');
}

// --- Pass: Merge Short Sentences ---
//
// Only merges sentences that share a content-word lemma, preventing two unrelated
// topics from being conjoined with ", and ".

function contentLemmas(sentence: string): Set<string> {
  const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'and', 'or', 'but',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
    'this', 'that', 'these', 'those', 'it', 'its', 'for', 'with', 'from', 'as',
    'will', 'would', 'can', 'could', 'may', 'might', 'must', 'should', 'do',
    'does', 'did', 'not', 'no']);
  const tokens = sentence.toLowerCase().match(/[a-z]+/g) || [];
  const out = new Set<string>();
  for (const t of tokens) {
    if (STOP.has(t) || t.length < 4) continue;
    // Basic lemma: strip common suffixes.
    let lemma = t.replace(/(ing|ed|es|s)$/, '');
    if (lemma.length < 3) lemma = t;
    out.add(lemma);
  }
  return out;
}

function sharesContentWord(a: string, b: string): boolean {
  const aLem = contentLemmas(a);
  const bLem = contentLemmas(b);
  for (const l of aLem) if (bLem.has(l)) return true;
  return false;
}

export function mergeShortSentences(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return text;

  const result: string[] = [];
  let i = 0;

  while (i < sentences.length) {
    const cur = sentences[i].trim();
    const curWords = cur.split(/\s+/).length;
    const next = sentences[i + 1]?.trim();
    const nextWords = next ? next.split(/\s+/).length : 99;

    if (
      curWords < 10 && curWords > 2 &&
      nextWords < 10 && nextWords > 2 &&
      next && !cur.startsWith('#') && !next.startsWith('#') &&
      sharesContentWord(cur, next) &&
      rng() < 0.4
    ) {
      const merged = cur.replace(/[.!?]\s*$/, '') + ', and ' +
        next.charAt(0).toLowerCase() + next.slice(1);
      result.push(merged + ' ');
      i += 2;
    } else {
      result.push(sentences[i]);
      i++;
    }
  }
  return result.join('');
}

// --- Pass: Vary Sentence Openers ---

const OPENER_TRANSFORMS: Array<[RegExp, string]> = [
  [/^(.+)\s+when\s+(.+)\.$/, 'When $2, $1.'],
  [/^(.+)\s+if\s+(.+)\.$/, 'If $2, $1.'],
  [/^(.+)\s+because\s+(.+)\.$/, 'Because $2, $1.'],
  [/^(.+)\s+although\s+(.+)\.$/, 'Although $2, $1.'],
  [/^(.+)\s+after\s+(.+)\.$/, 'After $2, $1.'],
  [/^(.+)\s+before\s+(.+)\.$/, 'Before $2, $1.'],
  [/^(.+)\s+since\s+(.+)\.$/, 'Since $2, $1.'],
  [/^(.+)\s+while\s+(.+)\.$/, 'While $2, $1.'],
];

export function varyOpeners(text: string): string {
  const sentences = splitSentences(text);
  return sentences.map((s, i) => {
    if (i % 3 !== 0) return s;
    const trimmed = s.trim();
    // Skip if the sentence contains a negation or a number — fronting a subordinate
    // clause can shift emphasis in claims with hard figures or negated predicates.
    if (/\b(not|never|no|cannot|n't|without|hardly|rarely)\b/i.test(trimmed)) return s;
    if (/\d/.test(trimmed)) return s;
    for (const [pattern, replacement] of OPENER_TRANSFORMS) {
      if (pattern.test(trimmed)) {
        return trimmed.replace(pattern, replacement) + ' ';
      }
    }
    return s;
  }).join('');
}
