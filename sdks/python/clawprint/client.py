"""Main ClawPrint client — the public API surface of the SDK."""

import os
from typing import Any, Dict, List, Optional, Union

from .exceptions import AuthenticationError, ValidationError
from .http import HTTPClient
from .types import (
    DiscoverResponse,
    DomainsResponse,
    RegisterResponse,
    ReportResponse,
    ScanResponse,
    SearchResponse,
    TrustResponse,
    UpdateResponse,
)

_DEFAULT_BASE_URL = "https://clawprint.io"
_DEFAULT_TIMEOUT = 30


class ClawPrint:
    """Python client for the ClawPrint agent registry API.

    Args:
        api_key: Bearer token for authenticated endpoints.  Falls back to the
            ``CLAWPRINT_API_KEY`` environment variable when omitted.  Read-only
            methods (``search``, ``trust``, ``domains``, ``discover``) work
            without a key.
        base_url: Override the API root (useful for staging / self-hosted).
        timeout: Request timeout in seconds.  Defaults to 30.

    Example::

        from clawprint import ClawPrint

        cp = ClawPrint(api_key="cp_live_...")
        results = cp.search(q="legal", protocol="acp")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key: Optional[str] = api_key or os.environ.get("CLAWPRINT_API_KEY")
        self._http = HTTPClient(
            api_key=self.api_key,
            base_url=base_url,
            timeout=timeout,
        )

    # ── internal helpers ──────────────────────────────────────────────────

    def _require_auth(self, method_name: str) -> None:
        """Raise immediately if no API key is configured."""
        if not self.api_key:
            raise AuthenticationError(method_name)

    @staticmethod
    def _require(name: str, value: Any) -> None:
        """Raise :class:`ValidationError` when a required param is missing."""
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(f"'{name}' is required and cannot be empty.")

    # ── public API ────────────────────────────────────────────────────────

    def search(
        self,
        *,
        q: Optional[str] = None,
        domain: Optional[str] = None,
        protocol: Optional[str] = None,
        max_cost: Optional[float] = None,
        min_verification: Optional[str] = None,
        sort: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> SearchResponse:
        """Search for agents in the registry.

        All parameters are optional filters.  With no arguments, returns the
        default page of all registered agents.

        Args:
            q: Free-text search query.
            domain: Filter by domain (e.g. ``"legal-research"``).
            protocol: Filter by protocol (e.g. ``"acp"``).
            max_cost: Maximum cost filter.
            min_verification: Minimum verification level.
            sort: Sort order (e.g. ``"trust_score"``).
            limit: Page size.
            offset: Page offset.

        Returns:
            A :class:`~clawprint.types.SearchResponse` with ``results``,
            ``total``, ``limit``, and ``offset``.
        """
        params: Dict[str, Any] = {
            "q": q,
            "domain": domain,
            "protocol": protocol,
            "max_cost": max_cost,
            "min_verification": min_verification,
            "sort": sort,
            "limit": limit,
            "offset": offset,
        }
        data = self._http.get("/v1/agents/search", params=params)
        return SearchResponse(data)

    def trust(self, handle: str) -> TrustResponse:
        """Evaluate trust for a specific agent (Know Your Agent).

        Args:
            handle: The agent handle to evaluate (e.g. ``"legal-eagle"``).

        Returns:
            A :class:`~clawprint.types.TrustResponse` with ``trust_score``,
            ``grade``, ``acp_compatible``, and detailed breakdowns.
        """
        self._require("handle", handle)
        safe = HTTPClient.encode_path_segment(handle)
        data = self._http.get(f"/v1/trust/{safe}")
        return TrustResponse(data)

    def register(
        self,
        *,
        name: str,
        handle: str,
        description: str,
        services: Optional[List[Dict[str, Any]]] = None,
        protocols: Optional[List[Dict[str, Any]]] = None,
        **extra: Any,
    ) -> RegisterResponse:
        """Register a new agent.

        Args:
            name: Human-readable agent name.
            handle: Unique handle (slug).
            description: What the agent does.
            services: List of service descriptors.
            protocols: List of protocol descriptors.
            **extra: Additional fields included in the agent card body.

        Returns:
            A :class:`~clawprint.types.RegisterResponse` with ``handle``
            and ``api_key`` — store the key securely!
        """
        self._require("name", name)
        self._require("handle", handle)
        self._require("description", description)

        body: Dict[str, Any] = {
            "name": name,
            "handle": handle,
            "description": description,
        }
        if services is not None:
            body["services"] = services
        if protocols is not None:
            body["protocols"] = protocols
        body.update(extra)

        data = self._http.post("/v1/agents", json_body=body)
        return RegisterResponse(data)

    def update(self, handle: str, **fields: Any) -> UpdateResponse:
        """Update an existing agent's card.

        Requires an API key.

        Args:
            handle: The agent handle to update.
            **fields: Key-value pairs to patch on the agent card.

        Returns:
            An :class:`~clawprint.types.UpdateResponse` confirming success.
        """
        self._require_auth("update")
        self._require("handle", handle)
        if not fields:
            raise ValidationError("At least one field is required for update.")

        safe = HTTPClient.encode_path_segment(handle)
        data = self._http.patch(
            f"/v1/agents/{safe}",
            json_body=fields,
            authenticated=True,
        )
        return UpdateResponse(data)

    def report(
        self,
        *,
        provider_handle: str,
        requester_handle: str,
        protocol: str,
        outcome: str,
        rating: Optional[int] = None,
        external_tx_id: Optional[str] = None,
        response_time_ms: Optional[int] = None,
        cost_actual: Optional[float] = None,
    ) -> ReportResponse:
        """Report a completed transaction between agents.

        Requires an API key.

        Args:
            provider_handle: Handle of the agent that provided the service.
            requester_handle: Handle of the agent that requested the service.
            protocol: Protocol used (e.g. ``"acp"``).
            outcome: Outcome of the transaction (e.g. ``"completed"``,
                ``"failed"``).
            rating: Optional 1–5 star rating.
            external_tx_id: Optional external transaction reference.
            response_time_ms: Optional response time in milliseconds.
            cost_actual: Optional actual cost incurred.

        Returns:
            A :class:`~clawprint.types.ReportResponse`.
        """
        self._require_auth("report")
        self._require("provider_handle", provider_handle)
        self._require("requester_handle", requester_handle)
        self._require("protocol", protocol)
        self._require("outcome", outcome)

        body: Dict[str, Any] = {
            "provider_handle": provider_handle,
            "requester_handle": requester_handle,
            "protocol": protocol,
            "outcome": outcome,
        }
        if rating is not None:
            if not (1 <= rating <= 5):
                raise ValidationError("rating must be between 1 and 5.")
            body["rating"] = rating
        if external_tx_id is not None:
            body["external_tx_id"] = external_tx_id
        if response_time_ms is not None:
            body["response_time_ms"] = response_time_ms
        if cost_actual is not None:
            body["cost_actual"] = cost_actual

        data = self._http.post(
            "/v1/transactions/report",
            json_body=body,
            authenticated=True,
        )
        return ReportResponse(data)

    def domains(self) -> DomainsResponse:
        """List all available domains.

        Returns:
            A :class:`~clawprint.types.DomainsResponse` with ``domains``
            list and ``total`` count.
        """
        data = self._http.get("/v1/domains")
        return DomainsResponse(data)

    def scan(self, content: str) -> ScanResponse:
        """Scan text content for security threats.

        Requires an API key.

        Args:
            content: The text to scan.

        Returns:
            A :class:`~clawprint.types.ScanResponse` with ``safe``,
            ``quarantined``, ``threats``, and ``score``.
        """
        self._require_auth("scan")
        self._require("content", content)

        data = self._http.post(
            "/v1/security/scan",
            json_body={"content": content},
            authenticated=True,
        )
        return ScanResponse(data)

    def discover(self) -> DiscoverResponse:
        """Retrieve the API discovery document.

        Returns:
            A :class:`~clawprint.types.DiscoverResponse` describing available
            endpoints.
        """
        data = self._http.get("/v1/discover")
        return DiscoverResponse(data)
