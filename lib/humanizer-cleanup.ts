import { BurstinessMode } from '@/types';
import { vocabReplacements } from './vocabMap';
import { preserveCase, escapeRegex, isListDominatedText, splitSentences, CHATBOT_PHRASE_PATTERNS } from './humanizer-helpers';
import { rng, rngPick } from './rng';

// --- Pass 1: Remove Chatbot Artifacts ---

export function removeChatbotArtifacts(text: string): string {
  let result = text;
  for (const pattern of CHATBOT_PHRASE_PATTERNS) {
    result = result.replace(pattern, '');
  }
  result = result.replace(/ {2,}/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n');
  return result.trim();
}

// --- Pass 2: AI Vocabulary Replacement ---

export function replaceAIVocab(text: string): string {
  let result = text;
  for (const [phrase, replacement] of vocabReplacements) {
    const escaped = escapeRegex(phrase);
    // Use word boundaries and case-insensitive flag
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      if (replacement === '') return '';
      return preserveCase(match, replacement);
    });
  }
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass 3: Fix Formatting ---

export function fixFormatting(text: string): string {
  let result = text;

  // Remove emoji characters
  result = result.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');

  // Replace curly/smart quotes with straight quotes
  result = result.replace(/[\u201C\u201D]/g, '"');
  result = result.replace(/[\u2018\u2019]/g, "'");

  // Convert heading title case to sentence case
  result = result.replace(/^(#{1,6}\s+)(.+)$/gm, (_match, hashes: string, content: string) => {
    const words = content.split(' ');
    const converted = words.map((word, i) => {
      if (i === 0) return word;
      if (word === word.toUpperCase() && word.length <= 4) return word; // likely acronym
      return word.toLowerCase();
    });
    return hashes + converted.join(' ');
  });

  // Remove excessive boldface in prose paragraphs (keep at most 1 bold per paragraph)
  const paragraphs = result.split('\n\n');
  result = paragraphs.map(para => {
    if (para.trim().startsWith('#') || para.trim().startsWith('-') || para.trim().startsWith('*') || /^\d+\./.test(para.trim())) {
      return para;
    }
    const boldMatches = para.match(/\*\*[^*]+\*\*/g);
    if (boldMatches && boldMatches.length > 1) {
      let first = true;
      return para.replace(/\*\*([^*]+)\*\*/g, (_m, inner) => {
        if (first) { first = false; return `**${inner}**`; }
        return inner;
      });
    }
    return para;
  }).join('\n\n');

  // Replace em dashes with comma
  result = result.replace(/\s*\u2014\s*/g, ', ');

  // Convert inline-header bullet lists to prose
  const lines = result.split('\n');
  const converted: string[] = [];
  let bulletGroup: string[] = [];

  const flushBullets = () => {
    if (bulletGroup.length >= 2) {
      const items = bulletGroup.map(line => {
        return line.replace(/^-\s+\*\*[^*]+\*\*:?\s*/, '').trim();
      });
      const prose = items.join('. ') + '.';
      converted.push(prose);
    } else {
      converted.push(...bulletGroup);
    }
    bulletGroup = [];
  };

  for (const line of lines) {
    if (/^-\s+\*\*.+\*\*:/.test(line.trim())) {
      bulletGroup.push(line);
    } else {
      if (bulletGroup.length > 0) flushBullets();
      converted.push(line);
    }
  }
  if (bulletGroup.length > 0) flushBullets();

  result = converted.join('\n');
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass 4: Fix Language Patterns ---

export function fixLanguagePatterns(text: string, isProfessional = false): string {
  let result = text;

  // Collapse negative parallelisms ONLY when safe:
  //   - sentence is long enough that the emphasis was likely padding (≥ 14 words)
  //   - neither clause carries a number or proper noun (load-bearing content)
  const isPadded = (s: string) => s.split(/\s+/).length >= 14;
  const noHardContent = (s: string) =>
    !/\d/.test(s) && !/\b[A-Z][a-z]{2,}\b/.test(s);

  result = result.replace(
    /[Ii]t'?s not just\s+(.+?),\s*it'?s\s+(.+?)\./g,
    (m, x, y) => (isPadded(m) && noHardContent(x) && noHardContent(y) ? `It's ${y}.` : m),
  );
  result = result.replace(
    /[Nn]ot merely\s+(.+?),?\s*but\s+(?:also\s+)?(.+?)\./g,
    (m, x, y) => (isPadded(m) && noHardContent(x) && noHardContent(y) ? `${y}.` : m),
  );
  // "not only X but also Y" → "X and Y" preserves both clauses, so keep it unconditional.
  result = result.replace(/[Nn]ot only\s+(.+?),?\s*but also\s+(.+)/g, '$1 and $2');

  // Fix copula avoidance
  const copulaPatterns: [RegExp, string][] = [
    [/\bserves as a\b/gi, 'is a'],
    [/\bfunctions as a\b/gi, 'is a'],
    [/\bacts as a\b/gi, 'is a'],
    [/\bstands as a\b/gi, 'is a'],
  ];
  for (const [pattern, replacement] of copulaPatterns) {
    result = result.replace(pattern, (match) => preserveCase(match.split(' ')[0], replacement));
  }

  // Significance inflation
  result = result.replace(/marking a pivotal moment in the evolution of\s*/gi, '');
  result = result.replace(/\bindelible mark\b/gi, 'lasting impact');
  result = result.replace(/\bsetting the stage for\b/gi, 'leading to');
  result = result.replace(/\breflects broader trends\b/gi, '');
  result = result.replace(/\bkey turning point\b/gi, 'turning point');
  result = result.replace(/\bevolving landscape of\s*/gi, '');
  result = result.replace(/\bdeeply rooted in\b/gi, 'based in');

  // Transition word replacement
  const transitions: [RegExp, string[], string][] = [
    [/(?:^|(?<=\.\s))Furthermore,?\s*/gim, ['Also, ', ''], 'Furthermore, '],
    [/(?:^|(?<=\.\s))Moreover,?\s*/gim, ['And ', ''], 'Furthermore, '],
    [/(?:^|(?<=\.\s))Consequently,?\s*/gim, ['So, '], 'Therefore, '],
    [/(?:^|(?<=\.\s))Subsequently,?\s*/gim, ['Then, '], 'Following this, '],
    [/(?:^|(?<=\.\s))In addition,?\s*/gim, ['Also, '], 'Additionally, '],
    [/(?:^|(?<=\.\s))Additionally,?\s*/gim, [''], 'Additionally, '],
    [/(?:^|(?<=\.\s))Nonetheless,?\s*/gim, ['Still, '], 'Nevertheless, '],
    [/(?:^|(?<=\.\s))Nevertheless,?\s*/gim, ['Even so, '], 'Nevertheless, '],
  ];
  for (const [pattern, casualReplacements, formalReplacement] of transitions) {
    if (isProfessional) {
      result = result.replace(pattern, formalReplacement);
    } else {
      result = result.replace(pattern, () => rngPick(casualReplacements));
    }
  }

  // Remove filler openers
  result = result.replace(/(?:^|(?<=\.\s))At its core,?\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))Essentially,?\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))It is important to note that\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))In order to understand .+?,\s*we must first look at\s*/gim, '');

  // Rule-of-three padding removal — ONLY when all three items are known filler abstracts.
  // Prevents dropping load-bearing items like "cost" in "safety, speed, and cost".
  const FILLER_TRIPLET = new Set([
    'innovation', 'efficiency', 'excellence', 'quality', 'performance',
    'growth', 'value', 'scale', 'impact', 'success', 'synergy', 'agility',
    'engagement', 'alignment', 'momentum', 'transformation',
  ]);
  result = result.replace(/\b(\w{3,9}),\s+(\w{3,9}),\s+and\s+(\w{3,9})\b/g, (match, a, b, c) => {
    const all = [a, b, c].map((w: string) => w.toLowerCase());
    const allFiller = all.every((w: string) => FILLER_TRIPLET.has(w));
    if (allFiller) {
      return `${a} and ${b}`;
    }
    return match;
  });

  // Remove excessive hedging
  result = result.replace(/\bcould potentially possibly\b/gi, 'might');
  result = result.replace(/\bit could be argued that it might\b/gi, 'it may');
  result = result.replace(/\bseems to potentially suggest\b/gi, 'suggests');

  // Fix generic positive conclusions
  const genericConclusions = [
    /[^.]*\bfuture looks bright\b[^.]*\.\s*/gi,
    /[^.]*\bexciting times\b[^.]*\.\s*/gi,
    /[^.]*\bjourney toward excellence\b[^.]*\.\s*/gi,
  ];
  for (const pattern of genericConclusions) {
    result = result.replace(pattern, '');
  }

  // Clean up orphaned commas/punctuation at sentence starts
  result = result.replace(/\.\s*,\s*/g, '. ');
  result = result.replace(/([.!?])\s+,\s+/g, '$1 ');

  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass 5: Structural Burstiness Engineering ---

