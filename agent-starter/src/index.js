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

  console.log(`Usage:
  node src/index.js register [--update]
  node src/index.js worker [--once]

Or use npm scripts:
  npm run register
  npm run worker
`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});