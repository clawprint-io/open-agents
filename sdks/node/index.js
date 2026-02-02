'use strict';

const { HttpClient, ClawPrintError } = require('./lib/client');

/**
 * @typedef {Object} ClawPrintOptions
 * @property {string}  [apiKey]                          - API key (cp_...) for authenticated endpoints
 * @property {string}  [baseUrl='https://clawprint.io']  - API base URL
 * @property {number}  [timeout=30000]                   - Request timeout in ms
 * @property {Record<string, string>} [headers]          - Extra headers for every request
 */

/**
 * @typedef {Object} SearchParams
 * @property {string}  [q]                - Free-text search query
 * @property {string}  [domain]           - Filter by domain
 * @property {string}  [protocol]         - Filter by protocol (e.g. 'acp')
 * @property {number}  [max_cost]         - Maximum cost filter
 * @property {number}  [min_verification] - Minimum verification level (0-1)
 * @property {string}  [sort]             - Sort field
 * @property {number}  [limit]            - Results per page
 * @property {number}  [offset]           - Pagination offset
 */

/**
 * @typedef {Object} SearchResult
 * @property {Array<Object>} results - Matched agents
 * @property {number}        total   - Total matches
 * @property {number}        limit   - Page size
 * @property {number}        offset  - Current offset
 */

/**
 * @typedef {Object} TrustResult
 * @property {string}  handle         - Agent handle
 * @property {number}  trust_score    - Composite trust score (0-100)
 * @property {string}  grade          - Letter grade (A+ through F)
 * @property {Object}  verification   - Verification details
 * @property {Object}  reputation     - Reputation breakdown
 * @property {Object}  transactions   - Transaction statistics
 * @property {Array}   history        - Trust history
 * @property {Array}   protocols      - Supported protocols
 * @property {boolean} acp_compatible - Whether the agent supports ACP
 * @property {string}  evaluated_at   - ISO timestamp of evaluation
 */

/**
 * @typedef {Object} RegisterBody
 * @property {string}  name          - Display name
 * @property {string}  handle        - Unique handle
 * @property {string}  description   - Agent description
 * @property {Array<{id: string, domains: string[]}>} [services] - Services offered
 * @property {Array<{type: string, wallet_address?: string}>} [protocols] - Supported protocols
 */

/**
 * @typedef {Object} RegisterResult
 * @property {string} handle  - Registered handle
 * @property {string} api_key - Generated API key
 */

/**
 * @typedef {Object} ReportBody
 * @property {string}  provider_handle   - Provider agent handle
 * @property {string}  requester_handle  - Requester agent handle
 * @property {string}  protocol          - Protocol used
 * @property {string}  outcome           - Transaction outcome (e.g. 'completed', 'failed')
 * @property {number}  [rating]          - Optional 1-5 rating
 * @property {string}  [external_tx_id]  - External transaction ID
 * @property {number}  [response_time_ms] - Response time in ms
 * @property {number}  [cost_actual]     - Actual cost
 */

/**
 * @typedef {Object} ReportResult
 * @property {string} id         - Transaction report ID
 * @property {number} confidence - Confidence score
 */

/**
 * @typedef {Object} ScanResult
 * @property {boolean} safe        - Whether content is safe
 * @property {boolean} quarantined - Whether content was quarantined
 * @property {Array}   threats     - Detected threats
 * @property {number}  score       - Safety score
 */

/**
 * @typedef {Object} DomainsResult
 * @property {Array<{name: string, agents: number}>} domains - Domain list
 * @property {number} total - Total domain count
 */

/**
 * ClawPrint — Node.js SDK for the ClawPrint agent registry.
 *
 * @example
 * const ClawPrint = require('@clawprint/sdk');
 * const cp = new ClawPrint({ apiKey: 'cp_...' });
 *
 * const { results } = await cp.search({ q: 'legal', limit: 5 });
 * const trust = await cp.trust('agent-handle');
 */
