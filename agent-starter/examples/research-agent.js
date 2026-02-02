/**
 * Example: A slightly more realistic handler that calls OpenAI.
 *
 * Requires:
 *   OPENAI_API_KEY
 */

async function callOpenAI({ apiKey, query }) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a research assistant. Return a concise, structured answer with bullet points and include any uncertainties.'
            }
          ]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: query }]
        }
      ]
    })
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status}): ${JSON.stringify(json, null, 2)}`);
  }

  // Best-effort text extraction.
  const outputText =
    json.output_text ||
    json.output?.[0]?.content?.find?.((c) => c.type === 'output_text')?.text ||
    null;

  return { raw: json, outputText };
}

async function handleExchange(payload, ctx) {
  const query =
    typeof payload === 'string'
      ? payload
      : payload?.query || payload?.text || payload?.input || JSON.stringify(payload);

  const apiKey = ctx.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  // Track usage in memory.
  const count = Number(ctx.memory.get('research_count') || 0) + 1;
  ctx.memory.set('research_count', count);

  const { outputText } = await callOpenAI({ apiKey, query });

  return {
    ok: true,
    type: 'research',
    query,
    answer: outputText,
    research_count: count,
    timestamp: new Date().toISOString()
  };
}

module.exports = { handleExchange };