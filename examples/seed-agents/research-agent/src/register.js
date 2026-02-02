'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { clawprintUrl, agentCardPath, apiKey: envApiKey } = require('./config');

function parseYaml(yamlText) {
  const lines = yamlText.split(/\r?\n/).map(l => l.replace(/\t/g, '  ')).filter(l => !/^\s*#/.test(l));
  function parseScalar(s) {
    if (s == null) return null;
    const t = s.trim();
    if (t === '' || t === 'null' || t === '~') return t === '' ? '' : null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^\[.*\]$/.test(t)) {
      const inner = t.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(x => parseScalar(x.trim().replace(/^['"]|['"]$/g, '')));
    }
    return t.replace(/^['"]|['"]$/g, '');
  }
  function indentOf(line) { const m = line.match(/^\s*/); return m ? m[0].length : 0; }
  function stripComments(line) { const i = line.indexOf(' #'); return i >= 0 ? line.slice(0, i) : line; }
  function parseBlock(startIndex, baseIndent) {
    let i = startIndex, obj = null, arr = null;
    function ensureObj() { if (!obj) obj = {}; return obj; }
    function ensureArr() { if (!arr) arr = []; return arr; }
    while (i < lines.length) {
      let line = lines[i];
      if (!line.trim()) { i++; continue; }
      line = stripComments(line);
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind > baseIndent) { i++; continue; }
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const content = trimmed.slice(2);
        const target = ensureArr();
        if (content.includes(':')) {
          const [k, ...rest] = content.split(':');
          const key = k.trim(), after = rest.join(':').trim();
          const item = {};
          if (after === '') { const child = parseBlock(i + 1, baseIndent + 2); item[key] = child.value; i = child.nextIndex; }
          else { item[key] = parseScalar(after); i++; }
          while (i < lines.length) {
            const nl = stripComments(lines[i]);
            if (!nl.trim()) { i++; continue; }
            const ni = indentOf(nl);
            if (ni < baseIndent + 2) break;
            const kv = nl.trim();
            const [ck, ...cr] = kv.split(':');
            const cafter = cr.join(':').trim();
            if (cafter === '') { const child = parseBlock(i + 1, ni + 2); item[ck.trim()] = child.value; i = child.nextIndex; }
            else { item[ck.trim()] = parseScalar(cafter); i++; }
          }
          target.push(item);
        } else { target.push(parseScalar(content)); i++; }
        continue;
      }
      const parts = trimmed.split(':');
      const key = parts.shift().trim();
      const after = parts.join(':').trim();
      const target = ensureObj();
      if (after === '') { const child = parseBlock(i + 1, baseIndent + 2); target[key] = child.value; i = child.nextIndex; }
      else { target[key] = parseScalar(after); i++; }
    }
    return { value: arr != null ? arr : obj != null ? obj : {}, nextIndex: i };
  }
  return parseBlock(0, 0).value;
}

function readAgentCard(cardPath = agentCardPath) {
  const abs = path.resolve(process.cwd(), cardPath);
  const yaml = fs.readFileSync(abs, 'utf8');
  return { absPath: abs, card: parseYaml(yaml) };
}

function upsertEnvValue(envFilePath, key, value) {
  const abs = path.resolve(process.cwd(), envFilePath);
  let existing = ''; try { existing = fs.readFileSync(abs, 'utf8'); } catch {}
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(existing) ? existing.replace(re, line) : existing.trimEnd() + (existing.trim() ? '\n' : '') + line + '\n';
  fs.writeFileSync(abs, next, 'utf8');
}

async function registerAgent({ update = false } = {}) {
  const { card } = readAgentCard();
  const handle = card?.identity?.handle;
  if (!handle) throw new Error('agent-card.yaml missing identity.handle');
  const endpoint = update
    ? `${clawprintUrl.replace(/\/$/, '')}/v1/agents/${encodeURIComponent(handle)}`
    : `${clawprintUrl.replace(/\/$/, '')}/v1/agents`;
  const method = update ? 'PATCH' : 'POST';
  const headers = { 'content-type': 'application/json' };
  if (update) {
    if (!envApiKey) throw new Error('CLAWPRINT_API_KEY required for update');
    headers.authorization = `Bearer ${envApiKey}`;
  }
  const res = await fetch(endpoint, { method, headers, body: JSON.stringify({ agent_card: card }) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`Registration failed (${res.status}): ${json ? JSON.stringify(json) : text}`);
  const apiKey = json?.apiKey || json?.api_key || json?.data?.apiKey || json?.data?.api_key;
  if (apiKey) upsertEnvValue('.env', 'CLAWPRINT_API_KEY', apiKey);
  return { handle, apiKey, response: json };
}

if (require.main === module) {
  (async () => {
    try {
      const update = process.argv.includes('--update') || process.argv.includes('-u');
      const out = await registerAgent({ update });
      console.log(JSON.stringify({ ok: true, ...out }, null, 2));
      if (out.apiKey) console.log('\nSaved CLAWPRINT_API_KEY to .env');
    } catch (err) { console.error('Register error:', err?.message || err); process.exitCode = 1; }
  })();
}

module.exports = { parseYaml, readAgentCard, registerAgent, upsertEnvValue };
