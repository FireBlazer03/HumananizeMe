import { preserveCase, splitSentences } from './humanizer-helpers';

// --- Pass: Semantic Validation ---

const REDUNDANCY_PATTERNS: [RegExp, string][] = [
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
  [/\bvery\s+very\b/gi, 'very'],
  [/\bgreatly\s+greatly\b/gi, 'greatly'],
  [/\breally\s+really\b/gi, 'really'],
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

const BAD_SUBSTITUTION_FIXES: [RegExp, string][] = [
  [/\bplanned\s+desegregation\b/gi, 'strategic integration'],
  [/\bit is must\b/gi, 'it is important'],
  [/\bis must that\b/gi, 'is important that'],
  [/\.\s*On top of that\.\s*/g, '. '],
  [/\.\s*Also\.\s*/g, '. '],
  [/\.\s*Even so\.\s*/g, '. '],
  [/\.\s*Still\.\s*/g, '. '],
  [/\.\s*Then\.\s*/g, '. '],
  [/\.\s*So\.\s*/g, '. '],
  [/\.{2,}/g, '.'],
  [/\.\s+\./g, '.'],
];

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

export function semanticValidation(text: string): string {
  let result = text;
  for (const [pattern, fix] of BAD_SUBSTITUTION_FIXES) result = result.replace(pattern, fix);
  for (const [pattern, fix] of UNNATURAL_COMBOS) result = result.replace(pattern, fix);
  for (const [pattern, fix] of REDUNDANCY_PATTERNS) result = result.replace(pattern, fix);
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Pass: Naturalness Check ---

export function naturalnessCheck(text: string): string {
  let result = text;

  result = result.replace(/\.\s+And\s+\./g, '.');
  result = result.replace(/\.\s+But\s+\./g, '.');
  result = result.replace(/\.\s+Or\s+\./g, '.');
  result = result.replace(/\s+(of|for|to|with|from|by|in|on|at)\s*\./g, '.');

  const sentences = splitSentences(result);
  const cleaned = sentences.filter(s => {
    const trimmed = s.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 2 && trimmed.replace(/[.!?,;]/g, '').length < 8) {
      if (/^[A-Z]/.test(trimmed) && trimmed.length >= 4) return true;
      return false;
    }
    return true;
  });
  result = cleaned.join('');

  result = result.replace(/\bhave showed\b/gi, 'have shown');
  result = result.replace(/\bhas showed\b/gi, 'has shown');
  result = result.replace(/\bhave shown\b/gi, 'have shown');
  result = result.replace(/\bwas showed\b/gi, 'was shown');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/,\s*\./g, '.');
  result = result.replace(/;\s*\./g, '.');
  result = result.replace(/ {2,}/g, ' ');
  return result;
}

// --- Final Polish: Refine Natural Tone ---

const FORMAL_INDICATORS = [
  'implementation', 'infrastructure', 'methodology', 'framework', 'algorithms',
  'operational', 'regulatory', 'governance', 'mechanisms', 'participants',
  'interventions', 'longitudinal', 'predisposition', 'theoretical', 'empirical',
  'socioeconomic', 'cognitive', 'organizational', 'institutional', 'analytical',
  'architecture', 'procurement', 'compliance', 'jurisdiction', 'optimization',
];

export function detectFormalRegister(text: string): boolean {
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of FORMAL_INDICATORS) {
    if (lower.includes(word)) count++;
    if (count >= 3) return true;
  }
  return false;
}

