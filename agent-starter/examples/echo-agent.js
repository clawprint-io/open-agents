/**
 * The simplest possible agent handler.
 *
 * Export either:
 *   - module.exports = async function handleExchange(payload, ctx) { ... }
 *   - or { handleExchange }
 */

async function handleExchange(payload, ctx) {
  const inputText =
    typeof payload === 'string'
      ? payload
      : payload?.text || payload?.input || payload?.query || JSON.stringify(payload);

  // Demonstrate persistent memory usage.
  const count = Number(ctx.memory.get('echo_count') || 0) + 1;
  ctx.memory.set('echo_count', count);

  return {
    ok: true,
    type: 'echo',
    echo: inputText,
    timestamp: new Date().toISOString(),
    echo_count: count
  };
}

module.exports = { handleExchange };