'use strict';
const { clawprintUrl, apiKey } = require('./config');

function base(url) { return url.replace(/\/$/, ''); }

async function reportTransaction(payload) {
  if (!apiKey) throw new Error('CLAWPRINT_API_KEY required to report transactions');
  const res = await fetch(`${base(clawprintUrl)}/v1/transactions/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`Report failed (${res.status}): ${json ? JSON.stringify(json) : text}`);
  return json;
}

async function reportSuccess(handle, txId, rating = 5, meta = {}) {
  return reportTransaction({ agent_handle: handle, tx_id: txId, outcome: 'success', rating, meta });
}

async function reportFailure(handle, txId, reason, meta = {}) {
  return reportTransaction({ agent_handle: handle, tx_id: txId, outcome: 'failure', reason: String(reason || 'unknown'), meta });
}

module.exports = { reportTransaction, reportSuccess, reportFailure };
