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

// --- Orchestrator ---

type PassFn = (text: string) => string | Promise<string>;

export async function humanizeText(
  text: string,
  settings: HumanizerSettings,
  onPassComplete?: (step: number) => void
): Promise<HumanizerResult> {
  const prof = settings.professionalMode;
  const passes: { name: string; fn: PassFn }[] = [
    { name: 'Removing artifacts...', fn: removeChatbotArtifacts },
    { name: 'Replacing vocabulary...', fn: replaceAIVocab },
    { name: 'Applying dynamic synonyms...', fn: applyDynamicSynonyms },
    { name: 'Fixing formatting...', fn: fixFormatting },
    { name: 'Fixing language patterns...', fn: (t) => fixLanguagePatterns(t, prof) },
    { name: 'Removing preambles...', fn: removePreambles },
    { name: 'Fixing morphology...', fn: morphologyCorrection },
    { name: 'Diversifying n-grams...', fn: diversifyNgrams },
    { name: 'Diversifying sentence starters...', fn: diversifySentenceStarters },
    { name: 'Restructuring sentences...', fn: (t) => mergeShortSentences(varyOpeners(breakLongSentences(t))) },
    { name: 'Engineering burstiness...', fn: (t) => engineerBurstiness(t, settings.burstinessMode) },
    { name: 'Injecting variety...', fn: (t) => perplexityInjection(t, prof) },
    { name: 'Adding natural flow...', fn: (t) => semanticNonLinearity(t, prof) },
    { name: 'Diversifying punctuation...', fn: diversifyPunctuation },
    { name: 'Cleaning adverbs...', fn: cleanupAdverbs },
    { name: 'Validating semantics...', fn: semanticValidation },
    { name: 'Checking naturalness...', fn: naturalnessCheck },
    { name: 'Fixing sentence integrity...', fn: fixSentenceIntegrity },
    { name: 'Refining natural tone...', fn: (t) => refineNaturalTone(t, prof) },
    // In professional mode skip imperfections — clean, polished output only
    { name: 'Injecting imperfections...', fn: (t) => prof ? t : injectImperfections(t, settings.imperfectionLevel) },
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
