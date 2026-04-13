// Tone refinement test — shows BEFORE and AFTER the refineNaturalTone pass
// Usage: npx tsx scripts/tone-test.ts

// We import the full pipeline AND manually run the tone refinement
// to show the diff between pre-tone and post-tone output.

import { humanizeText } from '../lib/humanizer';
import { HumanizerSettings } from '../types';

const settings: HumanizerSettings = {
  imperfectionLevel: 'moderate',
  burstinessMode: 'strong',
  randomSpacingEnabled: false, // disabled for clean comparison
  randomSpacingIntensity: 'medium',
  professionalMode: false,
};

const TESTS = [
  {
    name: 'Test 1 — Technical/Business Text',
    text: `The strategic integration of machine learning algorithms into existing infrastructure has demonstrated significant improvements in operational efficiency. Organizations that have successfully implemented these sophisticated solutions report a 40% reduction in processing time. Furthermore, the collaborative development of these systems requires careful consideration of both technical requirements and user experience. It is important to note that the multifaceted nature of artificial intelligence implementation demands a comprehensive approach to change management. The ecosystem of tools and frameworks continues to evolve, creating new opportunities for innovation. Stakeholders must navigate complex regulatory landscapes while maintaining alignment with organizational objectives. Subsequently, the establishment of robust governance mechanisms ensures sustainable growth and equitable outcomes for all participants.`,
  },
  {
    name: 'Test 2 — Academic/Research Text',
    text: `Recent studies have demonstrated that environmental factors significantly influence cognitive development during adolescence. The relationship between socioeconomic status and academic performance has been extensively documented in longitudinal research. Researchers have identified several systemic barriers that disproportionately affect marginalized communities. These findings underscore the importance of evidence-based interventions in educational policy. The implementation of targeted support programs has shown measurable improvements in student outcomes. Additionally, the nuanced interplay between genetic predisposition and environmental stimuli continues to challenge established theoretical frameworks. It is imperative that future research adopts a more holistic methodology to capture the full complexity of developmental processes.`,
  },
];

async function run() {
  for (const test of TESTS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${test.name}`);
    console.log(`${'='.repeat(70)}`);

    console.log(`\n  ORIGINAL:`);
    console.log(`  ${test.text}\n`);

    // Run the full pipeline (which now includes refineNaturalTone)
    const result = await humanizeText(test.text, settings);

    // The passes array includes results for each step.
    // refineNaturalTone is the second-to-last pass (before imperfections).
    // The pass BEFORE it (fixSentenceIntegrity) is the "BEFORE tone" state.
    const passes = result.passes;
    const tonePassIdx = passes.findIndex(p => p.passName.includes('Refining'));
    const beforeTone = tonePassIdx > 0 ? passes[tonePassIdx - 1].text : '';
    const afterTone = tonePassIdx >= 0 ? passes[tonePassIdx].text : '';

    console.log(`  BEFORE refineNaturalTone (after fixSentenceIntegrity):`);
    console.log(`  ${beforeTone}\n`);

    console.log(`  AFTER refineNaturalTone:`);
    console.log(`  ${afterTone}\n`);

    // Show specific improvements
    console.log(`  IMPROVEMENTS:`);
    const diffs: string[] = [];

    // Split into sentences and compare
    const beforeSentences = beforeTone.split(/(?<=[.!?])\s+/);
    const afterSentences = afterTone.split(/(?<=[.!?])\s+/);

    for (let i = 0; i < Math.min(beforeSentences.length, afterSentences.length); i++) {
      if (beforeSentences[i] !== afterSentences[i]) {
        diffs.push(`    BEFORE: "${beforeSentences[i].trim().slice(0, 100)}..."`);
        diffs.push(`    AFTER:  "${afterSentences[i].trim().slice(0, 100)}..."`);
        diffs.push('');
      }
    }

    if (diffs.length === 0) {
      console.log('    No changes (text was already natural)');
    } else {
      console.log(diffs.join('\n'));
    }

    console.log(`  FINAL OUTPUT (with imperfections):`);
    console.log(`  ${result.finalText}\n`);
  }
}

run().catch(console.error);
