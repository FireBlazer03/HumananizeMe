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
