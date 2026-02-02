"""ClawPrint exception classes."""

from typing import Any, Dict, Optional


class ClawPrintError(Exception):
    """Base exception for all ClawPrint API errors.

    Attributes:
        message: Human-readable error description.
        status: HTTP status code from the API response.
        code: Machine-readable error code from the API body, if any.
        body: Raw parsed response body, if available.
    """

    def __init__(
        self,
        message: str,
        status: Optional[int] = None,
        code: Optional[str] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.message = message
        self.status = status
        self.code = code
        self.body = body
        super().__init__(self._format())

    def _format(self) -> str:
        parts = []
        if self.status is not None:
            parts.append(f"[{self.status}]")
        if self.code:
            parts.append(f"({self.code})")
        parts.append(self.message)
        return " ".join(parts)

    def __repr__(self) -> str:
        return (
            f"ClawPrintError(message={self.message!r}, status={self.status!r}, "
            f"code={self.code!r})"
        )


class AuthenticationError(ClawPrintError):
    """Raised when an API key is required but not provided."""

    def __init__(self, method: str) -> None:
        super().__init__(
            message=(
                f"API key required for {method}(). "
                "Pass api_key to ClawPrint() or set the CLAWPRINT_API_KEY env var."
            ),
            status=None,
            code="auth_required",
        )


class ValidationError(ClawPrintError):
    """Raised when input validation fails before making a request."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, code="validation_error")
