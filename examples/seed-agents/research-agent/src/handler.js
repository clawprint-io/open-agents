'use strict';

/**
 * Research Agent — Template-Based Response Handler
 *
 * Takes a research topic and returns a structured markdown summary.
 * Uses template-based generation with topic-aware section creation.
 * Designed to be wired up to real web search later.
 */

/**
 * Classify a topic into broad research categories for tailored templates.
 */
function classifyTopic(topic) {
  const lower = topic.toLowerCase();

  const categories = [
    { name: 'technology', keywords: ['software', 'ai', 'machine learning', 'blockchain', 'crypto', 'programming', 'api', 'cloud', 'data', 'algorithm', 'computing', 'web', 'app', 'code', 'database', 'neural', 'deep learning', 'llm', 'gpt', 'python', 'javascript', 'rust', 'devops', 'kubernetes', 'docker'] },
    { name: 'science', keywords: ['biology', 'physics', 'chemistry', 'quantum', 'genome', 'climate', 'space', 'mars', 'nasa', 'evolution', 'cell', 'dna', 'rna', 'vaccine', 'molecule', 'atom', 'energy', 'solar', 'ecology'] },
    { name: 'business', keywords: ['market', 'startup', 'investment', 'revenue', 'company', 'stock', 'finance', 'economy', 'gdp', 'trade', 'venture', 'ipo', 'profit', 'growth', 'strategy', 'management', 'enterprise'] },
    { name: 'health', keywords: ['health', 'medical', 'disease', 'treatment', 'therapy', 'drug', 'clinical', 'patient', 'hospital', 'mental health', 'nutrition', 'diet', 'exercise', 'wellness', 'cancer', 'diabetes'] },
    { name: 'policy', keywords: ['government', 'policy', 'regulation', 'law', 'political', 'election', 'senate', 'congress', 'legislation', 'rights', 'privacy', 'gdpr', 'compliance', 'tax'] },
  ];

  for (const cat of categories) {
    if (cat.keywords.some(kw => lower.includes(kw))) {
      return cat.name;
    }
  }
  return 'general';
}

/**
 * Extract potential sub-topics from the query.
 */
