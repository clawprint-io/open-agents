const fs = require('node:fs');
const path = require('node:path');
const { clawprintUrl, agentCardPath, apiKey: envApiKey } = require('./config');

/**
 * Minimal YAML parser for this template (supports:
 * - key: value
 * - nested objects via indentation (2 spaces)
 * - arrays via `- item`
 * - inline arrays like ["a", "b"]
 * - strings/numbers/booleans/null
 */
function parseYaml(yamlText) {
  const lines = yamlText
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => !/^\s*#/.test(l));

  function parseScalar(s) {
    if (s == null) return null;
    const trimmed = s.trim();
    if (trimmed === '') return '';
    if (trimmed === 'null' || trimmed === '~') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

    // Inline array: [a, b]
    if (/^\[.*\]$/.test(trimmed)) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(',')
        .map((x) => parseScalar(x.trim().replace(/^['"]|['"]$/g, '')));
    }

    // Strip quotes if present
    return trimmed.replace(/^['"]|['"]$/g, '');
  }

  function indentOf(line) {
    const m = line.match(/^\s*/);
    return m ? m[0].length : 0;
  }

  function stripComments(line) {
    // Remove trailing comments, but keep # inside quotes (best-effort)
    // This is intentionally simple for a starter template.
    const idx = line.indexOf(' #');
    return idx >= 0 ? line.slice(0, idx) : line;
  }

  function parseBlock(startIndex, baseIndent) {
    let i = startIndex;
    let obj = null;
    let arr = null;

    function ensureObj() {
      if (obj == null) obj = {};
      return obj;
    }

    function ensureArr() {
      if (arr == null) arr = [];
      return arr;
    }

    while (i < lines.length) {
      let line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }

      line = stripComments(line);
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind > baseIndent) {
        // This should be handled by recursion from the previous key.
        // If we land here, the YAML is likely malformed for our subset.
        throw new Error(`Unexpected indentation at line ${i + 1}`);
      }

      const trimmed = line.trim();

      // Array item
      if (trimmed.startsWith('- ')) {
        const content = trimmed.slice(2);
        const target = ensureArr();

        // Object item starting on same line: - key: value
        if (content.includes(':')) {
          const [k, ...rest] = content.split(':');
          const key = k.trim();
          const after = rest.join(':').trim();
          const item = {};

          if (after === '') {
            const child = parseBlock(i + 1, baseIndent + 2);
            item[key] = child.value;
            i = child.nextIndex;
          } else {
            item[key] = parseScalar(after);
            i++;
          }

          // Consume additional key/value lines indented under this array item
          while (i < lines.length) {
            const nextLine = stripComments(lines[i]);
            if (!nextLine.trim()) {
              i++;
              continue;
            }
            const nextInd = indentOf(nextLine);
            if (nextInd < baseIndent + 2) break;
            if (nextInd !== baseIndent + 2) {
              // nested under a key of this item
              const childKeyLine = nextLine.trim();
              const [ck, ...cr] = childKeyLine.split(':');
              const ckey = ck.trim();
              const cafter = cr.join(':').trim();
              if (cafter === '') {
                const child = parseBlock(i + 1, nextInd + 2);
                item[ckey] = child.value;
                i = child.nextIndex;
              } else {
                item[ckey] = parseScalar(cafter);
                i++;
              }
              continue;
            }
            const kv = nextLine.trim();
            const [ck, ...cr] = kv.split(':');
            const ckey = ck.trim();
            const cafter = cr.join(':').trim();
            if (cafter === '') {
              const child = parseBlock(i + 1, baseIndent + 4);
              item[ckey] = child.value;
              i = child.nextIndex;
            } else {
              item[ckey] = parseScalar(cafter);
              i++;
            }
          }

          target.push(item);
          continue;
        }

        // Scalar item
        target.push(parseScalar(content));
        i++;
        continue;
      }

      // Key/value
      const parts = trimmed.split(':');
      const key = parts.shift().trim();
      const rest = parts.join(':');
      const after = rest.trim();

      const target = ensureObj();

      if (after === '') {
        const child = parseBlock(i + 1, baseIndent + 2);
        target[key] = child.value;
        i = child.nextIndex;
      } else {
        target[key] = parseScalar(after);
        i++;
      }
    }

    return { value: arr != null ? arr : obj != null ? obj : {}, nextIndex: i };
  }

  return parseBlock(0, 0).value;
}

function readAgentCard(cardPath = agentCardPath) {
  const abs = path.resolve(process.cwd(), cardPath);
  const yaml = fs.readFileSync(abs, 'utf8');
  const card = parseYaml(yaml);
  return { absPath: abs, card };
}

function upsertEnvValue(envFilePath, key, value) {
  const abs = path.resolve(process.cwd(), envFilePath);
  let existing = '';
  try {
    existing = fs.readFileSync(abs, 'utf8');
  } catch {
    existing = '';
  }

  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');

  let next;
  if (re.test(existing)) next = existing.replace(re, line);
  else next = existing.trimEnd() + (existing.trim() ? '\n' : '') + line + '\n';

  fs.writeFileSync(abs, next, 'utf8');
}

async function registerAgent({ update = false } = {}) {
  const { card } = readAgentCard();
  const handle = card?.identity?.handle;

  if (!handle) {
    throw new Error('agent-card.yaml is missing identity.handle');
  }

  const endpoint = update
    ? `${clawprintUrl.replace(/\/$/, '')}/v1/agents/${encodeURIComponent(handle)}`
    : `${clawprintUrl.replace(/\/$/, '')}/v1/agents`;

  const method = update ? 'PATCH' : 'POST';
  const headers = { 'content-type': 'application/json' };
  if (update) {
    const key = envApiKey;
    if (!key) throw new Error('CLAWPRINT_API_KEY is required to update an existing agent registration');
    headers.authorization = `Bearer ${key}`;
  }

  const res = await fetch(endpoint, {
    method,
    headers,
    body: JSON.stringify({ agent_card: card })
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
    throw new Error(`ClawPrint registration failed (${res.status} ${res.statusText}): ${details}`);
  }

  const apiKey = json?.apiKey || json?.api_key || json?.data?.apiKey || json?.data?.api_key;
  if (apiKey) {
    // Write to .env if present; otherwise create it.
    upsertEnvValue('.env', 'CLAWPRINT_API_KEY', apiKey);
  }

  return { handle, apiKey, response: json };
}

async function main() {
  try {
    const update = process.argv.includes('--update') || process.argv.includes('-u');
    const out = await registerAgent({ update });
    console.log(JSON.stringify({ ok: true, ...out }, null, 2));
    if (out.apiKey) {
      console.log('\nSaved CLAWPRINT_API_KEY to .env');
    }
  } catch (err) {
    console.error('Register error:', err?.message || err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseYaml,
  readAgentCard,
  registerAgent,
  upsertEnvValue
};