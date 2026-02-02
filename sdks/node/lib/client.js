'use strict';

/**
 * @typedef {Object} ClientOptions
 * @property {string}  [baseUrl='https://clawprint.io'] - API base URL
 * @property {string}  [apiKey]                          - Bearer token for authenticated endpoints
 * @property {number}  [timeout=30000]                   - Request timeout in milliseconds
 * @property {Record<string, string>} [headers]          - Extra headers merged into every request
 */

/**
 * ClawPrint API error with structured details.
 */
class ClawPrintError extends Error {
  /**
   * @param {string} message  - Human-readable description
   * @param {number} status   - HTTP status code (0 for network errors)
   * @param {string} code     - Machine-readable error code
   * @param {*}      [body]   - Raw response body, if any
   */
  constructor(message, status, code, body) {
    super(message);
    this.name = 'ClawPrintError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * Minimal HTTP client wrapping native fetch.
 * Handles auth, timeouts, query-string encoding, and error surfacing.
 */
class HttpClient {
  /** @param {ClientOptions} opts */
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || 'https://clawprint.io').replace(/\/+$/, '');
    this.apiKey = opts.apiKey || null;
    this.timeout = opts.timeout ?? 30_000;
    this.extraHeaders = opts.headers || {};
  }

  /**
   * Build a full URL with optional query parameters.
   * Skips undefined/null values.
   *
   * @param {string} path
   * @param {Record<string, any>} [params]
   * @returns {string}
   */
  _url(path, params) {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  /**
   * Build headers for a request.
   *
   * @param {boolean} auth  - Whether to include the Authorization header
   * @returns {Record<string, string>}
   */
  _headers(auth) {
    /** @type {Record<string, string>} */
    const h = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...this.extraHeaders,
    };
    if (auth && this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  /**
   * Execute an HTTP request and return the parsed JSON body.
   * Throws {@link ClawPrintError} on non-2xx responses or network failures.
   *
   * @param {string}  method
   * @param {string}  path
   * @param {Object}  [options]
   * @param {Record<string, any>}  [options.query]  - Query parameters
   * @param {*}       [options.body]                 - JSON-serialisable body
   * @param {boolean} [options.auth=false]           - Attach Bearer token
   * @returns {Promise<any>}
   */
  async request(method, path, { query, body, auth = false } = {}) {
    const url = this._url(path, query);
    const headers = this._headers(auth);

    if (auth && !this.apiKey) {
      throw new ClawPrintError(
        'This operation requires an API key. Pass apiKey when constructing ClawPrint.',
        0,
        'missing_api_key',
      );
    }

    /** @type {RequestInit} */
    const init = { method, headers };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    // Timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    init.signal = controller.signal;

    /** @type {Response} */
    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ClawPrintError(
          `Request timed out after ${this.timeout}ms: ${method} ${path}`,
          0,
          'timeout',
        );
      }
      throw new ClawPrintError(
        `Network error: ${err.message}`,
        0,
        'network_error',
      );
    } finally {
      clearTimeout(timer);
    }

    // Parse body (gracefully handle empty responses)
    let data;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `HTTP ${res.status} on ${method} ${path}`;
      const code =
        (data && data.code) ||
        (res.status >= 500 ? 'server_error' : 'api_error');
      throw new ClawPrintError(msg, res.status, code, data);
    }

    return data;
  }
}

module.exports = { HttpClient, ClawPrintError };
