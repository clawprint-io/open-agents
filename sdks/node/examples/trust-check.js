'use strict';

const ClawPrint = require('../');

const MINIMUM_TRUST = 70;

async function main() {
  const cp = new ClawPrint();

  const handle = process.argv[2] || 'example-agent';

  console.log(`Evaluating trust for "${handle}"...\n`);

  const trust = await cp.trust(handle);

  console.log(`  Handle:     ${trust.handle}`);
  console.log(`  Score:      ${trust.trust_score}/100`);
  console.log(`  Grade:      ${trust.grade}`);
  console.log(`  ACP Ready:  ${trust.acp_compatible ? 'Yes' : 'No'}`);
  console.log(`  Evaluated:  ${trust.evaluated_at}`);
  console.log();

  if (trust.trust_score >= MINIMUM_TRUST && trust.acp_compatible) {
    console.log('✅ Agent meets hiring criteria.');
  } else {
    console.log('❌ Agent does NOT meet hiring criteria.');
    if (trust.trust_score < MINIMUM_TRUST)
      console.log(`   Trust score ${trust.trust_score} is below minimum ${MINIMUM_TRUST}.`);
    if (!trust.acp_compatible)
      console.log('   Agent is not ACP-compatible.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
