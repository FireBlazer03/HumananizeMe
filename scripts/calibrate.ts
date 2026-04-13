// Calibration script — runs 3 test inputs through the full pipeline and detector
// Usage: npx tsx scripts/calibrate.ts

import { humanizeText } from '../lib/humanizer';
import { detectAIPatterns } from '../lib/detector';
import { HumanizerSettings } from '../types';

const settings: HumanizerSettings = {
  imperfectionLevel: 'moderate',
  burstinessMode: 'strong',
  randomSpacingEnabled: true,
  randomSpacingIntensity: 'medium',
  professionalMode: false ,
};

const TESTS = [
  {
    name: 'T1 — Generic AI Essay',
    text: `Artificial intelligence has fundamentally transformed the landscape of modern technology. Furthermore, the implementation of sophisticated algorithms has enabled organizations to streamline their operations and maximize efficiency. It is important to note that these groundbreaking developments represent a paradigm shift in how we approach complex problems. The multifaceted nature of these innovations underscores the need for comprehensive strategies. Additionally, stakeholders must leverage cutting-edge tools to navigate the evolving ecosystem. This transformative technology continues to foster unprecedented growth across diverse industries. Nevertheless, it is worth noting that the integration of these robust systems requires careful consideration. The holistic approach to artificial intelligence implementation showcases remarkable potential for sustainable development. In conclusion, these pivotal advancements stand as a testament to human ingenuity and innovation.`,
  },
  {
    name: 'T2 — Marketing Copy',
    text: `In today's rapidly evolving digital landscape, businesses must leverage innovative strategies to maintain a competitive edge. Our comprehensive platform empowers organizations to streamline their workflows, enhance productivity, and foster meaningful connections with their target audience. The cutting-edge features of our solution facilitate seamless integration across multiple channels. Furthermore, our robust analytics engine provides actionable insights that drive strategic decision-making. It is crucial to understand that the dynamic nature of modern markets requires agile and proactive approaches. Our team of dedicated professionals ensures that stakeholders receive holistic support throughout their journey. The platform's sophisticated architecture enables scalable growth while maintaining optimal performance. We are committed to delivering transformative results that align with your organization's unique objectives. Moving forward, we will continue to optimize our offerings to meet the ever-changing demands of the industry.`,
  },
  {
    name: 'T3 — Research Summary',
    text: `The study demonstrates that environmental factors significantly influence cognitive development in adolescents. Subsequently, researchers identified several key variables that contribute to academic performance. The findings underscore the importance of creating supportive educational environments. Furthermore, the data reveals that socioeconomic status plays a pivotal role in determining outcomes. It is worth noting that these results align with previously established theoretical frameworks. The comprehensive analysis of longitudinal data showcases the multifaceted nature of developmental processes. Additionally, the implementation of evidence-based interventions has shown promising results. The research highlights the need for holistic approaches to education policy. These groundbreaking discoveries have significant implications for future studies in the field. In terms of practical applications, the findings suggest that targeted support programs can effectively address disparities.`,
  },
];

async function run() {
  for (const test of TESTS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${test.name}`);
    console.log(`${'='.repeat(70)}`);

    // Before
    const beforeReport = detectAIPatterns(test.text);
    console.log(`\n  BEFORE: AI Score = ${beforeReport.estimatedAIScore}`);
    for (const s of beforeReport.signals) {
      console.log(`    ${s.name}: ${s.score}/${s.maxScore} — ${s.detail}`);
    }

    // Humanize
    const result = await humanizeText(test.text, settings);

    // After
    const afterReport = detectAIPatterns(result.finalText);
    console.log(`\n  AFTER:  AI Score = ${afterReport.estimatedAIScore}`);
    for (const s of afterReport.signals) {
      console.log(`    ${s.name}: ${s.score}/${s.maxScore} — ${s.detail}`);
    }

    console.log(`\n  Score reduction: ${beforeReport.estimatedAIScore} → ${afterReport.estimatedAIScore} (Δ${beforeReport.estimatedAIScore - afterReport.estimatedAIScore})`);

    // Show snippet of output
    console.log(`\n  Output preview (first 200 chars):`);
    console.log(`    "${result.finalText.slice(0, 200)}..."`);
  }
}

run().catch(console.error);
