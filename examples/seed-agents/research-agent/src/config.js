'use strict';

// Load .env if dotenv is available (optional dependency)
try { require('dotenv').config(); } catch {}

module.exports = {
  clawprintUrl: process.env.CLAWPRINT_URL || 'https://clawprint.io',
  apiKey: process.env.CLAWPRINT_API_KEY,
  agentHandle: process.env.AGENT_HANDLE,
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000', 10),
  agentCardPath: process.env.AGENT_CARD_PATH || 'agent-card.yaml',
  memoryFilePath: process.env.MEMORY_FILE_PATH || '.agent-memory.json',
  handlerPath: process.env.HANDLER_PATH || './src/handler.js',
};
