// Final Quality Refinement test
// Shows BEFORE (post all passes, pre finalQualityRefinement) vs AFTER
// Usage: npx tsx scripts/final-quality-test.ts

import { humanizeText } from '../lib/humanizer';
import { HumanizerSettings } from '../types';

const settings: HumanizerSettings = {
  imperfectionLevel: 'realistic',
  burstinessMode: 'strong',
  randomSpacingEnabled: false,
  randomSpacingIntensity: 'medium',
  professionalMode: false,
};

const TEST_INPUT = `
Organizations are increasingly adopting artificial intelligence to navigate complex regulatory challenges.
The ongoing promotion of artificial intelligence has transformed how businesses address their requirements and considerations.
Stakeholders must evaluate the strategic implications while maintaining organizational objectives.
Facilitating collaboration between departments helps organizations demonstrate their commitment to equitable outcomes.
The fundamental requirements for implementation include comprehensive documentation and continuous coordination.
Consequently, organizations that have successfully demonstrated these capabilities report significant improvements in operational efficiency.
Strategic integration requires careful consideration of both technical requirements and user experience.
`.trim();

async function run() {
  console.log('='.repeat(70));
  console.log('  Final Quality Refinement — BEFORE vs AFTER');
  console.log('='.repeat(70));

  const result = await humanizeText(TEST_INPUT, settings);
  const beforeFinal = result.passes[result.passes.length - 1].text;
  const afterFinal = result.finalText;

  console.log('\n── BEFORE finalQualityRefinement ──\n');
  console.log(beforeFinal);
  console.log('\n── AFTER finalQualityRefinement ──\n');
  console.log(afterFinal);
  console.log('\n── CHANGES ──\n');

  const CONTRAST = ['The reality is usually messier', 'Some would push back on this', "It's more complicated than it looks", 'Then again, not everyone sees it that way', "That's not the whole story", 'Not every case plays out this way'];
  let contrastRemoved = 0;
  for (const c of CONTRAST) { if (beforeFinal.includes(c) && !afterFinal.includes(c)) { console.log(`  REMOVED contrast sentence: "${c}"`); contrastRemoved++; } }

  const TONE_CHECKS = [
    { bad: /\bgroups\s+(that|must|have|are|were)\b/i, good: 'organizations', label: 'groups→organizations' },
    { bad: /\bhandle\s+complex\s+regulatory\b/i, good: 'navigate', label: 'handle→navigate (regulatory)' },
  ];
  for (const { bad, good, label } of TONE_CHECKS) {
    const hadIssue = bad.test(beforeFinal);
    const fixed = !bad.test(afterFinal) && afterFinal.toLowerCase().includes(good);
    if (hadIssue && fixed) console.log(`  FIXED tone: ${label}`);
    else if (hadIssue && !fixed) console.log(`  UNCHANGED: ${label}`);
  }

  const artifactsBefore = (beforeFinal.match(/\w (?=[.,])/g) || []).length;
  const artifactsAfter = (afterFinal.match(/\w (?=[.,])/g) || []).length;
  const wordCount = afterFinal.split(/\s+/).length;
  console.log(`  SPACING artifacts: ${artifactsBefore} → ${artifactsAfter} (${wordCount} words, max: ${Math.max(1, Math.round(wordCount / 120))})`);
  if (contrastRemoved === 0) console.log('  (No contrast sentences injected this run — stochastic)');

  const issues: string[] = [];
  if (/\bgroups\s+(that|must|have|are|were)\b/i.test(afterFinal)) issues.push('groups not restored');
  if (/continuing promotion of/i.test(afterFinal)) issues.push('unnatural phrase survived');
  if (CONTRAST.some(c => afterFinal.includes(c))) issues.push('contrast sentence survived');

  console.log('\n── VERDICT ──');
  console.log(issues.length === 0 ? '  PASS — all quality checks clean' : `  ISSUES: ${issues.join(', ')}`);
  console.log('');
}

run().catch(console.error);
