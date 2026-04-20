// lexicalCadenceShaping — structure-preserving paraphrase pass.
//
// After vocabulary is humanized, sentence-rhythm repetition is the strongest
// remaining detector signal. This pass identifies clusters of sentences that
// share the same function-word skeleton and rewrites later members of each
// cluster with an attested paraphrase (adverbial-front, copula-demotion,
// explicit-agent promotion, hedge-to-finite). Each rewrite is a pure regex
// transform over the masked text — invariants are preserved by the upstream
// sentinel masking, and the SafetyGuard wrapper reverts any rewrite that
// fails the invariant checks at the orchestrator layer.

import { splitSentences } from './humanizer-helpers';
import { rng } from './rng';

// Function-word set used to build sentence "skeletons". Content words get
// collapsed to "#" so that two sentences with different nouns/verbs but the
// same grammatical shape land in the same cluster.
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'as', 'that', 'this', 'these', 'those', 'it', 'its',
  'i', 'you', 'he', 'she', 'we', 'they', 'them', 'his', 'her', 'their', 'our',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can',
  'could', 'may', 'might', 'must', 'should', 'shall',
  'not', 'no', 'if', 'then', 'so', 'than', 'when', 'while', 'because',
  'since', 'although', 'however', 'therefore', 'through', 'into', 'over', 'under',
]);

function skeleton(sentence: string): string {
  const tokens = sentence.toLowerCase().trim().match(/[a-z']+/g) || [];
  return tokens.map(t => (FUNCTION_WORDS.has(t) ? t : '#')).slice(0, 12).join(' ');
}

function editDistance(a: string, b: string): number {
  const aTok = a.split(' ');
  const bTok = b.split(' ');
  const m = aTok.length;
  const n = bTok.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aTok[i - 1] === bTok[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ──────────────────────────────────────────────────────────────────────────────
// Paraphrase transforms — each returns null when not applicable.
// ──────────────────────────────────────────────────────────────────────────────

// "X does Y in Z." → "In Z, X does Y."
function frontShiftAdverbial(sentence: string): string | null {
  const m = sentence.match(/^(.+?)\s+(in|on|at|within|across|during|after|before)\s+([^,.;:!?]+)([.!?])\s*$/i);
  if (!m) return null;
  const [, head, prep, tail, punct] = m;
  if (head.split(/\s+/).length < 4) return null;
  if (tail.split(/\s+/).length > 6) return null;
  const lowerHead = head.charAt(0).toLowerCase() + head.slice(1);
  const cap = prep.charAt(0).toUpperCase() + prep.slice(1);
  return `${cap} ${tail.trim()}, ${lowerHead}${punct}`;
}

// "X is a Y that Z." → "X, a Y, Z."
function demoteCopula(sentence: string): string | null {
  const m = sentence.match(/^(.+?)\s+is\s+an?\s+([^,.;:!?]+?)\s+that\s+(.+)$/i);
  if (!m) return null;
  const [, subj, role, rest] = m;
  if (subj.split(/\s+/).length > 6) return null;
  if (role.split(/\s+/).length > 4) return null;
  return `${subj}, a ${role}, ${rest}`;
}

// "A was Yed by B." → "B Yed A." — requires explicit agent.
function promoteExplicitAgent(sentence: string): string | null {
  const m = sentence.match(/^(.+?)\s+(?:was|were)\s+(\w+ed)\s+by\s+([^,.;:!?]+)([.!?])\s*$/i);
  if (!m) return null;
  const [, patient, verb, agent, punct] = m;
  if (patient.split(/\s+/).length > 8) return null;
  if (agent.split(/\s+/).length > 4) return null;
  const lowerPatient = patient.charAt(0).toLowerCase() + patient.slice(1);
  const cap = agent.trim().charAt(0).toUpperCase() + agent.trim().slice(1);
  return `${cap} ${verb} ${lowerPatient}${punct}`;
}

// "X might be considered Y." → "X might count as Y."
// Swaps "considered" for "count as" only — tiny register lift, no meaning shift.
function hedgeToFinite(sentence: string): string | null {
  const m = sentence.match(/\b(might|may|could)\s+be\s+considered\b/i);
  if (!m) return null;
  return sentence.replace(/\b(might|may|could)\s+be\s+considered\b/i, (_, mod) => `${mod} count as`);
}

const TRANSFORMS: Array<(s: string) => string | null> = [
  frontShiftAdverbial,
  demoteCopula,
  promoteExplicitAgent,
  hedgeToFinite,
];

// ──────────────────────────────────────────────────────────────────────────────
// Pass entrypoint
// ──────────────────────────────────────────────────────────────────────────────

export function lexicalCadenceShaping(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const out: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('```')) {
      out.push(para);
      continue;
    }

    const sentences = splitSentences(para);
    if (sentences.length < 3) {
      out.push(para);
      continue;
    }

    const skeletons = sentences.map(s => skeleton(s));

    // Cluster sentences whose skeletons are within edit-distance 2 of each other.
    // First member of each cluster is kept as-is; later members are candidates.
    const clusterFirst: number[] = [];
    const inCluster: boolean[] = new Array(sentences.length).fill(false);
    for (let i = 0; i < sentences.length; i++) {
      if (inCluster[i]) continue;
      clusterFirst.push(i);
      for (let j = i + 1; j < sentences.length; j++) {
        if (inCluster[j]) continue;
        if (editDistance(skeletons[i], skeletons[j]) <= 2) {
          inCluster[j] = true;
        }
      }
    }

    // Rewrite later cluster members. Only attempt at ~50% rate to preserve
    // cadence variety — a pass that rewrites every repeat would itself become
    // a signal.
    const rewritten = [...sentences];
    for (let j = 0; j < sentences.length; j++) {
      if (clusterFirst.includes(j)) continue;
      if (!inCluster[j]) continue;
      if (rng() > 0.5) continue;
      const sentence = sentences[j];
      const trailing = sentence.match(/\s*$/)?.[0] ?? '';
      const core = sentence.replace(/\s*$/, '');
      const shuffled = [...TRANSFORMS].sort(() => rng() - 0.5);
      for (const fn of shuffled) {
        const result = fn(core);
        if (result && result !== core) {
          rewritten[j] = result + trailing;
          break;
        }
      }
    }

    out.push(rewritten.join(''));
  }

  return out.join('\n\n');
}
