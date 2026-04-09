// Datamuse quality test — isolates the synonym pass to show exact replacements
// Usage: npx tsx scripts/datamuse-test.ts

import { humanizeText } from '../lib/humanizer';
import { HumanizerSettings } from '../types';

const settings: HumanizerSettings = {
  imperfectionLevel: 'moderate',
  burstinessMode: 'strong',
  randomSpacingEnabled: false,
  randomSpacingIntensity: 'medium',
};

const TESTS = [
  {
    name: 'Test 1 — Technical/Business',
    text: `The strategic integration of machine learning algorithms into existing infrastructure has demonstrated significant improvements in operational efficiency. Organizations that have successfully implemented these sophisticated solutions report a 40% reduction in processing time. Furthermore, the collaborative development of these systems requires careful consideration of both technical requirements and user experience. It is important to note that the multifaceted nature of artificial intelligence implementation demands a comprehensive approach to change management. The ecosystem of tools and frameworks continues to evolve, creating new opportunities for innovation. Stakeholders must navigate complex regulatory landscapes while maintaining alignment with organizational objectives. Subsequently, the establishment of robust governance mechanisms ensures sustainable growth and equitable outcomes for all participants.`,
  },
  {
    name: 'Test 2 — Academic/Research',
    text: `Recent studies have demonstrated that environmental factors significantly influence cognitive development during adolescence. The relationship between socioeconomic status and academic performance has been extensively documented in longitudinal research. Researchers have identified several systemic barriers that disproportionately affect marginalized communities. These findings underscore the importance of evidence-based interventions in educational policy. The implementation of targeted support programs has shown measurable improvements in student outcomes. Additionally, the nuanced interplay between genetic predisposition and environmental stimuli continues to challenge established theoretical frameworks. It is imperative that future research adopts a more holistic methodology to capture the full complexity of developmental processes.`,
  },
];

// Find actual word-level changes between two texts by tokenizing at the same positions
function findChanges(before: string, after: string): Array<{original: string, replacement: string, context: string}> {
  const changes: Array<{original: string, replacement: string, context: string}> = [];

  // Find words in 'before' that don't appear in 'after' and vice versa
  const bWords = new Map<string, number>();
  const aWords = new Map<string, number>();

  for (const w of before.toLowerCase().match(/\b[a-z]+\b/g) || []) {
    bWords.set(w, (bWords.get(w) || 0) + 1);
  }
  for (const w of after.toLowerCase().match(/\b[a-z]+\b/g) || []) {
    aWords.set(w, (aWords.get(w) || 0) + 1);
  }

  const removed: string[] = [];
  const added: string[] = [];

  for (const [w, count] of bWords) {
    const afterCount = aWords.get(w) || 0;
    if (afterCount < count) {
      for (let i = 0; i < count - afterCount; i++) removed.push(w);
    }
  }
  for (const [w, count] of aWords) {
    const beforeCount = bWords.get(w) || 0;
    if (beforeCount < count) {
      for (let i = 0; i < count - beforeCount; i++) added.push(w);
    }
  }

  // Pair removals with additions for display
  const maxPairs = Math.min(removed.length, added.length);
  for (let i = 0; i < removed.length; i++) {
    changes.push({
      original: removed[i],
      replacement: i < added.length ? added[i] : '(deleted)',
      context: '',
    });
  }
  // Show remaining additions
  for (let i = maxPairs; i < added.length; i++) {
    changes.push({
      original: '(none)',
      replacement: added[i],
      context: '',
    });
  }

  return changes;
}

async function run() {
  // First: test Datamuse connectivity
  console.log('Testing Datamuse API connectivity...');
  try {
    const res = await fetch('https://api.datamuse.com/words?rel_syn=comprehensive&md=f&max=5');
    const data = await res.json();
    console.log(`  Datamuse OK — got ${data.length} results for "comprehensive":`);
    for (const item of data.slice(0, 5)) {
      const fTag = item.tags?.find((t: string) => t.startsWith('f:'));
      console.log(`    "${item.word}" (freq: ${fTag || 'n/a'})`);
    }
  } catch (e) {
    console.log(`  Datamuse UNREACHABLE — ${e}`);
  }
  console.log('');

  for (const test of TESTS) {
    console.log(`${'='.repeat(70)}`);
    console.log(`  ${test.name}`);
    console.log(`${'='.repeat(70)}`);

    const result = await humanizeText(test.text, settings);

    // Find the synonym pass specifically (pass index 2)
    const vocabPass = result.passes[1]; // replaceAIVocab
    const synPass = result.passes[2];   // applyDynamicSynonyms

    console.log(`\n  SYNONYM PASS INPUT (after vocabMap):`);
    console.log(`  ${vocabPass.text.slice(0, 250)}...\n`);

    console.log(`  SYNONYM PASS OUTPUT:`);
    console.log(`  ${synPass.text.slice(0, 250)}...\n`);

    console.log(`  WORD CHANGES IN SYNONYM PASS:`);
    const synChanges = findChanges(vocabPass.text, synPass.text);
    if (synChanges.length === 0) {
      console.log('    No changes (static + Datamuse made no replacements beyond vocabMap)');
    } else {
      for (const c of synChanges) {
        console.log(`    "${c.original}" → "${c.replacement}"`);
      }
    }

    console.log(`\n  FINAL OUTPUT:`);
    console.log(`  ${result.finalText}\n`);

    // Quality checks
    console.log(`  QUALITY:`);
    const checks = [
      [/\bplanned\s+desegregation\b/i, 'planned desegregation'],
      [/\bit is must\b/i, 'it is must'],
      [/\bskilled\s+difficulties\b/i, 'skilled difficulties'],
    ] as const;
    let allClean = true;
    for (const [pat, desc] of checks) {
      if (pat.test(result.finalText)) {
        console.log(`    FAIL: ${desc}`);
        allClean = false;
      }
    }
    // Check domain phrases preserved
    const domain = test.name.includes('Business')
      ? ['machine learning', 'processing time', 'user experience', 'artificial intelligence', '40%']
      : ['cognitive development', 'socioeconomic status', 'academic performance', 'genetic predisposition'];
    for (const phrase of domain) {
      if (!result.finalText.toLowerCase().includes(phrase.toLowerCase())) {
        console.log(`    FAIL: domain phrase "${phrase}" missing`);
        allClean = false;
      }
    }
    if (allClean) console.log(`    ALL CLEAN — meaning preserved, no distortions`);
    console.log('');
  }
}

run().catch(console.error);
