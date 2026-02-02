'use strict';

/**
 * Summarize Agent — Real Extractive Summarization Handler
 *
 * Uses TF-based sentence scoring (word frequency) to extract
 * the most important sentences from a document.
 *
 * Algorithm:
 * 1. Split text into sentences
 * 2. Tokenize and count word frequencies (excluding stop words)
 * 3. Score each sentence by sum of its word frequencies
 * 4. Normalize scores by sentence length to avoid bias toward long sentences
 * 5. Select top N sentences (proportional to document length)
 * 6. Return in original order as bullet points
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'its', 'was', 'be', 'are',
  'am', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'not', 'no', 'nor', 'if', 'then', 'than', 'so',
  'as', 'up', 'out', 'about', 'into', 'over', 'after', 'before',
  'between', 'under', 'above', 'such', 'each', 'every', 'all',
  'both', 'few', 'more', 'most', 'other', 'some', 'any', 'only',
  'own', 'same', 'also', 'very', 'just', 'because', 'through',
  'during', 'while', 'here', 'there', 'again', 'once', 'further',
  'too', 'quite', 'already', 'much', 'many', 'however', 'although',
  'yet', 'still', 'even', 'well', 'back', 'now', 'get', 'got',
  'one', 'two', 'like', 'make', 'made', 'way', 'new', 'said',
]);

/**
 * Split text into sentences using punctuation boundaries.
 * Handles common abbreviations and decimal numbers.
 */
function splitSentences(text) {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split on sentence-ending punctuation followed by space + capital letter or end of string.
  // Avoids splitting on abbreviations like "Dr.", "U.S.", etc.
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z"])|(?<=[.!?])$/);

  return raw
    .map(s => s.trim())
    .filter(s => {
      // Must have at least 3 words to be a meaningful sentence
      const words = s.split(/\s+/);
      return words.length >= 3 && s.length >= 15;
    });
}

/**
 * Tokenize text into lowercase words, stripping punctuation.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Calculate word frequencies across all sentences.
 */
function buildWordFrequencies(sentences) {
  const freq = {};
  for (const sentence of sentences) {
    const words = tokenize(sentence);
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return freq;
}

/**
 * Score a sentence based on word frequency.
 * Normalized by word count to prevent long-sentence bias.
 */
function scoreSentence(sentence, wordFreq) {
  const words = tokenize(sentence);
  if (words.length === 0) return 0;

  let score = 0;
  for (const word of words) {
    score += wordFreq[word] || 0;
  }

  // Normalize by word count (but with diminishing returns for very short sentences)
  const normalizer = Math.max(words.length, 3);
  return score / normalizer;
}

/**
 * Select top N sentences, returned in their original order.
 */
function extractTopSentences(sentences, scores, n) {
  // Create indexed array
  const indexed = sentences.map((s, i) => ({ sentence: s, score: scores[i], index: i }));

  // Sort by score descending
  indexed.sort((a, b) => b.score - a.score);

  // Take top N
  const top = indexed.slice(0, n);

  // Re-sort by original position for coherent reading order
  top.sort((a, b) => a.index - b.index);

  return top.map(t => t.sentence);
}

/**
 * Determine how many sentences to extract based on document length.
 */
function getTargetCount(totalSentences) {
  if (totalSentences <= 3) return totalSentences;
  if (totalSentences <= 6) return 3;
  if (totalSentences <= 15) return 5;
  if (totalSentences <= 30) return 7;
  // For very long documents, ~20-25% of sentences
  return Math.min(10, Math.ceil(totalSentences * 0.25));
}

/**
 * Find the most frequent meaningful words (for "key topics").
 */
function extractKeyTopics(wordFreq, n = 5) {
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

async function handleExchange(payload, ctx) {
  const text =
    typeof payload === 'string'
      ? payload
      : payload?.text || payload?.input || payload?.query || payload?.content || JSON.stringify(payload);

  if (!text || text.length < 30) {
    return {
      format: 'markdown',
      data: '## Summary\n\nText too short to summarize. Please provide a longer document.',
    };
  }

  // 1. Split into sentences
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return {
      format: 'markdown',
      data: '## Summary\n\nCould not extract meaningful sentences from the input.',
    };
  }

  // If very few sentences, just return them all
  if (sentences.length <= 2) {
    const bullets = sentences.map(s => `- ${s}`).join('\n');
    return {
      format: 'markdown',
      data: `## Summary\n\n${bullets}\n\n---\n*${sentences.length} sentence(s) in original text — returned as-is.*`,
    };
  }

  // 2. Build word frequencies
  const wordFreq = buildWordFrequencies(sentences);

  // 3. Score each sentence
  const scores = sentences.map(s => scoreSentence(s, wordFreq));

  // 4. Extract top sentences
  const targetCount = getTargetCount(sentences.length);
  const topSentences = extractTopSentences(sentences, scores, targetCount);

  // 5. Extract key topics
  const keyTopics = extractKeyTopics(wordFreq, 5);

  // 6. Format output
  const bullets = topSentences.map(s => `- ${s}`).join('\n');
  const topicsStr = keyTopics.length > 0 ? `**Key topics:** ${keyTopics.join(', ')}` : '';

  // Track in memory
  const count = Number(ctx.memory.get('summarize_count') || 0) + 1;
  ctx.memory.set('summarize_count', count);

  const stats = `*Extracted ${topSentences.length} key points from ${sentences.length} sentences (${text.length} characters).*`;

  return {
    format: 'markdown',
    data: `## Summary\n\n${bullets}\n\n${topicsStr}\n\n---\n${stats}`,
  };
}

module.exports = { handleExchange };