export function calcVariance(lengths: number[]): number {
  if (lengths.length < 2) return 0;
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
}

export function splitAtFirstBreak(sentence: string): [string, string] | null {
  const patterns = [
    /,\s+(and|but|so|yet|while|although|because|since|when|if)\s+/i,
    /;\s+/,
    /\s+(which|who|where)\s+/i,
    /,\s+/,
  ];
  for (const p of patterns) {
    const m = p.exec(sentence);
    if (m && m.index > 10) {
      const before = sentence.slice(0, m.index).trim();
      let after = sentence.slice(m.index + m[0].length).trim();
      if (before.split(/\s+/).length >= 4 && after.split(/\s+/).length >= 4) {
        if (!/[.!?]$/.test(before)) {
          if (/who|which|where/i.test(m[0])) {
            const subst = /who/i.test(m[0]) ? 'They' : /where/i.test(m[0]) ? 'There' : 'It';
            after = subst + ' ' + after;
          }
          return [before + '.', after.charAt(0).toUpperCase() + after.slice(1)];
        }
      }
    }
  }
  return null;
}

export function engineerBurstiness(text: string, mode: BurstinessMode): string {
  const isList = isListDominatedText(text);
  const paragraphs = text.split(/\n\n+/);
  const processedParagraphs: string[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];

    if (para.trim().startsWith('#') || para.trim().startsWith('```')) {
      processedParagraphs.push(para);
      continue;
    }
    if (isList && /^\d+\.\s|^[-*]\s/.test(para.trim())) {
      processedParagraphs.push(para);
      continue;
    }
    if (para.trim().startsWith('-') || /^\d+\./.test(para.trim())) {
      processedParagraphs.push(para);
      continue;
    }

    let sentences = splitSentences(para);
    if (sentences.length < 2) {
      processedParagraphs.push(para);
      continue;
    }

    const getLengths = () => sentences.map(s => s.trim().split(/\s+/).length);
    let lengths = getLengths();
    let variance = calcVariance(lengths);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    if (variance < 20 && mode !== 'mild' && sentences.length >= 3) {
      let longestIdx = lengths.indexOf(Math.max(...lengths));
      const split = splitAtFirstBreak(sentences[longestIdx].trim());
      if (split) {
        sentences.splice(longestIdx, 1, split[0] + ' ', split[1] + ' ');
        lengths = getLengths();
        variance = calcVariance(lengths);
      }

      lengths = getLengths();
      const mediumPairs: number[] = [];
      for (let i = 0; i < sentences.length - 1; i++) {
        if (lengths[i] >= 8 && lengths[i] <= 18 && lengths[i + 1] >= 8 && lengths[i + 1] <= 18) {
          mediumPairs.push(i);
        }
      }
      if (mediumPairs.length > 0) {
        const mergeIdx = mediumPairs[Math.floor(mediumPairs.length / 2)];
        const s1 = sentences[mergeIdx].trim().replace(/[.!?]\s*$/, '');
        const s2raw = sentences[mergeIdx + 1].trim();
        const s2 = s2raw.charAt(0).toLowerCase() + s2raw.slice(1);
        const connector = rng() < 0.5 ? ', and ' : '; ';
        sentences.splice(mergeIdx, 2, s1 + connector + s2 + ' ');
        lengths = getLengths();
        variance = calcVariance(lengths);
      }

      if (variance < 20 && sentences.length >= 3) {
        lengths = getLengths();
        longestIdx = lengths.indexOf(Math.max(...lengths));
        const split2 = splitAtFirstBreak(sentences[longestIdx].trim());
        if (split2) {
          sentences.splice(longestIdx, 1, split2[0] + ' ', split2[1] + ' ');
        }
      }
    }

    lengths = getLengths();
    const updatedAvg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const interval = mode === 'mild' ? 8 : mode === 'strong' ? 4 : 3;
    const newSentences: string[] = [];
    let flatCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const len = sentences[i].trim().split(/\s+/).length;
      const inFlatZone = Math.abs(len - updatedAvg) <= 2;
      if (inFlatZone) {
        flatCount++;
        if (flatCount % interval === 0 && len >= 15) {
          const split3 = splitAtFirstBreak(sentences[i].trim());
          if (split3) {
            newSentences.push(split3[0] + ' ');
            if (mode !== 'mild' && split3[1].split(/\s+/).length > 6) {
              const punchyWords = split3[1].split(/\s+/).slice(0, 3).join(' ').replace(/[.,;:]$/, '');
              newSentences.push(punchyWords + '. ');
              const rest = split3[1].split(/\s+/).slice(3).join(' ');
              if (rest.length > 5) newSentences.push(rest.charAt(0).toUpperCase() + rest.slice(1) + ' ');
            } else {
              newSentences.push(split3[1] + ' ');
            }
            continue;
          }
        }
      }
      newSentences.push(sentences[i]);
    }
    sentences = newSentences;

    const collapseThresh = variance < 15 ? 18 : 8;
    if (mode === 'strong' || mode === 'aggressive') {
      const collapsed: string[] = [];
      let i = 0;
      while (i < sentences.length) {
        const aLen = sentences[i].trim().split(/\s+/).length;
        if (
          i + 1 < sentences.length &&
          aLen < collapseThresh &&
          sentences[i + 1].trim().split(/\s+/).length < collapseThresh &&
          rng() < 0.4
        ) {
          const a = sentences[i].trim().replace(/[.]\s*$/, '');
          const b = sentences[i + 1].trim();
          collapsed.push(a + '; ' + b.charAt(0).toLowerCase() + b.slice(1) + ' ');
          i += 2;
        } else {
          collapsed.push(sentences[i]);
          i++;
        }
      }
      sentences = collapsed;
    }

    processedParagraphs.push(sentences.join('').trim());
  }

  if (mode === 'aggressive') {
    const final: string[] = [];
    for (let i = 0; i < processedParagraphs.length; i++) {
      if ((i + 1) % 5 === 0) {
        const sents = splitSentences(processedParagraphs[i]);
        if (sents.length > 2) {
          const last = sents.pop()!;
          final.push(sents.join('').trim());
          final.push(last.trim());
          continue;
        }
      }
      final.push(processedParagraphs[i]);
    }
    return final.join('\n\n');
  }

  let result = processedParagraphs.join('\n\n');

  // Passive → active only when the agent is explicit. Never invent a subject.
  result = result.replace(
    /\b(The\s+\w+)\s+(was|were|is|are)\s+(\w+ed)\s+by\s+([\w\s]+?)([.,;!?])/gi,
    (_match, subject, _aux, verb, agent, punct) => `${agent.trim()} ${verb} ${subject.toLowerCase()}${punct}`
  );
  // Removed:
  //   - `"\\w has been \\w+ed"` blanket stripping — drops the "been" aspect marker.
  //   - `"It was Xed that"` → invents a subject ("Researchers/Experts/People/They").
  //   - `"X can be Yed"` → "You/We can Y X" invents an addressee.
  //   - `"X should be Yed"` → "You should Y X" invents an addressee.
  // These all fabricate content, which the SafetyGuard would reject anyway; removing
  // them avoids the pass being a no-op after revert.

  return result;
}

