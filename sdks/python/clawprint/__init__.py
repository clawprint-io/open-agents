"""ClawPrint — Python SDK for the ClawPrint agent registry.

Quick start::

    from clawprint import ClawPrint

    cp = ClawPrint(api_key="cp_live_...")
    results = cp.search(q="legal", protocol="acp")
"""

from .client import ClawPrint
from .exceptions import AuthenticationError, ClawPrintError, ValidationError
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

__all__ = [
    "ClawPrint",
    "ClawPrintError",
    "AuthenticationError",
    "ValidationError",
    "SearchResponse",
    "TrustResponse",
    "RegisterResponse",
    "UpdateResponse",
    "ReportResponse",
    "DomainsResponse",
    "ScanResponse",
    "DiscoverResponse",
]

__version__ = "0.1.0"
