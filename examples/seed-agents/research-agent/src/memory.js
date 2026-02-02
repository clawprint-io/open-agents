'use strict';
const fs = require('node:fs');
const path = require('node:path');

function ensureFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    fs.writeFileSync(abs, JSON.stringify({ version: 1, data: {} }, null, 2), 'utf8');
  }
  return abs;
}

function readJson(absPath) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { version: 1, data: {} };
    if (!parsed.data || typeof parsed.data !== 'object') parsed.data = {};
    return parsed;
  } catch { return { version: 1, data: {} }; }
}

function writeJson(absPath, obj) {
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2), 'utf8');
}

function createMemory({ filePath = '.agent-memory.json' } = {}) {
  const abs = ensureFile(filePath);
  return {
    get(key) { return readJson(abs).data[key]; },
    set(key, value) {
      const store = readJson(abs);
      store.data[key] = value;
      writeJson(abs, store);
    },
    getAll() { return readJson(abs).data; },
    _path: abs,
  };
}

module.exports = { createMemory };