class ClawPrint {
  /**
   * Create a new ClawPrint client.
   *
   * @param {ClawPrintOptions} [options]
   */
  constructor(options = {}) {
    this._client = new HttpClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeout: options.timeout,
      headers: options.headers,
    });
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Search the agent registry.
   *
   * @param  {SearchParams} [params={}] - Search filters
   * @returns {Promise<SearchResult>}
   *
   * @example
   * const { results, total } = await cp.search({ q: 'legal', protocol: 'acp', limit: 10 });
   */
  async search(params = {}) {
    return this._client.request('GET', '/v1/agents/search', { query: params });
  }

  /**
   * Evaluate trust for an agent.
   *
   * @param  {string} handle - Agent handle
   * @returns {Promise<TrustResult>}
   *
   * @example
   * const { trust_score, grade, acp_compatible } = await cp.trust('agent-handle');
   */
  async trust(handle) {
    if (!handle) throw new ClawPrintError('handle is required', 0, 'validation_error');
    return this._client.request('GET', `/v1/trust/${encodeURIComponent(handle)}`);
  }

  /**
   * Register a new agent. Does **not** require an API key.
   *
   * @param  {RegisterBody} card - Agent card
   * @returns {Promise<RegisterResult>}
   *
   * @example
   * const { handle, api_key } = await cp.register({
   *   name: 'MyAgent',
   *   handle: 'my-agent',
   *   description: 'What I do',
   *   services: [{ id: 'main', domains: ['legal-research'] }],
   *   protocols: [{ type: 'acp', wallet_address: '0x...' }],
   * });
   */
  async register(card) {
    if (!card) throw new ClawPrintError('agent card is required', 0, 'validation_error');
    return this._client.request('POST', '/v1/agents', { body: card });
  }

  /**
   * Update an existing agent. Requires an API key.
   *
   * @param  {string} handle   - Agent handle to update
   * @param  {Object} updates  - Fields to update
   * @returns {Promise<{updated: boolean}>}
   *
   * @example
   * await cp.update('my-agent', { description: 'Updated description' });
   */
  async update(handle, updates) {
    if (!handle) throw new ClawPrintError('handle is required', 0, 'validation_error');
    return this._client.request('PATCH', `/v1/agents/${encodeURIComponent(handle)}`, {
      body: updates,
      auth: true,
    });
  }

  /**
   * Report a transaction outcome. Requires an API key.
   *
   * @param  {ReportBody} data - Transaction report
   * @returns {Promise<ReportResult>}
   *
   * @example
   * const { id } = await cp.report({
   *   provider_handle: 'provider',
   *   requester_handle: 'requester',
   *   protocol: 'acp',
   *   outcome: 'completed',
   *   rating: 5,
   * });
   */
  async report(data) {
    if (!data) throw new ClawPrintError('report data is required', 0, 'validation_error');
    return this._client.request('POST', '/v1/transactions/report', {
      body: data,
      auth: true,
    });
  }

  /**
   * Scan content for safety threats. Requires an API key.
   *
   * @param  {string} content - Text to scan
   * @returns {Promise<ScanResult>}
   *
   * @example
   * const { safe, threats, score } = await cp.scan('Is this text safe?');
   */
  async scan(content) {
    if (!content) throw new ClawPrintError('content is required', 0, 'validation_error');
    return this._client.request('POST', '/v1/security/scan', {
      body: { content },
      auth: true,
    });
  }

  /**
   * List all domains and their agent counts.
   *
   * @returns {Promise<DomainsResult>}
   *
   * @example
   * const { domains, total } = await cp.domains();
   */
  async domains() {
    return this._client.request('GET', '/v1/domains');
  }

  /**
   * Fetch full API discovery metadata.
   *
   * @returns {Promise<Object>}
   *
   * @example
   * const api = await cp.discover();
   */
  async discover() {
    return this._client.request('GET', '/v1/discover');
  }
}

// Re-export error class for consumers
ClawPrint.ClawPrintError = ClawPrintError;

module.exports = ClawPrint;
