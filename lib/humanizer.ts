import { HumanizerSettings, HumanizerResult, PassResult } from '@/types';
import { injectImperfections } from './imperfections';
import { applyDynamicSynonyms } from './synonyms';
import { applyRandomSpacing } from './spacing';
import { countDiff, cleanExtraSpaces } from './humanizer-helpers';
import {
  removeChatbotArtifacts,
  replaceAIVocab,
  fixFormatting,
  fixLanguagePatterns,
  engineerBurstiness,
  cleanupAdverbs,
} from './humanizer-cleanup';
import {
  removePreambles,
  morphologyCorrection,
  diversifyNgrams,
  diversifySentenceStarters,
  diversifyPunctuation,
  perplexityInjection,
  semanticNonLinearity,
  breakLongSentences,
  mergeShortSentences,
  varyOpeners,
} from './humanizer-diversity';
import {
  semanticValidation,
  naturalnessCheck,
  refineNaturalTone,
  fixSentenceIntegrity,
  finalQualityRefinement,
} from './humanizer-validation';
import { lexicalCadenceShaping } from './humanizer-cadence';
import { setActiveRng } from './rng';
import {
  extractInvariants,
  maskProtected,
  unmaskProtected,
  validatePass,
  PassPolicy,
} from './safety-guard';

// --- Orchestrator ---

type PassFn = (text: string) => string | Promise<string>;

interface GuardedPass {
  name: string;
  fn: PassFn;
  policy: PassPolicy;
}

export async function humanizeText(
  text: string,
  settings: HumanizerSettings,
  onPassComplete?: (step: number) => void
): Promise<HumanizerResult> {
  // Thread the seeded RNG (or fall back to Math.random when no seed is set).
  setActiveRng(settings.seed);

  const prof = settings.professionalMode;
  const creative = settings.creativeRewriting !== false; // default true

  // Extract invariants ONCE from the original input. These are the facts the
  // pipeline must not alter: numbers, entities, URLs, quoted spans, negation
  // count, polarity verbs, quantifiers, and causal/conditional connectives.
  const invariants = extractInvariants(text);

  // Pass list. Each pass declares the mutations it is allowed to make — the
  // SafetyGuard reverts any pass that exceeds its policy.
  const passes: GuardedPass[] = [
    { name: 'Removing artifacts...', fn: removeChatbotArtifacts, policy: { mayMergeSentence: true } },
    { name: 'Replacing vocabulary...', fn: replaceAIVocab, policy: {} },
    { name: 'Applying dynamic synonyms...', fn: applyDynamicSynonyms, policy: {} },
    { name: 'Fixing formatting...', fn: fixFormatting, policy: { mayMergeSentence: true, maySplitSentence: true } },
    { name: 'Fixing language patterns...', fn: (t) => fixLanguagePatterns(t, prof), policy: {} },
    { name: 'Removing preambles...', fn: removePreambles, policy: { mayMergeSentence: true } },
    { name: 'Fixing morphology...', fn: morphologyCorrection, policy: {} },
    { name: 'Diversifying n-grams...', fn: diversifyNgrams, policy: {} },
    { name: 'Diversifying sentence starters...', fn: diversifySentenceStarters, policy: {} },
    { name: 'Restructuring sentences...', fn: (t) => mergeShortSentences(varyOpeners(breakLongSentences(t))), policy: { maySplitSentence: true, mayMergeSentence: true } },
    { name: 'Engineering burstiness...', fn: (t) => engineerBurstiness(t, settings.burstinessMode), policy: { maySplitSentence: true, mayMergeSentence: true } },
    { name: 'Shaping cadence...', fn: (t) => (creative ? lexicalCadenceShaping(t) : t), policy: { mayReorder: creative } },
    { name: 'Injecting variety...', fn: (t) => perplexityInjection(t, prof), policy: {} },
    { name: 'Adding natural flow...', fn: (t) => semanticNonLinearity(t, prof), policy: { mayReorder: creative } },
    { name: 'Diversifying punctuation...', fn: diversifyPunctuation, policy: { maySplitSentence: true, mayMergeSentence: true } },
    { name: 'Cleaning adverbs...', fn: cleanupAdverbs, policy: {} },
    { name: 'Validating semantics...', fn: semanticValidation, policy: {} },
    { name: 'Checking naturalness...', fn: naturalnessCheck, policy: {} },
    { name: 'Fixing sentence integrity...', fn: fixSentenceIntegrity, policy: { maySplitSentence: true, mayMergeSentence: true } },
    { name: 'Refining natural tone...', fn: (t) => refineNaturalTone(t, prof), policy: {} },
    // In professional mode skip imperfections — clean, polished output only
    { name: 'Injecting imperfections...', fn: (t) => prof ? t : injectImperfections(t, settings.imperfectionLevel), policy: {} },
  ];

  const results: PassResult[] = [];
  let currentText = text;

  // Mask invariants once before the stochastic passes and keep them masked until
  // the end of the main loop. Every pass that splits on '.!?' would otherwise
  // shatter tokens like `$1.2M`, quoted spans, and inline `code`. Late passes
  // (semanticValidation / naturalnessCheck / refineNaturalTone / integrity) only
  // scan for phrase patterns that don't collide with sentinels, so leaving the
  // mask on through those passes is safe.
  const MASK_BEFORE_PASS = 2;   // index: "Applying dynamic synonyms..."

  let restoreMap: ReturnType<typeof maskProtected>['restoreMap'] | null = null;

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    onPassComplete?.(i);

    // Yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 150));

    // Mask on entry to the synonym pass.
    if (i === MASK_BEFORE_PASS) {
      const { masked, restoreMap: rm } = maskProtected(currentText, invariants);
      currentText = masked;
      restoreMap = rm;
    }

    const before = currentText;
    let draft: string;
    try {
      draft = await pass.fn(currentText);
    } catch {
      draft = before;
    }
    draft = cleanExtraSpaces(draft);

    // SafetyGuard: revert if the pass violated any invariant.
    const verdict = validatePass(before, draft, invariants, pass.policy);
    if (verdict.ok) {
      currentText = draft;
    } else {
      currentText = before;
      if (typeof console !== 'undefined') {
        console.warn(`[safety-guard] reverted pass "${pass.name}": ${verdict.reason}`);
      }
    }

    results.push({
      passName: pass.name,
      text: currentText,
      changesCount: countDiff(before, currentText),
    });
  }

  // Unmask once all passes complete — sentinels round-trip to their original
  // numbers / entities / URLs / quotes / code spans.
  if (restoreMap) {
    currentText = unmaskProtected(currentText, restoreMap);
    restoreMap = null;
  }

  onPassComplete?.(passes.length);

  // Random Spacing — runs AFTER all passes, outside the loop.
  // Disabled in professional mode — clean spacing is part of the professional output contract.
  if (settings.randomSpacingEnabled && !prof) {
    currentText = applyRandomSpacing(currentText, settings.randomSpacingIntensity);
  }

  // Final Quality Refinement — runs LAST, after all spacing injection.
  // Removes tone downgrades, unnatural phrases, filler sentences, excess artifacts.
  // In professional mode also cleans up any casual connectives that slipped through.
  currentText = finalQualityRefinement(currentText, prof);

  return {
    originalText: text,
    finalText: currentText,
    passes: results,
    totalChanges: results.reduce((sum, r) => sum + r.changesCount, 0),
  };
}
