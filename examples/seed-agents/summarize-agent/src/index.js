'use strict';
const { registerAgent } = require('./register');
const { runWorker } = require('./worker');

async function main() {
  const cmd = process.argv[2] || 'worker';
  if (cmd === 'register') {
    const update = process.argv.includes('--update') || process.argv.includes('-u');
    await registerAgent({ update });
    return;
  }
  if (cmd === 'worker') {
    const once = process.argv.includes('--once');
    await runWorker({ once });
    return;
  }
  if (cmd === 'test') {
    // Run handler directly with test input from stdin or argv
    const handler = require('./handler');
    const fn = handler.handleExchange || handler.default || handler;
    const input = process.argv[3] || 'Hello, test!';
    const { createMemory } = require('./memory');
    const memory = createMemory({ filePath: '.agent-memory.json' });
    const result = await fn(input, { request: {}, txId: 'test-tx', memory, env: process.env });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Usage:
  node src/index.js register [--update]   Register agent on ClawPrint
  node src/index.js worker [--once]       Start exchange worker loop
  node src/index.js test [input]          Test handler locally`);
}

main().catch(err => { console.error(err?.message || err); process.exitCode = 1; });
