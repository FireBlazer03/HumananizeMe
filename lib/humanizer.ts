import { HumanizerSettings, HumanizerResult, PassResult, BurstinessMode } from '@/types';
import { vocabReplacements } from './vocabMap';
import { injectImperfections } from './imperfections';
import { applyDynamicSynonyms } from './synonyms';
import { applyRandomSpacing } from './spacing';

// --- Helpers ---

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countDiff(before: string, after: string): number {
  const bWords = before.split(/\s+/);
  const aWords = after.split(/\s+/);
  let changes = 0;
  const maxLen = Math.max(bWords.length, aWords.length);
  for (let i = 0; i < maxLen; i++) {
    if (bWords[i] !== aWords[i]) changes++;
  }
  return changes;
}

function cleanExtraSpaces(text: string): string {
  return text.replace(/ {3,}/g, '  ').replace(/^ +/gm, '').replace(/ +$/gm, '').replace(/\n{3,}/g, '\n\n');
}

// Safe sentence splitter that preserves trailing text without punctuation
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  const regex = /[^.!?]+[.!?]+\s*/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    parts.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  // CRITICAL: preserve any trailing text that doesn't end with punctuation
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// Detect if text is predominantly a numbered/bulleted list
function isListDominatedText(text: string): boolean {
  const listItems = (text.match(/^\d+\./gm) || []).length + (text.match(/^[-*]\s/gm) || []).length;
  const totalLines = text.split('\n').filter(l => l.trim().length > 0).length;
  return listItems > 3 && totalLines > 0 && listItems / totalLines > 0.4;
}

// --- Pass 1: Remove Chatbot Artifacts ---

const CHATBOT_PHRASES = [
  "I hope this helps",
  "Let me know if you have any questions",
  "Of course!",
  "Certainly!",
  "Great question!",
  "You're absolutely right!",
  "Here is an overview of",
  "Here is a summary of",
  "Would you like me to expand on any section?",
  "Would you like me to expand on any section",
  "Feel free to ask",
  "As of my knowledge cutoff",
  "While specific details are limited in available sources",
  "Based on available information",
  "It is important to note that",
  "It is worth noting that",
  "Needless to say,",
  "Needless to say",
  "It goes without saying that",
  "In conclusion,",
  "In conclusion",
  "To summarize,",
  "To summarize",
  "As we look to the future,",
  "As we look to the future",
  "The future looks bright.",
  "The future looks bright",
  "Exciting times lie ahead.",
  "Exciting times lie ahead",
  "This represents a major step in the right direction.",
  "This represents a major step in the right direction",
];

