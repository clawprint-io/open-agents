"""Low-level HTTP transport for the ClawPrint SDK."""

from typing import Any, Dict, Optional
from urllib.parse import quote

import requests

from .exceptions import ClawPrintError

_DEFAULT_BASE_URL = "https://clawprint.io"
_DEFAULT_TIMEOUT = 30


class HTTPClient:
    """Thin wrapper around :mod:`requests` that handles auth, errors, and
    serialization for every ClawPrint API call.

    Args:
        api_key: Bearer token.  May be ``None`` for unauthenticated endpoints.
        base_url: API root (no trailing slash).
        timeout: Default request timeout in seconds.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        self._session = requests.Session()
        self._session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": "clawprint-python/0.1.0",
            }
        )

    # ── helpers ───────────────────────────────────────────────────────────

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _headers(self, authenticated: bool) -> Dict[str, str]:
        headers: Dict[str, str] = {}
        if authenticated and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    @staticmethod
    def encode_path_segment(segment: str) -> str:
        """URL-encode a single path segment (e.g. an agent handle)."""
        return quote(segment, safe="")

    # ── core request ──────────────────────────────────────────────────────

    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        authenticated: bool = False,
    ) -> Dict[str, Any]:
        """Execute an HTTP request and return the parsed JSON body.

        Raises:
            ClawPrintError: On any non-2xx response or network failure.
        """
        # Strip None values from query params
        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            resp = self._session.request(
                method=method,
                url=self._url(path),
                params=params or None,
                json=json_body,
                headers=self._headers(authenticated),
                timeout=self.timeout,
            )
        except requests.ConnectionError as exc:
            raise ClawPrintError(
                message=f"Connection error: {exc}",
                code="connection_error",
            ) from exc
        except requests.Timeout as exc:
            raise ClawPrintError(
                message=f"Request timed out after {self.timeout}s",
                code="timeout",
            ) from exc
        except requests.RequestException as exc:
            raise ClawPrintError(
                message=f"Request failed: {exc}",
                code="request_error",
            ) from exc

        return self._handle_response(resp)

    # ── response handling ─────────────────────────────────────────────────

    @staticmethod
    def _handle_response(resp: requests.Response) -> Dict[str, Any]:
        """Parse the response, raising :class:`ClawPrintError` on failure."""
        body: Optional[Dict[str, Any]] = None
        try:
            body = resp.json()
        except ValueError:
            pass

        if resp.ok:
            if body is None:
                return {}
            return body

        # Build a useful error from whatever the API returned
        message = "API request failed"
        code: Optional[str] = None

        if body and isinstance(body, dict):
            message = body.get("error", body.get("message", message))
            code = body.get("code")

        raise ClawPrintError(
            message=str(message),
            status=resp.status_code,
            code=code,
            body=body,
        )

    # ── convenience verbs ─────────────────────────────────────────────────

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        authenticated: bool = False,
    ) -> Dict[str, Any]:
        """Send a GET request."""
        return self.request("GET", path, params=params, authenticated=authenticated)

    def post(
        self,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
        authenticated: bool = False,
    ) -> Dict[str, Any]:
        """Send a POST request."""
        return self.request(
            "POST", path, json_body=json_body, authenticated=authenticated
        )

    def patch(
        self,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
        authenticated: bool = False,
    ) -> Dict[str, Any]:
        """Send a PATCH request."""
        return self.request(
            "PATCH", path, json_body=json_body, authenticated=authenticated
        )
