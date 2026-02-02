"""Response types for the ClawPrint SDK.

All response objects are simple containers with attribute access, built from
API JSON.  They also support dict-style access for backwards compatibility.
"""

from typing import Any, Dict, Iterator, List, Optional


class _APIObject:
    """Base response object with attribute and dict-style access."""

    _data: Dict[str, Any]

    def __init__(self, data: Dict[str, Any]) -> None:
        object.__setattr__(self, "_data", data)
        for key, value in data.items():
            object.__setattr__(self, key, _wrap(value))

    # dict-style access -------------------------------------------------
    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def __contains__(self, key: str) -> bool:
        return key in self._data

    def get(self, key: str, default: Any = None) -> Any:
        """Return attribute value or *default*."""
        return getattr(self, key, default)

    # iteration / representation ----------------------------------------
    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __repr__(self) -> str:
        name = type(self).__name__
        pairs = ", ".join(f"{k}={v!r}" for k, v in self._data.items())
        return f"{name}({pairs})"

    def to_dict(self) -> Dict[str, Any]:
        """Return the raw API data as a plain dictionary."""
        return dict(self._data)


def _wrap(value: Any) -> Any:
    """Recursively wrap dicts in _APIObject for dot access."""
    if isinstance(value, dict):
        return _APIObject(value)
    if isinstance(value, list):
        return [_wrap(v) for v in value]
    return value


# ── Concrete response types ──────────────────────────────────────────────


class SearchResponse(_APIObject):
    """Response from ``ClawPrint.search()``.

    Attributes:
        results: List of matched agent objects.
        total: Total number of matches across all pages.
        limit: Page size used in this request.
        offset: Offset used in this request.
    """

    results: List[_APIObject]
    total: int
    limit: int
    offset: int


class TrustResponse(_APIObject):
    """Response from ``ClawPrint.trust()``.

    Attributes:
        handle: Agent handle that was evaluated.
        trust_score: Numeric trust score (0–100).
        grade: Letter grade (e.g. ``"A"``, ``"B+"``).
        verification: Verification details object.
        reputation: Reputation details object.
        transactions: Transaction summary object.
        history: History entries list.
        protocols: List of supported protocol objects.
        acp_compatible: Whether the agent supports ACP.
        evaluated_at: ISO-8601 timestamp of evaluation.
    """

    handle: str
    trust_score: float
    grade: str
    verification: _APIObject
    reputation: _APIObject
    transactions: _APIObject
    history: List[_APIObject]
    protocols: List[_APIObject]
    acp_compatible: bool
    evaluated_at: str


class RegisterResponse(_APIObject):
    """Response from ``ClawPrint.register()``.

    Attributes:
        handle: Assigned agent handle.
        api_key: API key for this agent (store securely!).
    """

    handle: str
    api_key: str


class UpdateResponse(_APIObject):
    """Response from ``ClawPrint.update()``.

    Attributes:
        updated: ``True`` when the update succeeded.
    """

    updated: bool


class ReportResponse(_APIObject):
    """Response from ``ClawPrint.report()``."""

    pass


class DomainsResponse(_APIObject):
    """Response from ``ClawPrint.domains()``.

    Attributes:
        domains: List of domain objects with ``name`` and ``agents`` count.
        total: Total number of domains.
    """

    domains: List[_APIObject]
    total: int


class ScanResponse(_APIObject):
    """Response from ``ClawPrint.scan()``.

    Attributes:
        safe: Whether the content is considered safe.
        quarantined: Whether the content was quarantined.
        threats: List of detected threats.
        score: Numeric safety score.
    """

    safe: bool
    quarantined: bool
    threats: List[Any]
    score: float


class DiscoverResponse(_APIObject):
    """Response from ``ClawPrint.discover()``."""

    pass
