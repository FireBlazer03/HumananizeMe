// --- Helpers ---

export function preserveCase(original: string, replacement: string): string {
  if (!replacement) return replacement;
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countDiff(before: string, after: string): number {
  const bWords = before.split(/\s+/);
  const aWords = after.split(/\s+/);
  let changes = 0;
  const maxLen = Math.max(bWords.length, aWords.length);
  for (let i = 0; i < maxLen; i++) {
    if (bWords[i] !== aWords[i]) changes++;
  }
  return changes;
}

export function cleanExtraSpaces(text: string): string {
  return text.replace(/ {3,}/g, '  ').replace(/^ +/gm, '').replace(/ +$/gm, '').replace(/\n{3,}/g, '\n\n');
}

// Safe sentence splitter that preserves trailing text without punctuation
export function splitSentences(text: string): string[] {
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
export function isListDominatedText(text: string): boolean {
  const listItems = (text.match(/^\d+\./gm) || []).length + (text.match(/^[-*]\s/gm) || []).length;
  const totalLines = text.split('\n').filter(l => l.trim().length > 0).length;
  return listItems > 3 && totalLines > 0 && listItems / totalLines > 0.4;
}

// Lemma-tolerant chatbot artifact patterns. Matches the family of phrasings that
// LLMs emit (e.g., "I hope this helps", "I hope that helps", "Hopefully this helps",
// "I hope this was helpful") rather than exact-string variants that miss small edits.
// Each pattern consumes the phrase and any trailing sentence punctuation + whitespace.
export const CHATBOT_PHRASE_PATTERNS: RegExp[] = [
  /\bI\s+(?:really\s+|genuinely\s+|truly\s+)?hope\s+(?:this|that|it)\s+(?:helps|helped|was\s+helpful|is\s+helpful)\b[.!?]?\s*/gi,
  /\bHopefully\s+(?:this|that|it)\s+(?:helps|helped|was\s+helpful)\b[.!?]?\s*/gi,
  /\b(?:Please\s+)?Let\s+me\s+know\s+if\s+you\s+have\s+(?:any\s+)?(?:other\s+|more\s+|further\s+)?questions?\b[.!?]?\s*/gi,
  /\bFeel\s+free\s+to\s+ask\b[.!?]?\s*/gi,
  /\bWould\s+you\s+like\s+me\s+to\s+(?:expand|elaborate|go\s+deeper)\s+on\s+[^.?!]+[.?!]?\s*/gi,
  /\bAs\s+of\s+my\s+(?:knowledge\s+)?(?:cutoff|last\s+update)\b[^.!?]*[.!?]?\s*/gi,
  /\bWhile\s+specific\s+details\s+are\s+limited\s+in\s+available\s+sources\b[^.!?]*[.!?]?\s*/gi,
  /\bBased\s+on\s+(?:the\s+)?available\s+information\b[^.!?]*[.!?]?\s*/gi,
  /\bIt\s+is\s+(?:important|worth|essential|crucial)\s+to\s+note\s+that\s*/gi,
  /\bIt\s+goes\s+without\s+saying\s+that\s*/gi,
  /\bNeedless\s+to\s+say\b[,.]?\s*/gi,
  /\bIn\s+conclusion\b[,.]?\s*/gi,
  /\bTo\s+summari[sz]e\b[,.]?\s*/gi,
  /\bAs\s+we\s+look\s+to\s+the\s+future\b[,.]?\s*/gi,
  /\bThe\s+future\s+looks\s+bright\b[.!?]?\s*/gi,
  /\bExciting\s+times\s+lie\s+ahead\b[.!?]?\s*/gi,
  /\bThis\s+represents\s+a\s+major\s+step\s+in\s+the\s+right\s+direction\b[.!?]?\s*/gi,
  /\b(?:Of\s+course|Certainly|Absolutely)!+\s*/gi,
  /\bGreat\s+question!+\s*/gi,
  /\bYou(?:'|\u2019)?re\s+absolutely\s+right!+\s*/gi,
  /\bHere\s+is\s+(?:an\s+overview|a\s+summary)\s+of\b[^.!?]*[.!?]?\s*/gi,
];

// Kept for backwards compatibility with any external consumer. Unused internally.
export const CHATBOT_PHRASES = [
  "I hope this helps",
  "Let me know if you have any questions",
  "Of course!",
  "Certainly!",
  "Great question!",
  "You're absolutely right!",
  "Here is an overview of",
  "Here is a summary of",
  "Would you like me to expand on any section?",
  "Feel free to ask",
  "As of my knowledge cutoff",
  "It is important to note that",
  "Needless to say",
  "In conclusion",
  "To summarize",
  "The future looks bright",
  "Exciting times lie ahead",
  "This represents a major step in the right direction",
];
