// Semantic validation test — verifies meaning preservation
// Usage: npx tsx scripts/semantic-test.ts

import { humanizeText } from '../lib/humanizer';
import { HumanizerSettings } from '../types';

const settings: HumanizerSettings = {
  imperfectionLevel: 'moderate',
  burstinessMode: 'strong',
  randomSpacingEnabled: false, // disabled for clean comparison
  randomSpacingIntensity: 'medium',
};

const TESTS = [
  {
    name: 'Test 1 — Technical/Business Text',
    text: `The strategic integration of machine learning algorithms into existing infrastructure has demonstrated significant improvements in operational efficiency. Organizations that have successfully implemented these sophisticated solutions report a 40% reduction in processing time. Furthermore, the collaborative development of these systems requires careful consideration of both technical requirements and user experience. It is important to note that the multifaceted nature of artificial intelligence implementation demands a comprehensive approach to change management. The ecosystem of tools and frameworks continues to evolve, creating new opportunities for innovation. Stakeholders must navigate complex regulatory landscapes while maintaining alignment with organizational objectives. Subsequently, the establishment of robust governance mechanisms ensures sustainable growth and equitable outcomes for all participants.`,
    // Key phrases that MUST be preserved in meaning:
    checkPhrases: [
      'machine learning',  // domain term, must not be broken
      'processing time',   // specific metric context
      'user experience',   // domain term
      'artificial intelligence', // domain term
      'change management', // domain term
      '40%',              // specific data must be preserved
    ],
  },
  {
    name: 'Test 2 — Academic/Research Text',
    text: `Recent studies have demonstrated that environmental factors significantly influence cognitive development during adolescence. The relationship between socioeconomic status and academic performance has been extensively documented in longitudinal research. Researchers have identified several systemic barriers that disproportionately affect marginalized communities. These findings underscore the importance of evidence-based interventions in educational policy. The implementation of targeted support programs has shown measurable improvements in student outcomes. Additionally, the nuanced interplay between genetic predisposition and environmental stimuli continues to challenge established theoretical frameworks. It is imperative that future research adopts a more holistic methodology to capture the full complexity of developmental processes.`,
    checkPhrases: [
      'cognitive development',  // domain term
      'socioeconomic status',   // domain term
      'academic performance',   // domain term
      'longitudinal research',  // domain term
      'evidence-based',         // domain term
      'genetic predisposition', // domain term
    ],
  },
];

async function run() {
  for (const test of TESTS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${test.name}`);
    console.log(`${'='.repeat(70)}`);

    console.log(`\n  ORIGINAL:`);
    console.log(`  ${test.text.slice(0, 300)}...`);

    const result = await humanizeText(test.text, settings);

    console.log(`\n  OUTPUT:`);
    console.log(`  ${result.finalText.slice(0, 300)}...`);

    console.log(`\n  FULL OUTPUT:`);
    console.log(`  ${result.finalText}`);

    // Check meaning preservation
    console.log(`\n  MEANING CHECKS:`);
    const output = result.finalText.toLowerCase();
    let allPassed = true;
    for (const phrase of test.checkPhrases) {
      const found = output.includes(phrase.toLowerCase());
      const status = found ? 'PRESERVED' : 'MISSING';
      if (!found) allPassed = false;
      console.log(`    ${status}: "${phrase}"`);
    }

    // Check for known distortion patterns
    console.log(`\n  DISTORTION CHECKS:`);
    const distortions = [
      { pattern: /\bplanned\s+desegregation\b/i, desc: '"planned desegregation" (from strategic integration)' },
      { pattern: /\boptimize\s+effective\s+efficiency\b/i, desc: '"optimize effective efficiency" (redundancy)' },
      { pattern: /\bit is must\b/i, desc: '"it is must" (grammar error from imperative→must)' },
      { pattern: /\bskilled\s+difficulties\b/i, desc: '"skilled difficulties" (from experienced→skilled)' },
      { pattern: /\bset up\s+company\b/i, desc: '"set up company" (from established→set up)' },
      { pattern: /\.\s*(Also|On top of that|Even so|Still|Then|So)\.\s/i, desc: 'Orphaned transition word as standalone sentence' },
      { pattern: /\b(\w+)\s+\1\b/i, desc: 'Duplicate adjacent word' },
    ];
    let distortionCount = 0;
    for (const { pattern, desc } of distortions) {
      const match = pattern.exec(result.finalText);
      if (match) {
        console.log(`    FOUND: ${desc} → "${match[0]}"`);
        distortionCount++;
      } else {
        console.log(`    CLEAN: ${desc}`);
      }
    }

    console.log(`\n  VERDICT: ${allPassed && distortionCount === 0 ? 'PASS' : 'NEEDS REVIEW'}`);
    console.log(`    Meaning preserved: ${allPassed ? 'YES' : 'NO'}`);
    console.log(`    Distortions found: ${distortionCount}`);
  }
}

run().catch(console.error);
