const { clawprintUrl, apiKey, agentHandle } = require('./config');

function base(url) {
  return url.replace(/\/$/, '');
}

async function reportTransaction(payload) {
  if (!apiKey) throw new Error('CLAWPRINT_API_KEY is required to report transactions');
  const res = await fetch(`${base(clawprintUrl)}/v1/transactions/report`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const details = json ? JSON.stringify(json, null, 2) : text;
    throw new Error(`Transaction report failed (${res.status} ${res.statusText}): ${details}`);
  }
  return json;
}

async function reportSuccess(handle, txId, rating = 5, meta = {}) {
  return reportTransaction({
    agent_handle: handle,
    tx_id: txId,
    outcome: 'success',
    rating,
    meta
  });
}

async function reportFailure(handle, txId, reason, meta = {}) {
  return reportTransaction({
    agent_handle: handle,
    tx_id: txId,
    outcome: 'failure',
    reason: String(reason || 'unknown'),
    meta
  });
}

async function main() {
  try {
    const txId = process.argv[2];
    const outcome = process.argv[3] || 'success';
    if (!txId) {
      console.error('Usage: node src/reporter.js <txId> <success|failure> [reasonOrRating]');
      process.exitCode = 1;
      return;
    }

    const handle = agentHandle;
    if (!handle) throw new Error('AGENT_HANDLE is required');

    if (outcome === 'failure') {
      const reason = process.argv[4] || 'manual report';
      const res = await reportFailure(handle, txId, reason);
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    const rating = Number(process.argv[4] || '5');
    const res = await reportSuccess(handle, txId, rating);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Report error:', err?.message || err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  reportTransaction,
  reportSuccess,
  reportFailure
};