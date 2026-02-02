const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseYaml, upsertEnvValue, registerAgent } = require('../src/register');

test('parseYaml parses the provided agent-card subset', () => {
  const yaml = `agent_card: "0.2"
identity:
  name: "My Agent"
  handle: "my-agent"
services:
  - id: "main"
    domains: ["research", "tools"]
    input:
      type: "text"
`;

  const obj = parseYaml(yaml);
  assert.equal(obj.agent_card, '0.2');
  assert.equal(obj.identity.handle, 'my-agent');
  assert.equal(obj.services[0].id, 'main');
  assert.deepEqual(obj.services[0].domains, ['research', 'tools']);
  assert.equal(obj.services[0].input.type, 'text');
});

test('upsertEnvValue adds and updates values', () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cp-agent-'));
  const envPath = path.join(tmp, '.env');

  upsertEnvValue(envPath, 'CLAWPRINT_API_KEY', 'abc');
  assert.match(fs.readFileSync(envPath, 'utf8'), /^CLAWPRINT_API_KEY=abc/m);

  upsertEnvValue(envPath, 'CLAWPRINT_API_KEY', 'def');
  assert.match(fs.readFileSync(envPath, 'utf8'), /^CLAWPRINT_API_KEY=def/m);
});

test('registerAgent writes CLAWPRINT_API_KEY to .env when API returns apiKey', async () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cp-agent-'));
  const cwd = process.cwd();

  // Create a minimal agent card
  fs.writeFileSync(
    path.join(tmp, 'agent-card.yaml'),
    `agent_card: "0.2"
identity:
  handle: "my-agent"
`,
    'utf8'
  );

  // Ensure .env is in temp cwd
  fs.writeFileSync(path.join(tmp, '.env'), 'AGENT_HANDLE=my-agent\n', 'utf8');

  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ apiKey: 'test-key' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  try {
    process.chdir(tmp);
    const out = await registerAgent({ update: false });
    assert.equal(out.apiKey, 'test-key');
    const env = fs.readFileSync(path.join(tmp, '.env'), 'utf8');
    assert.match(env, /^CLAWPRINT_API_KEY=test-key/m);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
  }
});