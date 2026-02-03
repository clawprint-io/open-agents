"""Private HTTP client for the ClawPrint API.

Handles authentication, base URL routing, and error mapping so the
tool layer never touches ``requests`` directly.

This module is internal to the ``langchain_community.tools.clawprint``
package.  Import tools or the toolkit instead.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import requests

CLAWPRINT_DEFAULT_BASE_URL = "https://clawprint.io"


class ClawPrintAPIError(Exception):
    """Raised when the ClawPrint API returns a non-2xx response."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"ClawPrint API error {status_code}: {detail}")


class ClawPrintClient:
    """Minimal, synchronous HTTP client for the ClawPrint REST API.

    Parameters
    ----------
    api_key:
        Bearer token for authenticated endpoints (exchange routes).
        Falls back to the ``CLAWPRINT_API_KEY`` environment variable.
        May be ``None`` for public read-only endpoints.
    base_url:
        API root.  Defaults to ``https://clawprint.io``.
    timeout:
        Request timeout in seconds.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = CLAWPRINT_DEFAULT_BASE_URL,
        timeout: int = 30,
    ) -> None:
        self.api_key = api_key or os.environ.get("CLAWPRINT_API_KEY")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": "langchain-community/clawprint",
            }
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self, auth_required: bool = False) -> Dict[str, str]:
        """Build per-request headers, injecting auth when needed."""
        headers: Dict[str, str] = {}
        if auth_required:
            if not self.api_key:
                raise ClawPrintAPIError(
                    401,
                    "This endpoint requires an API key. "
                    "Pass api_key= or set CLAWPRINT_API_KEY.",
                )
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _handle_response(self, resp: requests.Response) -> Any:
        """Raise on error; otherwise return parsed JSON."""
        if resp.ok:
            if resp.status_code == 204:
                return None
            return resp.json()
        try:
            body = resp.json()
            detail = body.get("detail") or body.get("message") or json.dumps(body)
        except Exception:
            detail = resp.text[:500]
        raise ClawPrintAPIError(resp.status_code, detail)

    # ------------------------------------------------------------------
    # Public API methods (mirror the REST surface consumed by tools)
    # ------------------------------------------------------------------

    def search_agents(
        self,
        query: str,
        domain: Optional[str] = None,
        min_score: Optional[float] = None,
    ) -> Any:
        """Search the agent registry.

        Parameters
        ----------
        query:
            Free-text search query.
        domain:
            Optional domain filter.
        min_score:
            Minimum trust score (0-100 scale, API native).
        """
        params: Dict[str, Any] = {"q": query}
        if domain:
            params["domain"] = domain
        if min_score is not None:
            params["min_score"] = min_score
        resp = self._session.get(
            f"{self.base_url}/v1/agents/search",
            params=params,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def get_agent(self, handle: str) -> Any:
        """Retrieve the full agent card for *handle*."""
        resp = self._session.get(
            f"{self.base_url}/v1/agents/{handle}",
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def get_trust(self, handle: str) -> Any:
        """Fetch the trust score for *handle*."""
        resp = self._session.get(
            f"{self.base_url}/v1/trust/{handle}",
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def list_domains(self) -> Any:
        """List all available capability domains."""
        resp = self._session.get(
            f"{self.base_url}/v1/domains",
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def create_exchange_request(
        self,
        domains: List[str],
        task: str,
        requirements: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Post a new exchange (hire) request.  Requires authentication."""
        payload: Dict[str, Any] = {"domains": domains, "task": task}
        if requirements:
            payload["requirements"] = requirements
        resp = self._session.post(
            f"{self.base_url}/v1/exchange/requests",
            json=payload,
            headers=self._headers(auth_required=True),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def get_exchange_request(self, request_id: str) -> Any:
        """Check the status of an existing exchange request.

        Requires authentication.
        """
        resp = self._session.get(
            f"{self.base_url}/v1/exchange/requests/{request_id}",
            headers=self._headers(auth_required=True),
            timeout=self.timeout,
        )
        return self._handle_response(resp)
