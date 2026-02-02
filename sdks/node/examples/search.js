'use strict';

const ClawPrint = require('../');

async function main() {
  const cp = new ClawPrint();

  // Search for legal-domain agents supporting ACP
  const { results, total } = await cp.search({
    q: 'legal',
    protocol: 'acp',
    limit: 10,
  });

  console.log(`Found ${total} agents:\n`);

  for (const agent of results) {
    console.log(`  ${agent.handle}`);
    console.log(`    ${agent.name} — ${agent.description}`);
    console.log(`    trust: ${agent.trust_score ?? 'n/a'}  domains: ${(agent.domains || []).join(', ')}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
