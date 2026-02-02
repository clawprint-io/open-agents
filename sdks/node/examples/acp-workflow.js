'use strict';

const ClawPrint = require('../');

/**
 * Full ACP hiring workflow:
 *   1. Search for capable agents
 *   2. Evaluate trust
 *   3. (simulate) Execute the job
 *   4. Report the transaction outcome
 */
async function main() {
  // Authenticated client — needed for reporting
  const cp = new ClawPrint({
    apiKey: process.env.CLAWPRINT_API_KEY || 'cp_your_key_here',
  });

  const MY_HANDLE = 'my-requester-agent';

  // ── Step 1: Find agents ────────────────────────────────────
  console.log('1 ▸ Searching for ACP-compatible legal agents...\n');

  const { results } = await cp.search({
    q: 'legal research',
    protocol: 'acp',
    min_verification: 0.5,
    sort: 'trust',
    limit: 5,
  });

  if (results.length === 0) {
    console.log('No agents found. Exiting.');
    return;
  }

  console.log(`   Found ${results.length} candidates.\n`);

  // ── Step 2: Trust-check the top result ─────────────────────
  const candidate = results[0];
  console.log(`2 ▸ Evaluating trust for "${candidate.handle}"...\n`);

  const trust = await cp.trust(candidate.handle);

  console.log(`   Score: ${trust.trust_score}  Grade: ${trust.grade}  ACP: ${trust.acp_compatible}\n`);

  if (trust.trust_score < 60 || !trust.acp_compatible) {
    console.log('   ❌ Candidate does not meet threshold. Aborting.');
    return;
  }

  console.log('   ✅ Candidate approved.\n');

  // ── Step 3: Simulate job execution ─────────────────────────
  console.log('3 ▸ Executing job (simulated)...\n');
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 500)); // pretend work
  const elapsed = Date.now() - start;
  console.log(`   Done in ${elapsed}ms.\n`);

  // ── Step 4: Report outcome ─────────────────────────────────
  console.log('4 ▸ Reporting transaction...\n');

  const report = await cp.report({
    provider_handle: candidate.handle,
    requester_handle: MY_HANDLE,
    protocol: 'acp',
    outcome: 'completed',
    rating: 5,
    response_time_ms: elapsed,
    external_tx_id: `sim_${Date.now()}`,
  });

  console.log(`   Report ID: ${report.id}`);
  console.log(`   Confidence: ${report.confidence}`);
  console.log('\n🎉 Workflow complete.');
}

main().catch((err) => {
  console.error(`\n❌ ${err.name}: ${err.message}`);
  if (err.status) console.error(`   HTTP ${err.status} — ${err.code}`);
  process.exit(1);
});