// --- Pass 6: Adverb Cleanup ---

const ADVERB_VERB_REPLACEMENTS: [RegExp, string][] = [
  [/\bsignificantly improve\b/gi, 'improve'],
  [/\bgreatly enhance\b/gi, 'enhance'],
  [/\bdeeply impact\b/gi, 'affect'],
  [/\bhighly effective\b/gi, 'effective'],
  [/\brapidly accelerate\b/gi, 'accelerate'],
  [/\bstrongly recommend\b/gi, 'recommend'],
  [/\bclearly demonstrate\b/gi, 'show'],
  [/\beffectively utilize\b/gi, 'use'],
  [/\bactively engage\b/gi, 'engage'],
  [/\bdirectly address\b/gi, 'address'],
  [/\bfundamentally change\b/gi, 'change'],
  // Preserve polarity strength: "positively/negatively impact" is a strong claim,
  // not a weak "help/hurt". Use verbs of matching intensity.
  [/\bpositively impact\b/gi, 'improve'],
  [/\bnegatively impact\b/gi, 'harm'],
  [/\bsignificantly increase\b/gi, 'increase'],
  [/\bsignificantly decrease\b/gi, 'decrease'],
];

const FILLER_ADVERBS = /\b(incredibly|extremely|absolutely|completely|totally|obviously)\s+/gi;
const SENTENCE_START_ADVERBS = /^(Clearly,?\s*)/gim;

export function cleanupAdverbs(text: string): string {
  let result = text;
  for (const [pattern, replacement] of ADVERB_VERB_REPLACEMENTS) {
    result = result.replace(pattern, (match) => preserveCase(match.split(' ')[0], replacement));
  }
  result = result.replace(FILLER_ADVERBS, '');
  result = result.replace(SENTENCE_START_ADVERBS, '');
  result = result.replace(/ {2,}/g, ' ');
  return result;
}