function extractSubTopics(topic) {
  // Split on common delimiters and conjunctions
  const parts = topic
    .split(/\band\b|\bvs\.?\b|\bversus\b|\bor\b|,|;|\bcompared to\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  return parts.length > 1 ? parts : [topic];
}

/**
 * Generate research sections appropriate to the topic category.
 */
function generateSections(topic, category) {
  const common = {
    technology: [
      { title: 'Overview', template: `${topic} represents a significant area in modern technology. This field has seen rapid evolution in recent years, driven by advances in computing power and growing demand for digital solutions.` },
      { title: 'Current State', template: `The current landscape for ${topic} is characterized by active development and increasing adoption. Key players include both established tech companies and innovative startups pushing the boundaries of what\'s possible.` },
      { title: 'Key Technologies & Approaches', template: `Several approaches exist within ${topic}. The dominant paradigms include both open-source and proprietary solutions, each with distinct trade-offs in terms of performance, scalability, and ease of implementation.` },
      { title: 'Challenges & Limitations', template: `Despite progress, ${topic} faces challenges including scalability concerns, security considerations, and the need for standardization. Integration with existing systems remains a practical hurdle for many organizations.` },
      { title: 'Future Outlook', template: `${topic} is expected to continue evolving rapidly. Industry analysts predict increasing investment, broader adoption, and the emergence of new use cases as the technology matures.` },
    ],
    science: [
      { title: 'Background', template: `${topic} is an active area of scientific inquiry with roots spanning several decades. Recent breakthroughs have renewed interest and funding in this domain.` },
      { title: 'Current Research', template: `Ongoing research in ${topic} spans multiple institutions worldwide. Key research directions include both fundamental investigations and applied studies with practical implications.` },
      { title: 'Key Findings', template: `Recent studies on ${topic} have produced notable findings that challenge earlier assumptions. Peer-reviewed publications indicate both convergent and divergent results, suggesting the field is still maturing.` },
      { title: 'Methodology & Data', template: `Research in ${topic} employs various methodological approaches including experimental, observational, and computational methods. Data availability and reproducibility remain important considerations.` },
      { title: 'Implications & Applications', template: `The findings related to ${topic} have potential applications in multiple domains. Translation from research to practical use is an active area of development.` },
    ],
    business: [
      { title: 'Market Overview', template: `The ${topic} market has shown significant movement in recent periods. Market dynamics are influenced by macroeconomic conditions, regulatory changes, and shifting consumer behavior.` },
      { title: 'Key Players & Competition', template: `The competitive landscape in ${topic} includes established incumbents and disruptive new entrants. Market share distribution continues to shift as innovation drives differentiation.` },
      { title: 'Financial Trends', template: `Financial analysis of ${topic} reveals trends in investment, revenue growth, and profitability. Both public and private markets are showing interest in this sector.` },
      { title: 'Strategic Considerations', template: `Organizations involved in ${topic} are focusing on strategic priorities including operational efficiency, market expansion, and technology adoption to maintain competitive advantage.` },
      { title: 'Forecast', template: `Analysts project continued evolution in ${topic} over the coming years. Key variables that will influence outcomes include regulatory developments, technological change, and global economic conditions.` },
    ],
    health: [
      { title: 'Overview', template: `${topic} is a significant area of health research and clinical practice. Understanding in this area continues to evolve as new evidence emerges from clinical trials and population studies.` },
      { title: 'Current Evidence', template: `The evidence base for ${topic} includes randomized controlled trials, observational studies, and meta-analyses. Consensus is emerging in some areas while others remain actively debated.` },
      { title: 'Treatment & Prevention', template: `Approaches to ${topic} include both preventive strategies and therapeutic interventions. Treatment guidelines are regularly updated as new evidence becomes available.` },
      { title: 'Public Health Impact', template: `${topic} has implications for public health policy and resource allocation. Population-level data informs both prevention programs and healthcare delivery models.` },
      { title: 'Emerging Research', template: `New research directions in ${topic} include novel therapeutic approaches, biomarker discovery, and personalized medicine strategies that may transform future practice.` },
    ],
    policy: [
      { title: 'Policy Background', template: `${topic} exists within a complex policy framework shaped by historical precedent, stakeholder interests, and evolving public opinion.` },
      { title: 'Current Regulatory Landscape', template: `The regulatory environment for ${topic} varies across jurisdictions. Key legislation and regulatory bodies play significant roles in shaping the current framework.` },
      { title: 'Stakeholder Perspectives', template: `Multiple stakeholders have distinct perspectives on ${topic}, including government agencies, industry groups, civil society organizations, and affected communities.` },
      { title: 'Challenges & Debates', template: `Active debates around ${topic} center on balancing competing interests, enforceability, and the pace of regulatory adaptation to changing circumstances.` },
      { title: 'Outlook', template: `The policy trajectory for ${topic} is expected to evolve in response to technological change, public sentiment shifts, and new evidence about outcomes.` },
    ],
    general: [
      { title: 'Overview', template: `${topic} is a multifaceted subject that has attracted attention from various perspectives. Understanding the key aspects requires examining multiple dimensions.` },
      { title: 'Key Aspects', template: `Several important dimensions of ${topic} deserve attention. These include historical context, current developments, and potential future trajectories.` },
      { title: 'Analysis', template: `Analysis of ${topic} reveals both well-established understanding and areas of ongoing investigation. Multiple frameworks exist for evaluating the key factors involved.` },
      { title: 'Perspectives & Debate', template: `Different perspectives on ${topic} reflect varying priorities and assumptions. Constructive engagement with multiple viewpoints enriches overall understanding.` },
      { title: 'Conclusion & Next Steps', template: `${topic} remains an evolving area of interest. Further investigation into specific aspects would provide deeper insights for decision-making.` },
    ],
  };

  return common[category] || common.general;
}

/**
 * Generate placeholder source URLs relevant to the topic category.
 */
function generateSources(topic, category) {
  const encodedTopic = encodeURIComponent(topic);
  const sources = [
    { title: `Wikipedia: ${topic}`, url: `https://en.wikipedia.org/wiki/${encodedTopic.replace(/%20/g, '_')}` },
    { title: `Google Scholar results for "${topic}"`, url: `https://scholar.google.com/scholar?q=${encodedTopic}` },
  ];

  const categorySpecific = {
    technology: [
      { title: 'Hacker News discussions', url: `https://hn.algolia.com/?q=${encodedTopic}` },
      { title: 'GitHub repositories', url: `https://github.com/search?q=${encodedTopic}` },
    ],
    science: [
      { title: 'PubMed research articles', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodedTopic}` },
      { title: 'arXiv preprints', url: `https://arxiv.org/search/?query=${encodedTopic}` },
    ],
    business: [
      { title: 'SEC EDGAR filings', url: `https://efts.sec.gov/LATEST/search-index?q=${encodedTopic}` },
      { title: 'Crunchbase', url: `https://www.crunchbase.com/discover/organization.companies/${encodedTopic}` },
    ],
    health: [
      { title: 'PubMed research', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodedTopic}` },
      { title: 'WHO resources', url: `https://www.who.int/search?query=${encodedTopic}` },
    ],
    policy: [
      { title: 'Congress.gov', url: `https://www.congress.gov/search?q=${encodedTopic}` },
      { title: 'Brookings Institution', url: `https://www.brookings.edu/search/?s=${encodedTopic}` },
    ],
    general: [
      { title: 'Reuters', url: `https://www.reuters.com/search/news?query=${encodedTopic}` },
    ],
  };

  sources.push(...(categorySpecific[category] || categorySpecific.general));
  return sources;
}

async function handleExchange(payload, ctx) {
  const topic =
    typeof payload === 'string'
      ? payload
      : payload?.topic || payload?.query || payload?.text || payload?.input || JSON.stringify(payload);

  if (!topic || topic.length < 2) {
    return {
      format: 'markdown',
      data: '## Research\n\nPlease provide a research topic.',
    };
  }

  const category = classifyTopic(topic);
  const subTopics = extractSubTopics(topic);
  const sections = generateSections(topic, category);
  const sources = generateSources(topic, category);

  // Build markdown
  const parts = [`## Research: ${topic}\n`];
  parts.push(`*Category: ${category} | Sub-topics: ${subTopics.join(', ')}*\n`);

  for (const section of sections) {
    parts.push(`### ${section.title}\n`);
    parts.push(section.template + '\n');
  }

  // Sources section
  parts.push('### Sources\n');
  for (const src of sources) {
    parts.push(`- [${src.title}](${src.url})`);
  }

  parts.push('\n---');
  parts.push('*Note: This is a template-based research summary. For real-time data, web search integration is planned for a future release.*');

  // Track in memory
  const count = Number(ctx.memory.get('research_count') || 0) + 1;
  ctx.memory.set('research_count', count);

  return {
    format: 'markdown',
    data: parts.join('\n'),
  };
}

module.exports = { handleExchange };