export function refineNaturalTone(text: string, isProfessional = false): string {
  let result = text;
  const isFormal = isProfessional || detectFormalRegister(result);

  result = result.replace(/\b(Each|One|A|That)\s+(complex|multifaceted|nuanced|intricate|dynamic)\s+nature\b/gi,
    (_m, _starter, adj) => `The ${adj} nature`);
  result = result.replace(/\bcareful thought of\b/gi, 'careful consideration of');
  result = result.replace(/\bcareful thought about\b/gi, 'careful thought about');
  result = result.replace(/\bthorough (angle|tack|method|fix|answer)\b/gi, 'thorough approach');
  result = result.replace(/\b(an|one) ecosystem of\b/gi, 'the ecosystem of');
  result = result.replace(/(?:^|\.\s+)One\s+(ecosystem|landscape|world|community|platform)\b/gm,
    (m) => m.replace(/One\s+/, 'The '));

  result = result.replace(/\bplanned (integration|implementation|development)\b/gi,
    (_m, noun) => `careful ${noun}`);
  result = result.replace(/\bplanned approach\b/gi, 'thoughtful approach');
  result = result.replace(/\bplanned strategy\b/gi, 'deliberate strategy');
  result = result.replace(/\bsolid governance\b/gi, 'strong governance');
  result = result.replace(/\bsolid systems\b/gi, 'strong systems');
  result = result.replace(/\bsolid analytics\b/gi, 'strong analytics');
  result = result.replace(/\blasting outcomes\b/gi, 'long-term outcomes');
  result = result.replace(/\blasting results\b/gi, 'long-term results');

  result = result.replace(/(?:^|\.\s+)Then,\s+([a-z])/gm, (_m, firstChar) => {
    const prefix = _m.startsWith('.') ? '. ' : '';
    return prefix + firstChar.toUpperCase();
  });
  result = result.replace(/(?:^|\.\s+)Also,\s+the\b/gm, (m) => m.replace('Also, the', 'The'));

  if (isFormal) {
    result = result.replace(/\bGroups\s+(that|must|have|are|were|will|can|should|need|which|who)\b/g,
      (m) => m.replace('Groups', 'Organizations'));
    result = result.replace(/\bgroups\s+(that|must|have|are|were|will|can|should|need|which|who)\b/g,
      (m) => m.replace('groups', 'organizations'));
    result = result.replace(/\bhandle complex\b/gi, 'manage complex');
    result = result.replace(/\bhandle regulatory\b/gi, 'manage regulatory');
    result = result.replace(/\bhandle the complex\b/gi, 'manage the complex');
    result = result.replace(/\bIt is imperative that\b/g, 'It is essential that');
    result = result.replace(/\bstudies have shown\b/gi, 'studies have demonstrated');
  } else {
    result = result.replace(/\bIt is imperative that\b/g, "It's important that");
  }

  result = result.replace(/\bIt should be noted that\b/gi, 'Worth noting,');

  if (!isFormal) {
    result = result.replace(/\bIt is important\b/g, "It's important");
    result = result.replace(/\bIt is clear\b/g, "It's clear");
    result = result.replace(/\bThat is why\b/g, "That's why");
    result = result.replace(/\bThere is no\b/g, "There's no");
  }

  result = result.replace(/ +([.!?,;:])/g, '$1');
  result = result.replace(/ {2,}/g, ' ');
  result = result.replace(/\.\s{2,}/g, '. ');
  return result.trim();
}

// --- Final Pass: Sentence Integrity ---

export function fixSentenceIntegrity(text: string): string {
  const paragraphs = text.split(/\n\n+/);

  const fixedParagraphs = paragraphs.map(para => {
    if (para.trim().startsWith('#') || para.trim().startsWith('```')) return para;

    const sentences = splitSentences(para);
    const cleaned: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      let s = sentences[i];
      const trimmed = s.trim();

      if (/^[,;:\s]+$/.test(trimmed)) continue;
      s = s.replace(/^\s*[,;]+\s*/, '');

      const words = s.trim().split(/\s+/).filter(Boolean);
      if (words.length < 4 && !/[.!?]$/.test(trimmed) && cleaned.length > 0) {
        cleaned[cleaned.length - 1] = cleaned[cleaned.length - 1].trimEnd().replace(/[.!?]\s*$/, '') + ', ' + s.trim().replace(/^[a-z]/, c => c.toLowerCase()) + '. ';
        continue;
      }

      s = s.replace(/^(\s*)([a-z])/, (_m, space, c) => space + c.toUpperCase());
      s = s.replace(/\b(a)\s+([aeiouAEIOU]\w)/g, (_m, _a, rest) => `an ${rest}`);
      cleaned.push(s);
    }

    if (cleaned.length > 0) {
      cleaned[0] = cleaned[0].replace(/^(\s*)([a-z])/, (_m, space, c) => space + c.toUpperCase());
    }

    return cleaned.join('');
  });

  let result = fixedParagraphs.join('\n\n');
  result = result.replace(/([.!?]\s+)([a-z])/g, (_m, punct, c) => punct + c.toUpperCase());
  result = result.replace(/^[,;]+\s*/gm, '');
  result = result.replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase());
  return result.replace(/ {2,}/g, ' ').trim();
}

// --- Final Quality Refinement ---

const FILLER_CONTRAST_SENTENCES = [
  'Then again, not everyone sees it that way.',
  "That's not the whole story, though.",
  "It's more complicated than it looks.",
  'Some would push back on this.',
  'The reality is usually messier.',
  'Not every case plays out this way.',
];

