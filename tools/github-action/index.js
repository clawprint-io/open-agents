const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Parse an agent card file. Supports YAML (.yml/.yaml) and JSON (.json).
 * For YAML we do a minimal parse — the API accepts raw YAML body anyway,
 * but we need to extract the handle for PATCH requests.
 */
function readCardFile(cardPath) {
  if (!fs.existsSync(cardPath)) {
    throw new Error(`Agent card not found at: ${cardPath}`);
  }
  const raw = fs.readFileSync(cardPath, 'utf8');
  const ext = path.extname(cardPath).toLowerCase();

  if (ext === '.json') {
    return { parsed: JSON.parse(raw), raw, format: 'json' };
  }

  // Minimal YAML handle extraction (avoid adding a YAML dep)
  const handleMatch = raw.match(/^handle\s*:\s*['"]?([^\s'"#]+)/m);
  const nameMatch = raw.match(/^name\s*:\s*['"]?([^\n'"#]+)/m);
  return {
    parsed: {
      handle: handleMatch ? handleMatch[1].trim() : undefined,
      name: nameMatch ? nameMatch[1].trim() : undefined,
    },
    raw,
    format: 'yaml',
  };
}

/**
 * Make an HTTPS (or HTTP) request, return { statusCode, body }.
 */
function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
    };

    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        resolve({ statusCode: res.statusCode, body: text, json });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  try {
    // ── Read inputs ──────────────────────────────────────────────
    const cardPath = core.getInput('card-path') || 'agent-card.yaml';
    const registryUrl = (core.getInput('registry-url') || 'https://clawprint.io').replace(/\/+$/, '');
    const apiKey = core.getInput('api-key') || '';

    // Mask the API key immediately so it never leaks in logs
    if (apiKey) {
      core.setSecret(apiKey);
    }

    core.info(`📋 Reading agent card from: ${cardPath}`);
    const card = readCardFile(cardPath);
    core.info(`   Format: ${card.format} | Handle: ${card.parsed.handle || '(will be assigned)'}`);

    // ── Decide: create vs update ─────────────────────────────────
    const isUpdate = Boolean(apiKey);
    let res;

    if (isUpdate) {
      // ── UPDATE (PATCH) ───────────────────────────────────────
      const handle = card.parsed.handle;
      if (!handle) {
        throw new Error(
          'Cannot update: no "handle" found in agent card. ' +
          'Add a handle field or remove api-key to create a new registration.'
        );
      }

      const url = `${registryUrl}/v1/agents/${encodeURIComponent(handle)}`;
      const contentType = card.format === 'json' ? 'application/json' : 'application/x-yaml';

      core.info(`🔄 Updating agent "${handle}" at ${url}`);
      res = await request('PATCH', url, {
        'Content-Type': contentType,
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'clawprint-register-action/1.0',
      }, card.raw);

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
          `Update failed (HTTP ${res.statusCode}): ${res.body}`
        );
      }

      const data = res.json || {};
      const outHandle = data.handle || handle;
      const outUrl = data.url || `${registryUrl}/agents/${outHandle}`;
      const outKey = data.api_key || data.apiKey || apiKey;

      // Mask any returned key too
      if (outKey) core.setSecret(outKey);

      core.setOutput('handle', outHandle);
      core.setOutput('url', outUrl);
      core.setOutput('api-key', outKey);
      core.setOutput('status', 'updated');

      core.info(`✅ Agent updated successfully`);
      core.info(`   Handle: ${outHandle}`);
      core.info(`   URL:    ${outUrl}`);

    } else {
      // ── CREATE (POST) ────────────────────────────────────────
      const url = `${registryUrl}/v1/agents`;
      const contentType = card.format === 'json' ? 'application/json' : 'application/x-yaml';

      core.info(`🆕 Registering new agent at ${url}`);
      res = await request('POST', url, {
        'Content-Type': contentType,
        'User-Agent': 'clawprint-register-action/1.0',
      }, card.raw);

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
          `Registration failed (HTTP ${res.statusCode}): ${res.body}`
        );
      }

      const data = res.json || {};
      const outHandle = data.handle || card.parsed.handle || '';
      const outUrl = data.url || `${registryUrl}/agents/${outHandle}`;
      const outKey = data.api_key || data.apiKey || '';

      // Mask the newly-issued API key
      if (outKey) core.setSecret(outKey);

      core.setOutput('handle', outHandle);
      core.setOutput('url', outUrl);
      core.setOutput('api-key', outKey);
      core.setOutput('status', 'created');

      core.info(`✅ Agent registered successfully`);
      core.info(`   Handle: ${outHandle}`);
      core.info(`   URL:    ${outUrl}`);
      if (outKey) {
        core.info(`   API Key: ***  (masked — available via steps.<id>.outputs.api-key)`);
        core.warning(
          'Save the API key to your repository secrets as CLAWPRINT_API_KEY. ' +
          'You will need it for future updates.'
        );
      }
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();