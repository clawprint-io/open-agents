'use strict';
const path = require('node:path');
const { clawprintUrl, apiKey, pollIntervalMs, agentHandle, handlerPath, memoryFilePath } = require('./config');
const { readAgentCard } = require('./register');
const { createMemory } = require('./memory');
const { reportSuccess, reportFailure } = require('./reporter');

const base = url => url.replace(/\/$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadHandler(modulePath) {
  const abs = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
  const mod = require(abs);
  const fn = mod.handleExchange || mod.default || mod;
  if (typeof fn !== 'function') throw new Error(`Handler at ${modulePath} must export a function`);
  return fn;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json ? JSON.stringify(json) : text}`);
  return json;
}

async function pollForRequests({ domains }) {
  if (!apiKey) throw new Error('CLAWPRINT_API_KEY is required');
  const url = new URL(`${base(clawprintUrl)}/v1/exchange/requests`);
  if (domains?.length) url.searchParams.set('domains', domains.join(','));
  if (agentHandle) url.searchParams.set('agent_handle', agentHandle);
  return fetchJson(url.toString(), { method: 'GET', headers: { authorization: `Bearer ${apiKey}` } });
}

async function submitOffer(request) {
  const requestId = request.id || request.request_id;
  if (!requestId) throw new Error('Request missing id');
  return fetchJson(`${base(clawprintUrl)}/v1/exchange/offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ request_id: requestId, agent_handle: agentHandle, pricing: { model: 'free' } }),
  });
}

async function waitForAcceptance(offer) {
  if (offer?.tx_id || offer?.transaction_id) return offer;
  const offerId = offer?.id || offer?.offer_id;
  if (!offerId) return offer;
  const url = `${base(clawprintUrl)}/v1/exchange/offers/${encodeURIComponent(offerId)}`;
  for (let i = 0; i < 60; i++) {
    const status = await fetchJson(url, { method: 'GET', headers: { authorization: `Bearer ${apiKey}` } });
    const state = status?.state || status?.status;
    if (state === 'accepted' || status?.accepted) return status;
    if (state === 'rejected' || state === 'expired') return status;
    await sleep(1000);
  }
  return offer;
}

async function deliverResult(txId, result) {
  return fetchJson(`${base(clawprintUrl)}/v1/exchange/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ tx_id: txId, agent_handle: agentHandle, result }),
  });
}

async function runWorker({ once = false } = {}) {
  if (!agentHandle) throw new Error('AGENT_HANDLE is required');
  const { card } = readAgentCard();
  const domains = (card?.services || []).flatMap(s => s?.domains || []).filter(Boolean);
  const handler = loadHandler(handlerPath);
  const memory = createMemory({ filePath: memoryFilePath });
  console.log(JSON.stringify({ ok: true, mode: once ? 'once' : 'loop', agentHandle, domains, pollIntervalMs }, null, 2));
  while (true) {
    try {
      const polled = await pollForRequests({ domains });
      const requests = polled?.requests || polled?.data?.requests || polled?.data || (Array.isArray(polled) ? polled : []);
      if (!Array.isArray(requests) || requests.length === 0) { if (once) return; await sleep(pollIntervalMs); continue; }
      for (const req of requests) {
        const offer = await submitOffer(req);
        const accepted = await waitForAcceptance(offer);
        const state = accepted?.state || accepted?.status;
        if (state && state !== 'accepted' && !accepted?.accepted && !(accepted?.tx_id || accepted?.transaction_id)) { console.log('Offer not accepted:', state); continue; }
        const txId = accepted?.tx_id || accepted?.transaction_id || accepted?.data?.tx_id;
        const payload = req?.payload || req?.input || req;
        if (!txId) { console.warn('Missing tx_id; skipping'); continue; }
        try {
          const result = await handler(payload, { request: req, txId, memory, env: process.env });
          await deliverResult(txId, result);
          await reportSuccess(agentHandle, txId, 5);
          console.log('Completed tx:', txId);
        } catch (err) {
          try { await reportFailure(agentHandle, txId, err?.message || String(err)); } catch {}
          console.error('Handler failed:', err?.message || err);
        }
        if (once) return;
      }
    } catch (err) {
      console.error('Worker error:', err?.message || err);
      if (once) { process.exitCode = 1; return; }
      await sleep(Math.max(1000, pollIntervalMs));
    }
  }
}

if (require.main === module) { runWorker({ once: process.argv.includes('--once') }).catch(e => { console.error(e?.message || e); process.exitCode = 1; }); }
module.exports = { runWorker, loadHandler };