const FINAL_UNNATURAL_PHRASES: [RegExp, string][] = [
  [/\b(continuing|ongoing|continued)\s+promotion\s+of\b/gi, 'advancement of'],
  [/\bcontinuing\s+drive\s+of\b/gi, 'drive for'],
  [/\bcontinuing\s+improvement\s+of\b/gi, 'improvement of'],
  [/\bcall for\s+need(s?)\b/gi, 'require'],
  [/\bdemand\s+need(s?)\b/gi, 'need$1'],
  [/\btackle\s+deal\s+with\b/gi, 'tackle'],
  [/\bthorough\s+(angle|tack|fix|answer)\b/gi, 'thorough approach'],
  [/\bcareful\s+(angle|tack|fix|answer)\b/gi, 'careful approach'],
];

export function finalQualityRefinement(text: string, isProfessional = false): string {
  let result = text;
  const isFormal = isProfessional || detectFormalRegister(result);

  if (isFormal) {
    result = result.replace(
      /\b(groups|Groups)\s+(that|must|have|are|were|will|can|should|need|which|who)\b/g,
      (_m, g, verb) => (g[0] === 'G' ? 'Organizations' : 'organizations') + ' ' + verb,
    );
    result = result.replace(/\bgroups'\s+/g, "organizations' ");
    result = result.replace(/\bGroups'\s+/g, "Organizations' ");
    result = result.replace(/\bhandle\s+(complex\s+regulatory|regulatory\s+landscapes?|these\s+complex)\b/gi,
      (m) => m.replace(/^handle/i, (h) => h[0] === 'H' ? 'Navigate' : 'navigate'));
  }

  for (const [pattern, fix] of FINAL_UNNATURAL_PHRASES) {
    result = result.replace(pattern, (m) => preserveCase(m, fix));
  }

  for (const sentence of FILLER_CONTRAST_SENTENCES) {
    const phrase = sentence.replace(/\.$/, '');
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "[''\u2019]");
    result = result.replace(new RegExp(`\\s*${escaped}\\.\\s*`, 'g'), ' ');
    result = result.replace(
      new RegExp(`\\s*${escaped}\\s*:\\s*([a-z])`, 'g'),
      (_m, firstChar) => ' ' + firstChar.toUpperCase(),
    );
  }
  result = result.replace(/ {2,}/g, ' ').replace(/\.\s{2,}/g, '. ');

  result = result.replace(/([.!?])\s+([a-z])/g, (_m, p, c) => `${p} ${c.toUpperCase()}`);
  result = result.replace(/\.\s*\./g, '.');

  if (isProfessional) {
    result = result.replace(/(?:^|(?<=\.\s+))Honestly,\s*/gm, '');
    result = result.replace(/(?:^|(?<=\.\s+))The thing is,\s*/gm, '');
    result = result.replace(/(?:^|(?<=\.\s+))Worth noting,\s*/gm, 'Notably, ');
    result = result.replace(/(?:^|(?<=\.\s+))In practice,\s*/gm, 'In application, ');
    result = result.replace(/(?:^|(?<=\.\s+))To be fair,\s*/gm, '');
    result = result.replace(/(?:^|(?<=\.\s+))At the same time,\s*/gm, 'Simultaneously, ');
    result = result.replace(/(?:^|(?<=\.\s+))That said,\s*/gm, 'Nevertheless, ');
    result = result.replace(/\bOn top of that\b/gi, 'Additionally');
    result = result.replace(/([.!?]\s+)([a-z])/g, (_m, p, c) => `${p}${c.toUpperCase()}`);
    result = result.replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase());
    result = result.replace(/ {2,}/g, ' ');
  }

  const wordCount = result.split(/\s+/).length;
  const maxArtifacts = isProfessional ? 0 : Math.max(1, Math.round(wordCount / 120));
  const artifactCount = (result.match(/\w (?=[.,])/g) || []).length;

  if (artifactCount > maxArtifacts) {
    let kept = 0;
    const keepRate = maxArtifacts / artifactCount;
    result = result.replace(/(\w) ([.,])/g, (match, word, punct) => {
      if (kept < maxArtifacts && Math.random() < keepRate + 0.1) {
        kept++;
        return match;
      }
      return word + punct;
    });
  }

  result = result.replace(/ {2,}/g, ' ').trim();
  return result;
}