function removeChatbotArtifacts(text: string): string {
  let result = text;
  for (const phrase of CHATBOT_PHRASES) {
    const escaped = escapeRegex(phrase);
    const regex = new RegExp(escaped + '[.!?]?\\s*', 'gi');
    result = result.replace(regex, '');
  }
  result = result.replace(/ {2,}/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n');
  return result.trim();
}

// --- Pass 2: AI Vocabulary Replacement ---

function replaceAIVocab(text: string): string {
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

function fixFormatting(text: string): string {
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

function fixLanguagePatterns(text: string): string {
  let result = text;

  // Remove negative parallelisms
  result = result.replace(/[Ii]t'?s not just\s+(.+?),\s*it'?s\s+(.+?)\./g, "It's $2.");
  result = result.replace(/[Nn]ot merely\s+(.+?),?\s*but\s+(?:also\s+)?(.+?)\./g, '$2.');
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

  // Transition word replacement — match at line start OR after sentence boundary
  const transitions: [RegExp, string[]][] = [
    [/(?:^|(?<=\.\s))Furthermore,?\s*/gim, ['Also, ', '']],
    [/(?:^|(?<=\.\s))Moreover,?\s*/gim, ['And ', '']],
    [/(?:^|(?<=\.\s))Consequently,?\s*/gim, ['So, ']],
    [/(?:^|(?<=\.\s))Subsequently,?\s*/gim, ['Then, ']],
    [/(?:^|(?<=\.\s))In addition,?\s*/gim, ['Also, ']],
    [/(?:^|(?<=\.\s))Additionally,?\s*/gim, ['']],
    [/(?:^|(?<=\.\s))Nonetheless,?\s*/gim, ['Still, ']],
    [/(?:^|(?<=\.\s))Nevertheless,?\s*/gim, ['Even so, ']],
  ];
  for (const [pattern, replacements] of transitions) {
    result = result.replace(pattern, () => {
      return replacements[Math.floor(Math.random() * replacements.length)];
    });
  }

  // Remove filler openers — match at line start OR after sentence boundary
  result = result.replace(/(?:^|(?<=\.\s))At its core,?\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))Essentially,?\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))It is important to note that\s*/gim, '');
  result = result.replace(/(?:^|(?<=\.\s))In order to understand .+?,\s*we must first look at\s*/gim, '');

  // Rule-of-three padding removal
  result = result.replace(/\b(\w{3,9}),\s+(\w{3,9}),\s+and\s+(\w{3,9})\b/g, (match, a, b, c) => {
    const abstracts = [a, b, c];
    const allAbstract = abstracts.every((w: string) =>
      w.length < 10 && /^[a-z]+$/i.test(w)
    );
    if (allAbstract) {
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

  // Clean up orphaned commas/punctuation at sentence starts (e.g. after transition removal)
  result = result.replace(/\.\s*,\s*/g, '. ');
  result = result.replace(/([.!?])\s+,\s+/g, '$1 ');

  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass 5: Structural Burstiness Engineering (Phase 1 rewrite) ---

function calcVariance(lengths: number[]): number {
  if (lengths.length < 2) return 0;
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
}

function splitAtFirstBreak(sentence: string): [string, string] | null {
  // Try: comma+conjunction, semicolon, relative clause, bare comma
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
          // For relative clauses, substitute pronoun
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

function engineerBurstiness(text: string, mode: BurstinessMode): string {
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

    // === PHASE 1 CORE: Force variance > 20 when too uniform ===
    if (variance < 20 && mode !== 'mild' && sentences.length >= 3) {

      // STEP A: Force SHORT sentence — split the longest sentence aggressively
      let longestIdx = lengths.indexOf(Math.max(...lengths));
      const split = splitAtFirstBreak(sentences[longestIdx].trim());
      if (split) {
        sentences.splice(longestIdx, 1, split[0] + ' ', split[1] + ' ');
        lengths = getLengths();
        variance = calcVariance(lengths);
      }

      // STEP B: Force LONG sentence — merge two medium sentences
      lengths = getLengths();
      const mediumPairs: number[] = [];
      for (let i = 0; i < sentences.length - 1; i++) {
        if (lengths[i] >= 8 && lengths[i] <= 18 && lengths[i + 1] >= 8 && lengths[i + 1] <= 18) {
          mediumPairs.push(i);
        }
      }
      if (mediumPairs.length > 0) {
        // Pick the pair whose combined length makes the longest sentence
        const mergeIdx = mediumPairs[Math.floor(mediumPairs.length / 2)];
        const s1 = sentences[mergeIdx].trim().replace(/[.!?]\s*$/, '');
        const s2raw = sentences[mergeIdx + 1].trim();
        const s2 = s2raw.charAt(0).toLowerCase() + s2raw.slice(1);
        const connector = Math.random() < 0.5 ? ', and ' : '; ';
        sentences.splice(mergeIdx, 2, s1 + connector + s2 + ' ');
        lengths = getLengths();
        variance = calcVariance(lengths);
      }

      // STEP C: If still low variance, split another long sentence
      if (variance < 20 && sentences.length >= 3) {
        lengths = getLengths();
        longestIdx = lengths.indexOf(Math.max(...lengths));
        const split2 = splitAtFirstBreak(sentences[longestIdx].trim());
        if (split2) {
          sentences.splice(longestIdx, 1, split2[0] + ' ', split2[1] + ' ');
        }
      }
    }

    // Flat zone: split long uniform sentences at interval
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
              // Insert punchy 2-word follow-up
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

    // Collapse adjacent short sentences (merge up short→long)
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
          Math.random() < 0.4
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

  // Aggressive: detach last sentence to own paragraph every 5th
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

  // Active voice heuristics — multiple passive→active patterns

  // Pattern 1: "The X was/were/is/are verbed by Y" → "Y verbed the X"
  result = result.replace(
    /\b(The\s+\w+)\s+(was|were|is|are)\s+(\w+ed)\s+by\s+([\w\s]+?)([.,;!?])/gi,
    (_match, subject, _aux, verb, agent, punct) => {
      return `${agent.trim()} ${verb} ${subject.toLowerCase()}${punct}`;
    }
  );

  // Pattern 2: "X has/have been verbed" → "X verbed" (drop passive auxiliary)
  result = result.replace(
    /\b(\w[\w\s]{1,25}?)\s+(has|have)\s+been\s+(\w+ed)\b/gi,
    (_match, subject, _aux, verb) => {
      return `${subject.trim()} ${verb}`;
    }
  );

  // Pattern 3: "It was/is verbed that..." → "They verbed that..." or drop "It"
  result = result.replace(
    /\bIt\s+(was|is)\s+(\w+ed)\s+that\b/gi,
    (_match, _aux, verb) => {
      const subjects = ['They', 'People', 'Researchers', 'Experts'];
      const subj = subjects[Math.floor(Math.random() * subjects.length)];
      return `${subj} ${verb} that`;
    }
  );

  // Pattern 4: "X can be verbed" → "You can verb X" or "We can verb X"
  result = result.replace(
    /\b([\w\s]{2,20}?)\s+can\s+be\s+(\w+)ed\b/gi,
    (_match, subject, verbRoot) => {
      const actor = Math.random() < 0.5 ? 'You' : 'We';
      return `${actor} can ${verbRoot} ${subject.trim().toLowerCase()}`;
    }
  );

  // Pattern 5: "X should be verbed" → "You should verb X"
  result = result.replace(
    /\b([\w\s]{2,20}?)\s+should\s+be\s+(\w+)ed\b/gi,
    (_match, subject, verbRoot) => {
      return `You should ${verbRoot} ${subject.trim().toLowerCase()}`;
    }
  );

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
  [/\bpositively impact\b/gi, 'help'],
  [/\bnegatively impact\b/gi, 'hurt'],
  [/\bsignificantly increase\b/gi, 'increase'],
  [/\bsignificantly decrease\b/gi, 'decrease'],
];

const FILLER_ADVERBS = /\b(incredibly|extremely|absolutely|completely|totally|obviously)\s+/gi;
const SENTENCE_START_ADVERBS = /^(Clearly,?\s*)/gim;

function cleanupAdverbs(text: string): string {
  let result = text;

  for (const [pattern, replacement] of ADVERB_VERB_REPLACEMENTS) {
    result = result.replace(pattern, (match) => preserveCase(match.split(' ')[0], replacement));
  }

  result = result.replace(FILLER_ADVERBS, '');
  result = result.replace(SENTENCE_START_ADVERBS, '');
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

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

function removePreambles(text: string): string {
  let result = text;
  for (const pattern of PREAMBLE_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, 'gim'), '');
  }
  // Capitalize first letter of sentences that now start lowercase
  result = result.replace(/\.\s+([a-z])/g, (_m, c) => '. ' + c.toUpperCase());
  result = result.replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase());
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass: Morphology Correction (Phase 3) ---

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

function morphologyCorrection(text: string): string {
  let result = text;
  for (const [pattern, replacement] of NOUN_STACK_PATTERNS) {
    result = result.replace(pattern, (match) => preserveCase(match, replacement));
  }
  // "in terms of X" → "for X"
  result = result.replace(
    /\bin terms of\s+([a-zA-Z][a-zA-Z\s]{0,30}?)([,;.!?]|\s+(?:and|but|or|which|that|when|if)\b)/gi,
    (_m, noun, trailing) => `for ${noun}${trailing}`
  );
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass: N-gram Entropy Diversification ---
// Targets repeated bigrams that lower 2-gram conditional entropy.
// AI text: ~3.119, Human: ~3.883 (20% gap).

// CURATED: only alternatives that preserve meaning in most contexts.
// Removed: "is a"→"amounts to a", "has been"→"proved", "can be"→"might prove",
// "will be"→"is likely to be" — all change meaning or certainty.
const BIGRAM_ALTERNATIVES: Record<string, string[]> = {
  'of the': ['within the', 'from the', 'of this'],
  'in the': ['inside the', 'within the', 'across the'],
  'to the': ['toward the', 'for the', 'into the'],
  'on the': ['upon the', 'along the'],
  'there is': ['there exists', 'you find'],
  'there are': ['you find', 'there exist'],
};

function diversifyNgrams(text: string): string {
  let result = text;
  // Track how many times each bigram has been seen
  const bigramCount: Record<string, number> = {};

  for (const [bigram, alts] of Object.entries(BIGRAM_ALTERNATIVES)) {
    const regex = new RegExp(`\\b${bigram}\\b`, 'gi');
    bigramCount[bigram] = 0;

    result = result.replace(regex, (matched) => {
      bigramCount[bigram]++;
      // Keep the first occurrence, diversify subsequent ones (50% chance)
      if (bigramCount[bigram] <= 1) return matched;
      if (Math.random() > 0.50) return matched;
      const alt = alts[Math.floor(Math.random() * alts.length)];
      return preserveCase(matched, alt);
    });
  }

  return result;
}

// --- Pass: Sentence Starter Diversity ---
// AI text heavily uses "The X", "This Y", "It Z" openings. Detectors flag low opener diversity.

const ARTICLE_OPENER_TRANSFORMS: Array<{ pattern: RegExp; replacements: string[] }> = [
  { pattern: /^The (\w+)/, replacements: ['That $1', 'A $1', 'One $1', 'Each $1'] },
  { pattern: /^This (\w+)/, replacements: ['That $1', 'Such a $1', 'One $1'] },
  { pattern: /^These (\w+)/, replacements: ['Such $1', 'Those $1', 'Many $1'] },
  { pattern: /^It is /, replacements: ['What matters is ', 'The point is ', 'The fact is '] },
  { pattern: /^There is /, replacements: ['One finds ', 'You see ', 'We see '] },
  { pattern: /^There are /, replacements: ['You find ', 'We see ', 'One finds '] },
];

function diversifySentenceStarters(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return text;

  // Count starter frequencies (first 2 words)
  const starterFreq: Record<string, number[]> = {};
  for (let i = 0; i < sentences.length; i++) {
    const words = sentences[i].trim().split(/\s+/);
    if (words.length < 2) continue;
    const starter = words[0].toLowerCase();
    if (!starterFreq[starter]) starterFreq[starter] = [];
    starterFreq[starter].push(i);
  }

  // For each overrepresented starter (3+ occurrences), transform 2nd+ occurrences
  for (const [_starter, indices] of Object.entries(starterFreq)) {
    if (indices.length < 3) continue;

    // Skip first occurrence, transform some of the rest
    for (let k = 1; k < indices.length; k++) {
      if (Math.random() > 0.6) continue; // only transform 60% of duplicates
      const idx = indices[k];
      const trimmed = sentences[idx].trim();

      for (const { pattern, replacements } of ARTICLE_OPENER_TRANSFORMS) {
        if (pattern.test(trimmed)) {
          const rep = replacements[Math.floor(Math.random() * replacements.length)];
          const transformed = trimmed.replace(pattern, rep);
          sentences[idx] = sentences[idx].replace(trimmed, transformed);
          break;
        }
      }
    }
  }

  // Also: if 3+ consecutive sentences start with same first word, transform the middle one
  for (let i = 1; i < sentences.length - 1; i++) {
    const prev = sentences[i - 1].trim().split(/\s+/)[0]?.toLowerCase();
    const curr = sentences[i].trim().split(/\s+/)[0]?.toLowerCase();
    const next = sentences[i + 1]?.trim().split(/\s+/)[0]?.toLowerCase();
    if (prev === curr && curr === next) {
      const trimmed = sentences[i].trim();
      // Prepend a transitional phrase
      const transitions = ['Meanwhile, ', 'At the same time, ', 'On a related note, ', 'Along those lines, '];
      const trans = transitions[Math.floor(Math.random() * transitions.length)];
      const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
      sentences[i] = sentences[i].replace(trimmed, trans + lowered);
    }
  }

  return sentences.join('');
}

// --- Pass: Punctuation Pattern Diversity ---
// AI text has monotonous punctuation. Human writing uses varied punctuation irregularly.

function diversifyPunctuation(text: string): string {
  let result = text;

  // 10% of "X, and Y" → "X; Y" (semicolon join)
  result = result.replace(/,\s+and\s+/g, (matched) => {
    if (Math.random() > 0.10) return matched;
    return '; ';
  });

  // 8% of adjacent short sentences → colon join: "X. Y." → "X: y."
  const sentences = splitSentences(result);
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = sentences[i].trim();
    const b = sentences[i + 1]?.trim();
    if (!a || !b) continue;
    const aLen = a.split(/\s+/).length;
    const bLen = b.split(/\s+/).length;
    if (aLen < 12 && bLen < 12 && aLen > 4 && bLen > 4 && Math.random() < 0.08) {
      const aTrimmed = a.replace(/[.!?]\s*$/, '');
      const bLowered = b.charAt(0).toLowerCase() + b.slice(1);
      sentences[i] = aTrimmed + ': ';
      sentences[i + 1] = bLowered;
    }
  }
  result = sentences.join('');

  // Occasionally (5%) convert one "X, Y, and Z" per paragraph to "X and Y (along with Z)"
  result = result.replace(/\b(\w+),\s+(\w+),\s+and\s+(\w+)\b/g, (matched, a, b, c) => {
    if (Math.random() > 0.05) return matched;
    return `${a} and ${b} (along with ${c})`;
  });

  return result;
}

// --- Pass: Perplexity Injection (Phase 2) ---

const INFORMAL_CONNECTIVES = [
  'Honestly, ', 'In practice, ', 'The thing is, ', 'That said, ',
  'At the same time, ', 'To be fair, ', 'In reality, ', 'Worth noting, ',
];

const PARENTHETICALS = [
  '(at least in most cases)', '(or something close to it)',
  '(depending on the situation)', '(which is worth keeping in mind)',
  '(and this matters more than it seems)', '(though not always)',
];

function perplexityInjection(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return text;

  return sentences.map((s, idx) => {
    if (idx === 0) return s;
    const trimmed = s.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) return s;
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 8) return s;
    if (/\(/.test(trimmed)) return s;

    if (Math.random() > 0.15) return s;

    const type = Math.random();

    if (type < 0.40) {
      // Front an adverbial clause
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
      // Insert parenthetical ONLY after a comma or clause boundary to avoid
      // breaking noun phrases (e.g. "systemic (aside) barriers" is unnatural).
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx > 10 && commaIdx < trimmed.length - 20) {
        const aside = PARENTHETICALS[Math.floor(Math.random() * PARENTHETICALS.length)];
        const before = trimmed.slice(0, commaIdx + 1);
        const after = trimmed.slice(commaIdx + 1);
        return s.replace(trimmed, before + ' ' + aside + after);
      }
      // No good insertion point — skip rather than force a bad one
      return s;
    } else {
      // Add informal connective at start
      if (!/^(However|But|And|Or|So|Yet|Also|Still|Even|Just|Honestly|In practice|The thing)\b/.test(trimmed)) {
        const connective = INFORMAL_CONNECTIVES[Math.floor(Math.random() * INFORMAL_CONNECTIVES.length)];
        const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
        return s.replace(trimmed, connective + lowered);
      }
      return s;
    }
  }).join('');
}

// --- Pass: Semantic Non-linearity (Phase 4) ---

const CONTRAST_SENTENCES = [
  'Then again, not everyone sees it that way.',
  "That's not the whole story, though.",
  "It's more complicated than it looks.",
  'Some would push back on this.',
  'The reality is usually messier.',
  'Not every case plays out this way.',
];

function semanticNonLinearity(text: string): string {
  const paragraphs = text.split(/\n\n+/);

  const processed = paragraphs.map(para => {
    if (para.trim().startsWith('#') || para.trim().startsWith('```')) return para;
    if (isListDominatedText(para)) return para;

    const sentences = splitSentences(para);
    if (sentences.length < 4) return para;

    const roll = Math.random();

    if (roll < 0.20) {
      // Swap sentences at index 1 and 2 (0-based) if both declarative
      const s1 = sentences[1]?.trim() || '';
      const s2 = sentences[2]?.trim() || '';
      if (s1 && s2 && !s1.endsWith('?') && !s2.endsWith('?')) {
        const swapped = [...sentences];
        swapped[1] = sentences[2];
        swapped[2] = sentences[1];
        return swapped.join('').trim();
      }
    } else if (roll < 0.35) {
      // Insert contrast sentence after sentence at index 2
      const contrast = CONTRAST_SENTENCES[Math.floor(Math.random() * CONTRAST_SENTENCES.length)];
      const result = [...sentences];
      result.splice(2, 0, ' ' + contrast + ' ');
      return result.join('').trim();
    }

    return para;
  });

  return processed.join('\n\n');
}

// --- Pass: Break Long Sentences ---

function breakLongSentences(text: string): string {
  const sentences = splitSentences(text);
  return sentences.map(sentence => {
    const words = sentence.trim().split(/\s+/);
    // Lower threshold: any sentence ≥15 words is a candidate
    if (words.length < 15) return sentence;

    // Priority 1: comma + conjunction
    const conjPattern = /,\s+(and|but|so|yet|while|although|because|since|when|if)\s+/i;
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

    // Priority 2: relative clause (" which ", " who ", " where ")
    const relPattern = /\s+(which|who|where)\s+/i;
    match = relPattern.exec(sentence);
    if (match && match.index !== undefined && words.length >= 18) {
      const before = sentence.slice(0, match.index);
      const pronoun = match[1].toLowerCase();
      const after = sentence.slice(match.index + match[0].length); // skip the pronoun
      if (before.split(/\s+/).length > 6 && after.split(/\s+/).length > 4) {
        const first = before.trim() + '.';
        // Replace relative pronoun with a natural subject to avoid fragments
        const subst = pronoun === 'who' ? 'They' : pronoun === 'where' ? 'There' : 'It';
        return first + ' ' + subst + ' ' + after.trim();
      }
    }

    // Priority 3: semicolon
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

function mergeShortSentences(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return text;

  const result: string[] = [];
  let i = 0;
  while (i < sentences.length) {
    const cur = sentences[i].trim();
    const curWords = cur.split(/\s+/).length;
    const next = sentences[i + 1]?.trim();
    const nextWords = next ? next.split(/\s+/).length : 99;

    // Merge two consecutive short sentences (both <10 words, 40% chance)
    if (
      curWords < 10 && curWords > 2 &&
      nextWords < 10 && nextWords > 2 &&
      next && !cur.startsWith('#') && !next.startsWith('#') &&
      Math.random() < 0.4
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

function varyOpeners(text: string): string {
  const sentences = splitSentences(text);
  return sentences.map((s, i) => {
    // Apply to every 3rd sentence instead of every 4th
    if (i % 3 !== 0) return s;
    for (const [pattern, replacement] of OPENER_TRANSFORMS) {
      if (pattern.test(s.trim())) {
        return s.trim().replace(pattern, replacement) + ' ';
      }
    }
    return s;
  }).join('');
}

// --- Pass: Semantic Validation (meaning preservation) ---
// Catches incorrect substitutions, redundant phrases, and unnatural combinations
// that arise from earlier context-blind replacement passes.

// Redundant adjacent-word patterns: "optimize effective efficiency" etc.
const REDUNDANCY_PATTERNS: [RegExp, string][] = [
  // Doubled meaning (adjective + near-synonym noun)
  [/\boptimize\s+effective\s+efficiency\b/gi, 'improve efficiency'],
  [/\bimprove\s+better\b/gi, 'improve'],
  [/\bimprove\s+improvement\b/gi, 'improve'],
  [/\bnew\s+new\b/gi, 'new'],
  [/\bmore\s+more\b/gi, 'more'],
  [/\bkey\s+key\b/gi, 'key'],
  [/\bmajor\s+major\b/gi, 'major'],
  [/\bactive\s+actively\b/gi, 'actively'],
  [/\bactively\s+active\b/gi, 'actively'],
  [/\bplanned\s+plan\b/gi, 'plan'],
  [/\bplanned\s+planning\b/gi, 'planning'],
  // Redundant intensifier + already-intense word
  [/\bvery\s+very\b/gi, 'very'],
  [/\bgreatly\s+greatly\b/gi, 'greatly'],
  [/\breally\s+really\b/gi, 'really'],
  // Tautological phrases
  [/\bfuture\s+ahead\b/gi, 'future'],
  [/\bpast\s+history\b/gi, 'history'],
  [/\bend\s+result\b/gi, 'result'],
  [/\bfree\s+gift\b/gi, 'gift'],
  [/\bbasic\s+fundamentals\b/gi, 'basics'],
  [/\bbasic\s+basics\b/gi, 'basics'],
  [/\bjoin\s+together\b/gi, 'join'],
  [/\breturn\s+back\b/gi, 'return'],
  [/\bcombine\s+together\b/gi, 'combine'],
  [/\bstill\s+remains\b/gi, 'remains'],
  [/\bstill\s+continues\b/gi, 'continues'],
];

// Known bad substitution patterns our pipeline can produce
const BAD_SUBSTITUTION_FIXES: [RegExp, string][] = [
  // "planned desegregation" from "strategic integration"
  [/\bplanned\s+desegregation\b/gi, 'strategic integration'],
  // Grammar fixes from replacement artifacts
  [/\bit is must\b/gi, 'it is important'],
  [/\bis must that\b/gi, 'is important that'],
  // Orphaned transition words (transition removed but word left as standalone sentence)
  [/\.\s*On top of that\.\s*/g, '. '],
  [/\.\s*Also\.\s*/g, '. '],
  [/\.\s*Even so\.\s*/g, '. '],
  [/\.\s*Still\.\s*/g, '. '],
  [/\.\s*Then\.\s*/g, '. '],
  [/\.\s*So\.\s*/g, '. '],
  // Double periods and spacing artifacts
  [/\.{2,}/g, '.'],
  [/\.\s+\./g, '.'],
];

// Unnatural word combinations that sound robotic or contradictory
const UNNATURAL_COMBOS: [RegExp, string][] = [
  [/\bset up\s+company\b/gi, 'established company'],
  [/\bskilled\s+difficulties\b/gi, 'experienced difficulties'],
  [/\bskilled\s+problems\b/gi, 'experienced problems'],
  [/\bskilled\s+issues\b/gi, 'experienced issues'],
  [/\bskilled\s+challenges\b/gi, 'faced challenges'],
  [/\bgood\s+strategy\b/gi, 'effective strategy'],
  [/\bgood\s+approach\b/gi, 'effective approach'],
  [/\bgood\s+implementation\b/gi, 'effective implementation'],
  [/\bwell\s+strategy\b/gi, 'effective strategy'],
  [/\bwell\s+approach\b/gi, 'effective approach'],
  [/\buse\s+of\s+use\b/gi, 'use'],
  [/\bshow\s+shows\b/gi, 'shows'],
  [/\bshows\s+show\b/gi, 'shows'],
];

function semanticValidation(text: string): string {
  let result = text;

  // Fix known bad substitutions first
  for (const [pattern, fix] of BAD_SUBSTITUTION_FIXES) {
    result = result.replace(pattern, fix);
  }

  // Fix unnatural word combinations
  for (const [pattern, fix] of UNNATURAL_COMBOS) {
    result = result.replace(pattern, fix);
  }

  // Remove redundant phrases
  for (const [pattern, fix] of REDUNDANCY_PATTERNS) {
    result = result.replace(pattern, fix);
  }

  // Remove duplicate adjacent words (case-insensitive): "the the", "a a"
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Clean up any resulting double spaces
  result = result.replace(/ {2,}/g, ' ');

  return result;
}

// --- Pass: Naturalness Check (final quality gate) ---
// Ensures sentences read naturally after all transformations.

function naturalnessCheck(text: string): string {
  let result = text;

  // Fix sentences that start with orphaned conjunctions from removed content
  result = result.replace(/\.\s+And\s+\./g, '.');
  result = result.replace(/\.\s+But\s+\./g, '.');
  result = result.replace(/\.\s+Or\s+\./g, '.');

  // Fix dangling prepositions at end of sentence from truncated rewrites
  result = result.replace(/\s+(of|for|to|with|from|by|in|on|at)\s*\./g, '.');

  // Fix sentences that are just a single short word + period (< 3 chars)
  const sentences = splitSentences(result);
  const cleaned = sentences.filter(s => {
    const trimmed = s.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    // Drop sentences that are just 1-2 words and under 8 chars (likely artifacts)
    if (words.length <= 2 && trimmed.replace(/[.!?,;]/g, '').length < 8) {
      // But keep intentional short sentences like "Indeed." or "Not quite."
      if (/^[A-Z]/.test(trimmed) && trimmed.length >= 4) return true;
      return false;
    }
    return true;
  });
  result = cleaned.join('');

  // Fix common grammar errors from replacements
  result = result.replace(/\bhave showed\b/gi, 'have shown');
  result = result.replace(/\bhas showed\b/gi, 'has shown');
  result = result.replace(/\bhave shown\b/gi, 'have shown'); // normalize
  result = result.replace(/\bwas showed\b/gi, 'was shown');

  // Fix double-comma and comma-period artifacts
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/,\s*\./g, '.');
  result = result.replace(/;\s*\./g, '.');

  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Final Polish: Refine Natural Tone ---
// Runs AFTER all transformations and validation. This is a polishing layer only.
// Fixes awkward phrasing, weak word choices, flow issues, and tone inconsistency
// that arise from earlier context-blind replacement passes.
// Rule: never change meaning — only improve how it sounds.

// Formal-register indicators: if 3+ present, text is formal/academic
const FORMAL_INDICATORS = [
  'implementation', 'infrastructure', 'methodology', 'framework', 'algorithms',
  'operational', 'regulatory', 'governance', 'mechanisms', 'participants',
  'interventions', 'longitudinal', 'predisposition', 'theoretical', 'empirical',
  'socioeconomic', 'cognitive', 'organizational', 'institutional', 'analytical',
  'architecture', 'procurement', 'compliance', 'jurisdiction', 'optimization',
];

function detectFormalRegister(text: string): boolean {
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of FORMAL_INDICATORS) {
    if (lower.includes(word)) count++;
    if (count >= 3) return true;
  }
  return false;
}

function refineNaturalTone(text: string): string {
  let result = text;
  const isFormal = detectFormalRegister(result);

  // ── Phase 1: Fix awkward phrases from pipeline substitutions ──

  // "[Article] [adjective] nature of" — "nature" is uncountable, only "The" works
  result = result.replace(/\b(Each|One|A|That)\s+(complex|multifaceted|nuanced|intricate|dynamic)\s+nature\b/gi,
    (_m, _starter, adj) => `The ${adj} nature`);

  // "careful thought of" → "careful thought about" (preposition mismatch)
  result = result.replace(/\bcareful thought of\b/gi, 'careful consideration of');
  result = result.replace(/\bcareful thought about\b/gi, 'careful thought about');

  // "thorough approach to" is fine, but "thorough angle to" is awkward
  result = result.replace(/\bthorough angle\b/gi, 'thorough approach');
  result = result.replace(/\bthorough tack\b/gi, 'thorough approach');

  // "an/one ecosystem of" → "the ecosystem of"
  result = result.replace(/\b(an|one) ecosystem of\b/gi, 'the ecosystem of');

  // "one [noun]" at sentence start from starter diversification — usually wrong
  result = result.replace(/(?:^|\.\s+)One\s+(ecosystem|landscape|world|community|platform)\b/gm,
    (m) => m.replace(/One\s+/, 'The '));

  // ── Phase 2: Restore natural word choices where replacements weakened text ──

  // "planned integration/implementation" → "careful integration/implementation"
  result = result.replace(/\bplanned (integration|implementation|development)\b/gi,
    (_m, noun) => `careful ${noun}`);
  // "planned approach" → "thoughtful approach"
  result = result.replace(/\bplanned approach\b/gi, 'thoughtful approach');
  // "planned strategy" → "deliberate strategy"
  result = result.replace(/\bplanned strategy\b/gi, 'deliberate strategy');

  // "solid governance/systems" → "strong governance/systems" (more natural collocate)
  result = result.replace(/\bsolid governance\b/gi, 'strong governance');
  result = result.replace(/\bsolid systems\b/gi, 'strong systems');
  result = result.replace(/\bsolid analytics\b/gi, 'strong analytics');

  // "lasting growth" is OK but "lasting outcomes" → "long-term outcomes"
  result = result.replace(/\blasting outcomes\b/gi, 'long-term outcomes');
  result = result.replace(/\blasting results\b/gi, 'long-term results');

  // ── Phase 3: Improve flow — fix robotic transitions and stiff structure ──

  // "Then, [gerund]..." at sentence start → just the gerund (remove robotic "Then")
  result = result.replace(/(?:^|\.\s+)Then,\s+([a-z])/gm, (_m, firstChar) => {
    // Preserve the sentence boundary
    const prefix = _m.startsWith('.') ? '. ' : '';
    return prefix + firstChar.toUpperCase();
  });

  // "Also, [lowercase]" at sentence start when it adds nothing
  result = result.replace(/(?:^|\.\s+)Also,\s+the\b/gm, (m) => {
    return m.replace('Also, the', 'The');
  });

  // ── Phase 4: Tone consistency ──

  if (isFormal) {
    // In formal text, "Groups" acting as subject → "Organizations"
    // Matches at sentence start, after period, or after comma (e.g. "Worth noting, groups must")
    result = result.replace(/\bGroups\s+(that|must|have|are|were|will|can|should|need|which|who)\b/g,
      (m) => m.replace('Groups', 'Organizations'));
    result = result.replace(/\bgroups\s+(that|must|have|are|were|will|can|should|need|which|who)\b/g,
      (m) => m.replace('groups', 'organizations'));

    // "handle complex" → "manage complex" in formal register
    result = result.replace(/\bhandle complex\b/gi, 'manage complex');
    result = result.replace(/\bhandle regulatory\b/gi, 'manage regulatory');
    result = result.replace(/\bhandle the complex\b/gi, 'manage the complex');

    // "It is imperative that" → "It is essential that" (still formal but less AI-like)
    result = result.replace(/\bIt is imperative that\b/g, 'It is essential that');

    // "showed" → "demonstrated" in formal academic context where it follows "studies"
    result = result.replace(/\bstudies have shown\b/gi, 'studies have demonstrated');
  } else {
    // In informal text, "It is imperative that" → "It's important that"
    result = result.replace(/\bIt is imperative that\b/g, "It's important that");
  }

  // ── Phase 5: Light humanization (subtle, low frequency) ──

  // "It should be noted that" → "Worth noting," (if it survived)
  result = result.replace(/\bIt should be noted that\b/gi, 'Worth noting,');

  // Contracted forms in informal or mixed text (makes it sound more human)
  if (!isFormal) {
    result = result.replace(/\bIt is important\b/g, "It's important");
    result = result.replace(/\bIt is clear\b/g, "It's clear");
    result = result.replace(/\bThat is why\b/g, "That's why");
    result = result.replace(/\bThere is no\b/g, "There's no");
  }

  // ── Phase 6: Final quality cleanup ──

  // Remove any stray spaces before punctuation (from earlier passes)
  result = result.replace(/ +([.!?,;:])/g, '$1');

  // Fix double spaces
  result = result.replace(/ {2,}/g, ' ');

  // Fix space at start/end of sentences
  result = result.replace(/\.\s{2,}/g, '. ');

  return result.trim();
}

// --- Final Pass: Sentence Integrity ---

function fixSentenceIntegrity(text: string): string {
  // Split into paragraphs to preserve structure
  const paragraphs = text.split(/\n\n+/);

  const fixedParagraphs = paragraphs.map(para => {
    // Skip headings and code blocks
    if (para.trim().startsWith('#') || para.trim().startsWith('```')) return para;

    const sentences = splitSentences(para);
    const cleaned: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      let s = sentences[i];
      const trimmed = s.trim();

      // 1. Drop sentences that are only punctuation / whitespace
      if (/^[,;:\s]+$/.test(trimmed)) continue;

      // 2. Strip any leading punctuation (commas, semicolons, periods) from sentence start
      s = s.replace(/^\s*[,;]+\s*/, '');

      // 3. Merge fragments: if <4 words and no terminal punctuation, glue to previous sentence
      const words = s.trim().split(/\s+/).filter(Boolean);
      if (words.length < 4 && !/[.!?]$/.test(trimmed) && cleaned.length > 0) {
        // Append to previous sentence with a comma
        cleaned[cleaned.length - 1] = cleaned[cleaned.length - 1].trimEnd().replace(/[.!?]\s*$/, '') + ', ' + s.trim().replace(/^[a-z]/, c => c.toLowerCase()) + '. ';
        continue;
      }

      // 4. Ensure sentence starts with a capital letter
      s = s.replace(/^(\s*)([a-z])/, (_m, space, c) => space + c.toUpperCase());

      // 5. Fix "a [vowel-word]" → "an [vowel-word]"
      s = s.replace(/\b(a)\s+([aeiouAEIOU]\w)/g, (_m, _a, rest) => `an ${rest}`);

      cleaned.push(s);
    }

    // 6. Ensure the very first sentence of the paragraph is capitalized
    if (cleaned.length > 0) {
      cleaned[0] = cleaned[0].replace(/^(\s*)([a-z])/, (_m, space, c) => space + c.toUpperCase());
    }

    return cleaned.join('');
  });

  let result = fixedParagraphs.join('\n\n');

  // 7. Global sweep: any remaining sentence-start lowercase after . ! ?
  result = result.replace(/([.!?]\s+)([a-z])/g, (_m, punct, c) => punct + c.toUpperCase());

  // 8. Global sweep: remove leading commas/semicolons at paragraph/line start
  result = result.replace(/^[,;]+\s*/gm, '');

  // 9. Ensure document starts with a capital
  result = result.replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase());

  return result.replace(/ {2,}/g, ' ').trim();
}

// --- Orchestrator ---

type PassFn = (text: string) => string | Promise<string>;

export async function humanizeText(
  text: string,
  settings: HumanizerSettings,
  onPassComplete?: (step: number) => void
): Promise<HumanizerResult> {
  const passes: { name: string; fn: PassFn }[] = [
    { name: 'Removing artifacts...', fn: removeChatbotArtifacts },
    { name: 'Replacing vocabulary...', fn: replaceAIVocab },
    { name: 'Applying dynamic synonyms...', fn: applyDynamicSynonyms },
    { name: 'Fixing formatting...', fn: fixFormatting },
    { name: 'Fixing language patterns...', fn: fixLanguagePatterns },
    { name: 'Removing preambles...', fn: removePreambles },
    { name: 'Fixing morphology...', fn: morphologyCorrection },
    { name: 'Diversifying n-grams...', fn: diversifyNgrams },
    { name: 'Diversifying sentence starters...', fn: diversifySentenceStarters },
    { name: 'Restructuring sentences...', fn: (t) => mergeShortSentences(varyOpeners(breakLongSentences(t))) },
    { name: 'Engineering burstiness...', fn: (t) => engineerBurstiness(t, settings.burstinessMode) },
    { name: 'Injecting variety...', fn: perplexityInjection },
    { name: 'Adding natural flow...', fn: semanticNonLinearity },
    { name: 'Diversifying punctuation...', fn: diversifyPunctuation },
    { name: 'Cleaning adverbs...', fn: cleanupAdverbs },
    { name: 'Validating semantics...', fn: semanticValidation },
    { name: 'Checking naturalness...', fn: naturalnessCheck },
    { name: 'Fixing sentence integrity...', fn: fixSentenceIntegrity },
    { name: 'Refining natural tone...', fn: refineNaturalTone },
    { name: 'Injecting imperfections...', fn: (t) => injectImperfections(t, settings.imperfectionLevel) },
  ];

  const results: PassResult[] = [];
  let currentText = text;

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    onPassComplete?.(i);

    // Yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 150));

    const before = currentText;
    currentText = await pass.fn(currentText);
    currentText = cleanExtraSpaces(currentText);

    results.push({
      passName: pass.name,
      text: currentText,
      changesCount: countDiff(before, currentText),
    });
  }

  onPassComplete?.(passes.length);

  // Random Spacing — runs AFTER all passes, outside the loop.
  // Only fires if the user explicitly enabled it. Independent of AI detection.
  if (settings.randomSpacingEnabled) {
    currentText = applyRandomSpacing(currentText, settings.randomSpacingIntensity);
  }

  return {
    originalText: text,
    finalText: currentText,
    passes: results,
    totalChanges: results.reduce((sum, r) => sum + r.changesCount, 0),
  };
}
