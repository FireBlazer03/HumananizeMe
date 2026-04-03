import { HumanizerSettings, HumanizerResult, PassResult, BurstinessMode } from '@/types';
import { vocabReplacements } from './vocabMap';
import { injectImperfections } from './imperfections';
import { applyDynamicSynonyms } from './synonyms';

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

// --- Pass 5: Structural Burstiness Engineering ---

function engineerBurstiness(text: string, mode: BurstinessMode): string {
  const isList = isListDominatedText(text);
  const paragraphs = text.split(/\n\n+/);
  const processedParagraphs: string[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    // Skip headings, code blocks
    if (para.trim().startsWith('#') || para.trim().startsWith('```')) {
      processedParagraphs.push(para);
      continue;
    }

    // For list-dominated text, process individual list items
    if (isList && /^\d+\.\s|^[-*]\s/.test(para.trim())) {
      // Vary the list item descriptions: some get shortened, some get a parenthetical
      const lines = para.split('\n');
      const processed = lines.map((line, idx) => {
        const listMatch = line.match(/^(\d+\.\s+|[-*]\s+)(.+)/);
        if (!listMatch) return line;
        const [, prefix, content] = listMatch;
        const words = content.split(/\s+/);

        if (mode === 'aggressive' && idx % 3 === 2 && words.length > 8) {
          // Shorten every 3rd item aggressively
          return prefix + words.slice(0, Math.ceil(words.length * 0.6)).join(' ') + '.';
        }
        if ((mode === 'strong' || mode === 'aggressive') && idx % 4 === 1 && words.length > 5) {
          // Add a brief parenthetical aside to every 4th item
          const insertAt = Math.min(4, words.length - 1);
          words.splice(insertAt, 0, '(when needed)');
          return prefix + words.join(' ');
        }
        return line;
      });
      processedParagraphs.push(processed.join('\n'));
      continue;
    }

    // Skip simple lists
    if (para.trim().startsWith('-') || /^\d+\./.test(para.trim())) {
      processedParagraphs.push(para);
      continue;
    }

    let sentences = splitSentences(para);

    // Calculate average sentence length and variance
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const paraVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;

    // LOW-VARIANCE INTERVENTION: if variance < 12 and we have enough sentences,
    // force-create length diversity by merging a pair AND splitting another.
    if (paraVariance < 12 && sentences.length >= 5 && mode !== 'mild') {
      // Step A: Merge sentences at index 1+2 into one long sentence
      const mergeIdx = 1;
      if (mergeIdx + 1 < sentences.length) {
        const s1 = sentences[mergeIdx].trim().replace(/[.!?]\s*$/, '');
        const s2 = sentences[mergeIdx + 1].trim();
        const s2lower = s2.charAt(0).toLowerCase() + s2.slice(1);
        sentences[mergeIdx] = s1 + ', and ' + s2lower + ' ';
        sentences.splice(mergeIdx + 1, 1);
      }

      // Step B: Find the longest remaining sentence and split it if it has a comma
      let longestIdx = 0;
      let longestLen = 0;
      for (let k = 0; k < sentences.length; k++) {
        const wl = sentences[k].trim().split(/\s+/).length;
        if (wl > longestLen && k !== mergeIdx) { longestLen = wl; longestIdx = k; }
      }
      const ls = sentences[longestIdx].trim();
      // Try comma split (creates a natural short sentence before comma)
      const commaIdx = ls.indexOf(',');
      if (commaIdx > 0 && ls.slice(0, commaIdx).split(/\s+/).length >= 5) {
        const before = ls.slice(0, commaIdx).trim() + '.';
        const after = ls.slice(commaIdx + 1).trim();
        const afterCapped = after.charAt(0).toUpperCase() + after.slice(1);
        sentences[longestIdx] = before + ' ' + afterCapped + ' ';
      }
    }

    // Find flat zone sentences (within 2 words of average)
    const interval = mode === 'mild' ? 8 : mode === 'strong' ? 4 : 3;

    const newSentences: string[] = [];
    let flatCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const len = sentences[i].trim().split(/\s+/).length;
      const inFlatZone = Math.abs(len - avg) <= 2;

      if (inFlatZone) {
        flatCount++;
        if (flatCount % interval === 0 && len >= 15) {
          // Split at conjunction
          const conjunctions = [', and ', ', but ', '; '];
          let didSplit = false;
          for (const conj of conjunctions) {
            const idx = sentences[i].indexOf(conj);
            if (idx > 0) {
              const first = sentences[i].slice(0, idx).trim() + '.';
              let second = sentences[i].slice(idx + conj.length).trim();
              second = second.charAt(0).toUpperCase() + second.slice(1);
              if (!second.match(/[.!?]\s*$/)) second += '.';
              newSentences.push(first + ' ');

              if (mode === 'strong' || mode === 'aggressive') {
                // Insert a punchy follow-up
                const words = second.split(/\s+/);
                if (words.length > 3) {
                  const punchy = words.slice(0, 2).join(' ').replace(/[.,;:]$/, '') + '.';
                  newSentences.push(punchy + ' ');
                }
              }
              newSentences.push(second + ' ');
              didSplit = true;
              break;
            }
          }
          if (!didSplit) {
            newSentences.push(sentences[i]);
          }
        } else {
          newSentences.push(sentences[i]);
        }
      } else {
        newSentences.push(sentences[i]);
      }
    }

    sentences = newSentences;

    // Strong/aggressive: collapse adjacent short sentences (30% chance)
    // For low-variance paragraphs raise the threshold so medium-length sentences also merge
    const collapseThresh = paraVariance < 12 ? 16 : 8;
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

  // Aggressive: move last sentence to its own paragraph every 5th paragraph
  if (mode === 'aggressive') {
    const final: string[] = [];
    for (let i = 0; i < processedParagraphs.length; i++) {
      if ((i + 1) % 5 === 0) {
        const para = processedParagraphs[i];
        const sents = splitSentences(para);
        if (sents.length > 2) {
          const last = sents.pop()!;
          final.push(sents.join('').trim());
          final.push(last.trim());
        } else {
          final.push(para);
        }
      } else {
        final.push(processedParagraphs[i]);
      }
    }
    return final.join('\n\n');
  }

  let result = processedParagraphs.join('\n\n');

  // Active voice conversion (heuristic)
  result = result.replace(
    /\b(The\s+\w+)\s+(was|were|is|are|been)\s+(\w+ed)\s+by\s+([\w\s]+?)([.,;!?])/gi,
    (_match, _subject, _aux, verb, agent, punct) => {
      const cleanAgent = agent.trim();
      const activeVerb = verb.replace(/ed$/, 'ed');
      return `${cleanAgent} ${activeVerb} ${_subject.toLowerCase()}${punct}`;
    }
  );

  // Syntactic parallelism disruption in lists
  const lines = result.split('\n');
  let gerundRun: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^[-*]\s+\w+ing\b/.test(lines[i].trim())) {
      gerundRun.push(i);
    } else {
      if (gerundRun.length >= 4) {
        for (const pos of [1, 3]) {
          if (pos < gerundRun.length) {
            const lineIdx = gerundRun[pos];
            const line = lines[lineIdx];
            const m = line.match(/^([-*]\s+)(\w+ing)\s+(.+)/);
            if (m) {
              const [, bullet, gerund, rest] = m;
              if (pos === 1) {
                const noun = gerund.replace(/ing$/, '') + 'tion';
                lines[lineIdx] = `${bullet}${rest.charAt(0).toUpperCase() + rest.slice(1)} ${noun.toLowerCase()}`;
              } else {
                lines[lineIdx] = `${bullet}Use ${rest}`;
              }
            }
          }
        }
      }
      gerundRun = [];
      if (/^[-*]\s+\w+ing\b/.test(lines[i].trim())) {
        gerundRun.push(i);
      }
    }
  }
  result = lines.join('\n');

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
    { name: 'Restructuring sentences...', fn: (t) => mergeShortSentences(varyOpeners(breakLongSentences(t))) },
    { name: 'Engineering burstiness...', fn: (t) => engineerBurstiness(t, settings.burstinessMode) },
    { name: 'Cleaning adverbs...', fn: cleanupAdverbs },
    { name: 'Fixing sentence integrity...', fn: fixSentenceIntegrity },
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

  return {
    originalText: text,
    finalText: currentText,
    passes: results,
    totalChanges: results.reduce((sum, r) => sum + r.changesCount, 0),
  };
}
