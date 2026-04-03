import { DetectionReport } from '@/types';
import { vocabReplacements } from './vocabMap';

const CHATBOT_ARTIFACTS = [
  "i hope this helps",
  "let me know if you have any questions",
  "of course!",
  "certainly!",
  "great question!",
  "you're absolutely right!",
  "here is an overview of",
  "here is a summary of",
  "would you like me to expand on any section",
  "feel free to ask",
  "as of my knowledge cutoff",
  "while specific details are limited in available sources",
  "based on available information",
  "it is important to note that",
  "it is worth noting that",
  "needless to say",
  "it goes without saying that",
  "in conclusion,",
  "to summarize,",
  "as we look to the future,",
  "the future looks bright",
  "exciting times lie ahead",
  "this represents a major step in the right direction",
];

const SIGNIFICANCE_PHRASES = [
  "marking a pivotal moment",
  "indelible mark",
  "setting the stage for",
  "reflects broader trends",
  "key turning point",
  "evolving landscape",
  "deeply rooted in",
  "paradigm shift",
  "transformative",
  "unprecedented",
  "groundbreaking",
];

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function detectAIPatterns(text: string): DetectionReport {
  const lower = text.toLowerCase();

  // AI vocabulary hits
  const aiVocabHits: string[] = [];
  for (const [phrase] of vocabReplacements) {
    if (phrase.length < 3) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      aiVocabHits.push(phrase);
    }
  }

  // Chatbot artifacts
  const chatbotArtifacts: string[] = [];
  for (const artifact of CHATBOT_ARTIFACTS) {
    if (lower.includes(artifact.toLowerCase())) {
      chatbotArtifacts.push(artifact);
    }
  }

  // Significance inflation
  let significanceInflation = 0;
  for (const phrase of SIGNIFICANCE_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      significanceInflation++;
    }
  }

  // Em dash count
  const emDashCount = countMatches(text, /\u2014/g);

  // Sentence length variance
  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.length > 1
    ? lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length
    : 0;
  const sentenceLengthVariance = Math.round(Math.sqrt(variance) * 100) / 100;

  // Burstiness label
  let burstinessLabel: DetectionReport['burstinessLabel'];
  if (sentenceLengthVariance < 4) {
    burstinessLabel = 'Low (AI-like)';
  } else if (sentenceLengthVariance < 8) {
    burstinessLabel = 'Medium';
  } else {
    burstinessLabel = 'High';
  }

  // Passive voice
  const passiveVoiceCount = countMatches(text, /\b(was|were|is|are|been)\s+\w+ed\b/gi);

  // Emojis
  const hasEmojis = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(text);

  // Curly quotes
  const hasCurlyQuotes = /[\u201C\u201D\u2018\u2019]/.test(text);

  // Estimated AI score
  let estimatedAIScore = 0;
  estimatedAIScore += Math.min(40, aiVocabHits.length * 3);
  estimatedAIScore += Math.min(20, chatbotArtifacts.length * 5);
  if (burstinessLabel === 'Low (AI-like)') estimatedAIScore += 10;
  if (emDashCount > 3) estimatedAIScore += 5;
  if (passiveVoiceCount > 3) estimatedAIScore += 5;
  if (hasEmojis) estimatedAIScore += 5;
  if (significanceInflation > 2) estimatedAIScore += 5;
  if (hasCurlyQuotes) estimatedAIScore += 5;
  estimatedAIScore = Math.min(100, estimatedAIScore);

  return {
    aiVocabHits,
    chatbotArtifacts,
    significanceInflation,
    emDashCount,
    sentenceLengthVariance,
    burstinessLabel,
    passiveVoiceCount,
    hasEmojis,
    hasCurlyQuotes,
    estimatedAIScore,
  };
}
