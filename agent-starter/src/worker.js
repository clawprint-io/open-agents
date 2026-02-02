const path = require('node:path');
const { clawprintUrl, apiKey, pollIntervalMs, agentHandle, handlerPath, memoryFilePath } = require('./config');
const { readAgentCard } = require('./register');
const { createMemory } = require('./memory');
const { reportSuccess, reportFailure } = require('./reporter');

function base(url) {
  return url.replace(/\/$/, '');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadHandler(modulePath) {
  const abs = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
  // eslint-disable-next-line import/no-dynamic-require
  const mod = require(abs);
  const fn = mod.handleExchange || mod.default || mod;
  if (typeof fn !== 'function') {
    throw new Error(`Handler at ${modulePath} must export a function (module.exports = fn) or { handleExchange: fn }`);
  }
  return fn;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const details = json ? JSON.stringify(json, null, 2) : text;
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${details}`);
  }
  return json;
}

async function pollForRequests({ domains }) {
  if (!apiKey) throw new Error('CLAWPRINT_API_KEY is required to run the worker');
  const url = new URL(`${base(clawprintUrl)}/v1/exchange/requests`);
  if (domains?.length) url.searchParams.set('domains', domains.join(','));
  if (agentHandle) url.searchParams.set('agent_handle', agentHandle);

  return fetchJson(url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${apiKey}` }
  });
}

async function submitOffer(request, { pricingModel = 'free' } = {}) {
  const requestId = request.id || request.request_id;
  if (!requestId) throw new Error('Request missing id/request_id');

  return fetchJson(`${base(clawprintUrl)}/v1/exchange/offers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      request_id: requestId,
      agent_handle: agentHandle,
      pricing: { model: pricingModel }
    })
  });
}

async function waitForAcceptance(offer) {
  // Some exchanges return an immediate transaction; others require polling.
  if (offer?.tx_id || offer?.transaction_id) return offer;

  const offerId = offer?.id || offer?.offer_id;
  if (!offerId) return offer;

  const url = `${base(clawprintUrl)}/v1/exchange/offers/${encodeURIComponent(offerId)}`;
  for (let i = 0; i < 60; i++) {
    const status = await fetchJson(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}` }
    });

    const state = status?.state || status?.status;
    if (state === 'accepted' || status?.accepted === true) return status;
    if (state === 'rejected' || state === 'expired') return status;
    await sleep(1000);
  }

  return offer;
}

async function deliverResult(txId, result) {
  return fetchJson(`${base(clawprintUrl)}/v1/exchange/deliver`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      tx_id: txId,
      agent_handle: agentHandle,
      result
    })
  });
}

async function runWorker({ once = false } = {}) {
  if (!agentHandle) throw new Error('AGENT_HANDLE is required');

  const { card } = readAgentCard();
  const domains = (card?.services || [])
    .flatMap((s) => s?.domains || [])
    .filter(Boolean);

  const handler = loadHandler(handlerPath);
  const memory = createMemory({ filePath: memoryFilePath });

  console.log(JSON.stringify({
    ok: true,
    mode: once ? 'once' : 'loop',
    agentHandle,
    domains,
    pollIntervalMs,
    handlerPath,
    memoryFile: memory._path
  }, null, 2));

  while (true) {
    try {
      const polled = await pollForRequests({ domains });

      // Support multiple response shapes.
      const requests = polled?.requests || polled?.data?.requests || polled?.data || (Array.isArray(polled) ? polled : []);

      if (!Array.isArray(requests) || requests.length === 0) {
        if (once) return;
        await sleep(pollIntervalMs);
        continue;
      }

      for (const req of requests) {
        const offer = await submitOffer(req, { pricingModel: 'free' });
        const accepted = await waitForAcceptance(offer);
        const state = accepted?.state || accepted?.status;

        if (state && state !== 'accepted' && accepted?.accepted !== true && !(accepted?.tx_id || accepted?.transaction_id)) {
          console.log('Offer not accepted:', state || accepted);
          continue;
        }

        const txId = accepted?.tx_id || accepted?.transaction_id || accepted?.data?.tx_id || accepted?.data?.transaction_id;
        const payload = req?.payload || req?.input || req;

        if (!txId) {
          console.warn('Accepted offer missing tx_id; skipping deliver/report. Raw:', accepted);
          continue;
        }

        let result;
        try {
          result = await handler(payload, {
            request: req,
            txId,
            memory,
            env: process.env
          });

          await deliverResult(txId, result);
          await reportSuccess(agentHandle, txId, 5);

          console.log('Completed tx:', txId);
        } catch (err) {
          const reason = err?.message || String(err);
          try {
            await reportFailure(agentHandle, txId, reason);
          } catch (reportErr) {
            console.error('Failed to report failure:', reportErr?.message || reportErr);
          }
          console.error('Handler/deliver failed:', reason);
        }

        if (once) return;
      }
    } catch (err) {
      console.error('Worker loop error:', err?.message || err);
      if (once) {
        process.exitCode = 1;
        return;
      }
      await sleep(Math.max(1000, pollIntervalMs));
    }
  }
}

async function main() {
  const once = process.argv.includes('--once');
  try {
    await runWorker({ once });
  } catch (err) {
    console.error('Worker error:', err?.message || err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { runWorker, loadHandler };