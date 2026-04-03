import { DetectionReport, SignalBreakdown } from '@/types';

// --- Safe sentence splitter that preserves trailing text ---

function splitSentences(text: string): string[] {
  const parts: string[] = [];
  const regex = /[^.!?]+[.!?]+\s*/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    parts.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// --- Signal 1: Sentence Length Variance ---

function calcSentenceLengthVariance(text: string): number {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length < 3) return 50;
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  return variance;
}

// --- Signal 2: Passive Voice Density ---

function calcPassiveVoiceDensity(text: string): { count: number; density: number } {
  const passiveRegex = /\b(was|were|is|are|been|being|be)\s+\w+ed\b/gi;
  const matches = text.match(passiveRegex) || [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const density = sentences.length > 0 ? (matches.length / sentences.length) * 100 : 0;
  return { count: matches.length, density };
}

// --- Signal 3: Transition Word Density ---

const TRANSITION_WORDS = [
  'furthermore', 'moreover', 'consequently', 'subsequently', 'additionally',
  'nevertheless', 'nonetheless', 'therefore', 'thus', 'hence',
  'in addition', 'in conclusion', 'to summarize', 'in summary',
  'as a result', 'on the other hand', 'in contrast', 'for instance',
  'for example', 'in particular', 'specifically', 'notably',
  'importantly', 'significantly', 'essentially', 'fundamentally',
  'ultimately', 'overall', 'in terms of', 'with regard to',
  'it is worth noting', 'it should be noted', 'it is important to',
];

function countTransitionWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const tw of TRANSITION_WORDS) {
    const regex = new RegExp(`\\b${tw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

// --- Signal 4: Expanded AI Vocabulary ---

const AI_VOCAB_TIER1 = [
  'delve', 'tapestry', 'spearhead', 'embark', 'testament', 'pivotal',
  'leverage', 'synergy', 'paradigm', 'holistic', 'robust', 'seamless',
  'cutting-edge', 'state-of-the-art', 'groundbreaking', 'innovative',
  'transformative', 'revolutionary', 'unprecedented', 'game-changing',
  'vibrant', 'bustling', 'nestled', 'breathtaking', 'stunning',
  'foster', 'cultivate', 'nurture', 'elevate', 'empower',
  'streamline', 'optimize', 'maximize', 'enhance',
];

const AI_VOCAB_TIER2 = [
  'crucial', 'vital', 'essential', 'paramount', 'imperative',
  'comprehensive', 'multifaceted', 'multidimensional', 'nuanced',
  'intricate', 'sophisticated', 'dynamic', 'diverse',
  'inclusive', 'equitable', 'sustainable', 'scalable', 'agile',
  'proactive', 'strategic', 'actionable', 'impactful', 'meaningful',
  'significant', 'substantial', 'considerable', 'remarkable', 'notable',
  'landscape', 'ecosystem', 'framework', 'methodology',
  'stakeholder', 'deliverable', 'bandwidth', 'deep dive', 'circle back',
  'touch base', 'move the needle', 'low-hanging fruit',
  'thought leader', 'best practice', 'value-add', 'pain point',
  'utilize', 'facilitate', 'implement', 'execute',
  'garner', 'ascertain', 'endeavor', 'commence', 'procure',
  'elucidate', 'delineate', 'promulgate', 'ameliorate', 'exacerbate',
];

const AI_VOCAB_TIER3 = [
  'furthermore', 'moreover', 'consequently', 'subsequently', 'additionally',
  'nevertheless', 'nonetheless', 'therefore', 'thus', 'hence',
  'underscores', 'highlights', 'showcases', 'demonstrates', 'illustrates',
  'reflects', 'symbolizes', 'embodies', 'exemplifies', 'represents',
  'stands as', 'serves as', 'functions as', 'acts as',
  'aligns with', 'resonates with', 'speaks to', 'points to',
  'in terms of', 'with regard to', 'in light of', 'given that',
  'it is worth noting', 'it should be noted', 'it is important',
  'as mentioned', 'as noted', 'as discussed', 'as outlined',
  'moving forward', 'going forward', 'looking ahead', 'in the future',
  "in today's world", 'in the modern era', 'in recent years',
  'across the board', 'at the end of the day', 'in the grand scheme',
];

function countAIVocab(text: string): { score: number; hits: string[] } {
  const lower = text.toLowerCase();
  let score = 0;
  const hits: string[] = [];

  const check = (words: string[], points: number) => {
    for (const word of words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lower)) {
        score += points;
        hits.push(word);
      }
    }
  };

  check(AI_VOCAB_TIER1, 3);
  check(AI_VOCAB_TIER2, 2);
  check(AI_VOCAB_TIER3, 1);

  return { score: Math.min(score, 40), hits };
}

// --- Signal 5: Structural Patterns ---

function checkParagraphSymmetry(text: string): number {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
  if (paragraphs.length < 2) return 0;
  const lengths = paragraphs.map(p => p.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  return variance < 200 ? 10 : 0;
}

function checkRuleOfThree(text: string): number {
  const matches = text.match(/\w+,\s*\w+,\s*and\s*\w+/gi) || [];
  return matches.length > 2 ? 8 : matches.length > 0 ? 4 : 0;
}

function checkEmDashOveruse(text: string): number {
  const count = (text.match(/\u2014/g) || []).length;
  return count > 4 ? 8 : count > 2 ? 4 : 0;
}

function checkNumberedLists(text: string): number {
  const numberedItems = text.match(/^\d+\.\s/gm) || [];
  return numberedItems.length > 5 ? 8 : numberedItems.length > 3 ? 4 : 0;
}

function checkNegativeParallelism(text: string): number {
  const patterns = [
    /it'?s not just.+it'?s/gi,
    /not merely.+but/gi,
    /not only.+but also/gi,
    /not about.+it'?s about/gi,
  ];
  const found = patterns.filter(p => p.test(text)).length;
  return found * 5;
}

function checkFormalStarters(text: string): number {
  const formalStarters = [
    /^in (order|addition|conclusion|summary|terms|light|contrast)/gim,
    /^(furthermore|moreover|consequently|subsequently|additionally|nevertheless)/gim,
    /^(it is|there are|there is|this is|these are) (important|crucial|worth|essential)/gim,
    /^(when considering|upon examination|taking into account)/gim,
  ];
  const count = formalStarters.reduce((sum, r) => sum + (text.match(r) || []).length, 0);
  return Math.min(count * 3, 15);
}

// --- Signal 6: Average Word Length ---

function calcAvgWordLength(text: string): number {
  const words = text.match(/\b[a-zA-Z]+\b/g) || [];
  if (words.length === 0) return 0;
  return words.reduce((sum, w) => sum + w.length, 0) / words.length;
}

// --- Chatbot artifact detection ---

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

// --- Main detection function ---

export function detectAIPatterns(text: string): DetectionReport {
  const lower = text.toLowerCase();
  const signals: SignalBreakdown[] = [];

  // Signal 1: Sentence length variance (most important, up to 35pts)
  const variance = calcSentenceLengthVariance(text);
  let varianceScore = 0;
  let varianceDetail = '';
  if (variance < 8) { varianceScore = 35; varianceDetail = `Very uniform (${variance.toFixed(1)}) - strong AI signal`; }
  else if (variance < 15) { varianceScore = 20; varianceDetail = `Low variance (${variance.toFixed(1)}) - likely AI`; }
  else if (variance < 25) { varianceScore = 10; varianceDetail = `Moderate variance (${variance.toFixed(1)})`; }
  else if (variance > 40) { varianceScore = -10; varianceDetail = `High variance (${variance.toFixed(1)}) - human-like`; }
  else { varianceDetail = `Normal variance (${variance.toFixed(1)})`; }
  signals.push({ name: 'Sentence Variance', score: varianceScore, maxScore: 35, detail: varianceDetail });

  // Signal 2: Passive voice density (up to 15pts)
  const { count: passiveCount, density: passiveDensity } = calcPassiveVoiceDensity(text);
  let passiveScore = 0;
  if (passiveDensity > 40) passiveScore = 15;
  else if (passiveDensity > 25) passiveScore = 8;
  signals.push({ name: 'Passive Voice', score: passiveScore, maxScore: 15, detail: `${passiveDensity.toFixed(0)}% of sentences (${passiveCount} found)` });

  // Signal 3: Transition word density (up to 15pts)
  const transitionCount = countTransitionWords(text);
  let transitionScore = 0;
  if (transitionCount > 5) transitionScore = 15;
  else if (transitionCount > 3) transitionScore = 8;
  else if (transitionCount > 1) transitionScore = 4;
  signals.push({ name: 'Transition Words', score: transitionScore, maxScore: 15, detail: `${transitionCount} found` });

  // Signal 4: AI vocabulary (up to 40pts)
  const { score: vocabScore, hits: aiVocabHits } = countAIVocab(text);
  signals.push({ name: 'AI Vocabulary', score: vocabScore, maxScore: 40, detail: `${aiVocabHits.length} terms found` });

  // Signal 5: Structural patterns (up to ~50pts combined)
  const symScore = checkParagraphSymmetry(text);
  const ruleOf3Score = checkRuleOfThree(text);
  const emDashScore = checkEmDashOveruse(text);
  const numberedScore = checkNumberedLists(text);
  const negParScore = checkNegativeParallelism(text);
  const formalScore = checkFormalStarters(text);
  const structuralTotal = symScore + ruleOf3Score + emDashScore + numberedScore + negParScore + formalScore;
  signals.push({ name: 'Structural Patterns', score: structuralTotal, maxScore: 50, detail: `Symmetry:${symScore} Rule-of-3:${ruleOf3Score} Em-dash:${emDashScore} Lists:${numberedScore} Parallelism:${negParScore} Formal:${formalScore}` });

  // Signal 6: Average word length (up to 10pts)
  const avgWL = calcAvgWordLength(text);
  let wlScore = 0;
  if (avgWL > 5.5) wlScore = 10;
  else if (avgWL > 5.0) wlScore = 5;
  signals.push({ name: 'Word Complexity', score: wlScore, maxScore: 10, detail: `Avg ${avgWL.toFixed(1)} chars/word` });

  // Minor signals
  const hasEmojis = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(text);
  const hasCurlyQuotes = /[\u201C\u201D\u2018\u2019]/.test(text);
  let minorScore = 0;
  if (hasEmojis) minorScore += 5;
  if (hasCurlyQuotes) minorScore += 3;
  if (minorScore > 0) {
    signals.push({ name: 'Formatting', score: minorScore, maxScore: 8, detail: `${hasEmojis ? 'Emojis ' : ''}${hasCurlyQuotes ? 'Curly quotes' : ''}`.trim() });
  }

  // Total score
  let estimatedAIScore = signals.reduce((sum, s) => sum + s.score, 0);
  estimatedAIScore = Math.max(0, Math.min(100, estimatedAIScore));

  // Legacy fields
  const chatbotArtifacts: string[] = [];
  for (const artifact of CHATBOT_ARTIFACTS) {
    if (lower.includes(artifact.toLowerCase())) {
      chatbotArtifacts.push(artifact);
    }
  }

  let significanceInflation = 0;
  for (const phrase of SIGNIFICANCE_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      significanceInflation++;
    }
  }

  const emDashCount = (text.match(/\u2014/g) || []).length;

  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = lengths.length > 1
    ? Math.sqrt(lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length)
    : 0;
  const sentenceLengthVariance = Math.round(stdDev * 100) / 100;

  let burstinessLabel: DetectionReport['burstinessLabel'];
  if (sentenceLengthVariance < 4) burstinessLabel = 'Low (AI-like)';
  else if (sentenceLengthVariance < 8) burstinessLabel = 'Medium';
  else burstinessLabel = 'High';

  return {
    aiVocabHits,
    chatbotArtifacts,
    significanceInflation,
    emDashCount,
    sentenceLengthVariance,
    burstinessLabel,
    passiveVoiceCount: passiveCount,
    hasEmojis,
    hasCurlyQuotes,
    estimatedAIScore,
    signals,
  };
}
