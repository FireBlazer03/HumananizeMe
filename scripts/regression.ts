// Regression test harness — meaning-preservation guarantees.
//
// For every fixture under scripts/fixtures/*.json:
//   - Humanize the text with seeds [1, 2, 3, 42, 1337]
//   - Assert every `mustPreserve` pattern still appears in the output
//   - Assert no `forbidden` substring appears
//   - Assert the same seed produces identical output (determinism)
//
// Exit non-zero on any failure so this script can gate CI.

import * as fs from 'fs';
import * as path from 'path';
import { humanizeText } from '../lib/humanizer';
import { HumanizerSettings } from '../types';

interface Fixture {
  name: string;
  text: string;
  mustPreserve: string[];   // regex source strings — each must match the output
  forbidden: string[];      // literal substrings — none may appear in the output
  negationsBefore?: number; // expected negation count to survive
  maxSentenceDelta?: number; // allowed change in sentence count
  assertions?: Array<{
    type: 'maxTransitionOpeners' | 'entitySurvives';
    value: number | string;
  }>;
}

const SEEDS = [1, 2, 3, 42, 1337];

const BASE_SETTINGS: Omit<HumanizerSettings, 'seed'> = {
  imperfectionLevel: 'subtle',
  burstinessMode: 'mild',
  randomSpacingEnabled: false,
  randomSpacingIntensity: 'low',
  professionalMode: false,
  creativeRewriting: true,
};

function countNegations(text: string): number {
  const re = /\b(not|never|no|none|cannot|n't|without|neither|nor|rarely|hardly|scarcely|barely)\b/gi;
  return (text.match(re) || []).length;
}

function countSentences(text: string): number {
  return (text.match(/[^.!?]+[.!?]+/g) || []).length;
}

function transitionOpenerCount(text: string): number {
  const openers = /(?:^|(?<=\.\s))(Furthermore|Moreover|Consequently|Additionally|Nevertheless|Nonetheless|In conclusion|In summary|Subsequently)\b/gi;
  return (text.match(openers) || []).length;
}

async function runFixture(fx: Fixture): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const outputs: string[] = [];

  for (const seed of SEEDS) {
    const settings: HumanizerSettings = { ...BASE_SETTINGS, seed };

    let result;
    try {
      result = await humanizeText(fx.text, settings);
    } catch (e) {
      errors.push(`  seed=${seed}: pipeline threw ${e}`);
      continue;
    }
    const output = result.finalText;
    outputs.push(output);

    // Preserve checks
    for (const pat of fx.mustPreserve) {
      const re = new RegExp(pat, 'i');
      if (!re.test(output)) {
        errors.push(`  seed=${seed}: missing required pattern /${pat}/`);
      }
    }

    // Forbidden checks
    for (const bad of fx.forbidden) {
      if (output.toLowerCase().includes(bad.toLowerCase())) {
        errors.push(`  seed=${seed}: forbidden substring present: "${bad}"`);
      }
    }

    // Negation count
    if (fx.negationsBefore !== undefined) {
      const negAfter = countNegations(output);
      if (negAfter !== fx.negationsBefore) {
        errors.push(`  seed=${seed}: negation count ${fx.negationsBefore} → ${negAfter}`);
      }
    }

    // Sentence-count delta
    if (fx.maxSentenceDelta !== undefined) {
      const sBefore = countSentences(fx.text);
      const sAfter = countSentences(output);
      if (Math.abs(sBefore - sAfter) > fx.maxSentenceDelta) {
        errors.push(`  seed=${seed}: sentence count ${sBefore} → ${sAfter} (delta > ${fx.maxSentenceDelta})`);
      }
    }

    // Structured assertions
    for (const a of fx.assertions || []) {
      if (a.type === 'maxTransitionOpeners' && typeof a.value === 'number') {
        const n = transitionOpenerCount(output);
        if (n > a.value) {
          errors.push(`  seed=${seed}: transition openers ${n} > max ${a.value}`);
        }
      }
      if (a.type === 'entitySurvives' && typeof a.value === 'string') {
        if (!output.includes(a.value)) {
          errors.push(`  seed=${seed}: entity '${a.value}' missing`);
        }
      }
    }
  }

  // Determinism: re-run seed 42 once more, must match the prior seed-42 output
  const seed42Idx = SEEDS.indexOf(42);
  if (seed42Idx >= 0) {
    const second = await humanizeText(fx.text, { ...BASE_SETTINGS, seed: 42 });
    if (second.finalText !== outputs[seed42Idx]) {
      errors.push(`  seed=42: non-deterministic output (seeded RNG produced different result)`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const fixtureDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixtureDir)) {
    console.error(`No fixture directory at ${fixtureDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).sort();
  let pass = 0;
  let fail = 0;

  for (const file of files) {
    const fx: Fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf-8'));
    process.stdout.write(`[${file}] ${fx.name} ... `);
    const { ok, errors } = await runFixture(fx);
    if (ok) {
      console.log('PASS');
      pass++;
    } else {
      console.log('FAIL');
      for (const e of errors) console.log(e);
      fail++;
    }
  }

  console.log('');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
