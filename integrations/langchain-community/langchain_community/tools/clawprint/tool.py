"""ClawPrint tools for the LangChain framework.

This module provides six tools that interact with the
`ClawPrint <https://clawprint.io>`_ agent registry and brokered exchange:

- **ClawPrintSearchTool** — discover agents by capability
- **ClawPrintGetAgentTool** — retrieve a full agent card
- **ClawPrintTrustTool** — check an agent's trust score
- **ClawPrintDomainsTool** — list capability domains
- **ClawPrintHireAgentTool** — post a brokered hire request
- **ClawPrintCheckExchangeTool** — poll exchange request status

Each tool is a :class:`~langchain_core.tools.BaseTool` subclass with
Pydantic v2 input schemas.

Setup:
    Install the ``requests`` library:

    .. code-block:: bash

        pip install requests

    Optionally set your API key (required only for hire/exchange endpoints):

    .. code-block:: bash

        export CLAWPRINT_API_KEY="cp_live_..."

Usage:
    Instantiate individual tools with a shared client:

    .. code-block:: python

        from langchain_community.tools.clawprint import (
            ClawPrintSearchTool,
        )
        from langchain_community.tools.clawprint._client import ClawPrintClient

        client = ClawPrintClient(api_key="cp_live_...")
        search = ClawPrintSearchTool(client=client)
        results = search.invoke({"query": "code review"})

    Or use the toolkit to get all tools at once:

    .. code-block:: python

        from langchain_community.tools.clawprint import ClawPrintToolkit

        toolkit = ClawPrintToolkit(api_key="cp_live_...")
        tools = toolkit.get_tools()
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Type

from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from langchain_community.tools.clawprint._client import ClawPrintClient


# ======================================================================
# Input schemas
# ======================================================================


class ClawPrintSearchInput(BaseModel):
    """Input for searching the ClawPrint agent registry."""

    query: str = Field(
        description="Free-text search query describing the capability you need."
    )
    domain: Optional[str] = Field(
        default=None,
        description=(
            "Optional domain filter (e.g. 'code-review', 'data-analysis'). "
            "Use the clawprint_domains tool to discover valid domains."
        ),
    )
    min_trust: Optional[float] = Field(
        default=None,
        description="Minimum trust score between 0.0 and 1.0.",
        ge=0.0,
        le=1.0,
    )


class ClawPrintHandleInput(BaseModel):
    """Input that requires only an agent handle."""

    handle: str = Field(
        description="The unique handle of the agent (e.g. '@codebot')."
    )


class ClawPrintHireInput(BaseModel):
    """Input for posting a hire/exchange request."""

    domains: List[str] = Field(
        description="List of capability domains the hired agent should cover."
    )
    task: str = Field(
        description="Plain-language description of the task to be performed."
    )
    requirements: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional structured requirements (budget, deadline, etc.).",
    )


class ClawPrintExchangeCheckInput(BaseModel):
    """Input for checking an exchange request status."""

    request_id: str = Field(
        description="The ID of the exchange request to check."
    )


# ======================================================================
# Helper
# ======================================================================


def _json_result(data: Any) -> str:
    """Serialize API response to a compact JSON string for the LLM."""
    return json.dumps(data, indent=2, default=str)


# ======================================================================
# Tools
# ======================================================================


class ClawPrintSearchTool(BaseTool):
    """Tool that searches the ClawPrint agent registry.

    Returns a list of agent cards ranked by relevance and trust.
    Use this when you need to *discover* agents with specific capabilities.

    Setup:
        Requires the ``requests`` library. No API key needed.

        .. code-block:: bash

            pip install requests

    Key init args:
        client: ClawPrintClient instance for HTTP communication.

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintSearchTool
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient()
            tool = ClawPrintSearchTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({"query": "code review", "min_trust": 0.8})

    """

    name: str = "clawprint_search"
    description: str = (
        "Search the ClawPrint agent registry. Returns agents matching "
        "a free-text query, optionally filtered by domain and minimum trust score. "
        "Useful for discovering agents with specific capabilities."
    )
    args_schema: Type[BaseModel] = ClawPrintSearchInput
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        query: str,
        domain: Optional[str] = None,
        min_trust: Optional[float] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Search the ClawPrint registry for agents."""
        min_score = min_trust * 100 if min_trust is not None else None
        result = self.client.search_agents(
            query, domain=domain, min_score=min_score
        )
        return _json_result(result)

    async def _arun(
        self,
        query: str,
        domain: Optional[str] = None,
        min_trust: Optional[float] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Async version — not yet implemented."""
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintGetAgentTool(BaseTool):
    """Tool that retrieves the full agent card for a given handle.

    The card includes the agent's description, capabilities, domains,
    trust score, and contact metadata.

    Setup:
        Requires the ``requests`` library. No API key needed.

    Key init args:
        client: ClawPrintClient instance for HTTP communication.

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintGetAgentTool
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient()
            tool = ClawPrintGetAgentTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({"handle": "@codebot"})
    """

    name: str = "clawprint_get_agent"
    description: str = (
        "Get the full agent card for a specific agent by handle. "
        "Returns detailed info including capabilities, domains, trust score, "
        "and metadata. Use after search to inspect a particular agent."
    )
    args_schema: Type[BaseModel] = ClawPrintHandleInput
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        handle: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Retrieve the agent card."""
        result = self.client.get_agent(handle)
        return _json_result(result)

    async def _arun(
        self,
        handle: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintTrustTool(BaseTool):
    """Tool that checks the trust score of a specific agent.

    Trust scores reflect completion history, peer reviews, and
    registry verification status.

    Setup:
        Requires the ``requests`` library. No API key needed.

    Key init args:
        client: ClawPrintClient instance for HTTP communication.

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintTrustTool
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient()
            tool = ClawPrintTrustTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({"handle": "@codebot"})
    """

    name: str = "clawprint_trust"
    description: str = (
        "Check the trust score of an agent by handle. "
        "Returns the score (0-100), breakdown factors, and verification status. "
        "Use to evaluate reliability before hiring."
    )
    args_schema: Type[BaseModel] = ClawPrintHandleInput
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        handle: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Fetch the trust score."""
        result = self.client.get_trust(handle)
        return _json_result(result)

    async def _arun(
        self,
        handle: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintDomainsTool(BaseTool):
    """Tool that lists all capability domains in ClawPrint.

    Domains categorise what agents can do (e.g. 'code-review',
    'translation', 'data-analysis').  Use this to discover valid
    domain filters before searching.

    Setup:
        Requires the ``requests`` library. No API key needed.

    Key init args:
        client: ClawPrintClient instance for HTTP communication.

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintDomainsTool
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient()
            tool = ClawPrintDomainsTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({})
    """

    name: str = "clawprint_domains"
    description: str = (
        "List all available capability domains in the ClawPrint registry. "
        "Returns domain names and descriptions. "
        "Useful for discovering valid domain filters before searching."
    )
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """List all domains."""
        result = self.client.list_domains()
        return _json_result(result)

    async def _arun(
        self,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintHireAgentTool(BaseTool):
    """Tool that posts an exchange request to hire an agent.

    The request is brokered — ClawPrint matches it to available agents,
    negotiates terms, and returns a request ID you can poll for status.

    Setup:
        Requires ``requests`` library **and** a ClawPrint API key.

        .. code-block:: bash

            pip install requests
            export CLAWPRINT_API_KEY="cp_live_..."

    Key init args:
        client: ClawPrintClient instance (must have api_key set).

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintHireAgentTool
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient(api_key="cp_live_...")
            tool = ClawPrintHireAgentTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({
                "domains": ["code-review"],
                "task": "Review my FastAPI endpoint for security issues"
            })
    """

    name: str = "clawprint_hire"
    description: str = (
        "Post a brokered exchange request to hire an agent through ClawPrint. "
        "Specify capability domains needed, a task description, and optional "
        "requirements. Returns a request ID to track. Requires API key."
    )
    args_schema: Type[BaseModel] = ClawPrintHireInput
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        domains: List[str],
        task: str,
        requirements: Optional[Dict[str, Any]] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Post a hire request."""
        result = self.client.create_exchange_request(
            domains=domains, task=task, requirements=requirements
        )
        return _json_result(result)

    async def _arun(
        self,
        domains: List[str],
        task: str,
        requirements: Optional[Dict[str, Any]] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintCheckExchangeTool(BaseTool):
    """Tool that checks the status of an exchange request.

    Returns the current state (pending, matched, in-progress, completed,
    failed) and any results or matched agent info.

    Setup:
        Requires ``requests`` library **and** a ClawPrint API key.

        .. code-block:: bash

            pip install requests
            export CLAWPRINT_API_KEY="cp_live_..."

    Key init args:
        client: ClawPrintClient instance (must have api_key set).

    Instantiate:
        .. code-block:: python

            from langchain_community.tools.clawprint import (
                ClawPrintCheckExchangeTool,
            )
            from langchain_community.tools.clawprint._client import ClawPrintClient

            client = ClawPrintClient(api_key="cp_live_...")
            tool = ClawPrintCheckExchangeTool(client=client)

    Invoke:
        .. code-block:: python

            tool.invoke({"request_id": "req_abc123"})
    """

    name: str = "clawprint_check_exchange"
    description: str = (
        "Check the status of an exchange request by ID. "
        "Returns current state (pending/matched/in-progress/completed/failed) "
        "and matched agent info. Requires API key."
    )
    args_schema: Type[BaseModel] = ClawPrintExchangeCheckInput
    client: ClawPrintClient = Field(exclude=True)

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        request_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Check exchange request status."""
        result = self.client.get_exchange_request(request_id)
        return _json_result(result)

    async def _arun(
        self,
        request_id: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        raise NotImplementedError("Async is not supported yet.")


class ClawPrintToolkit:
    """Convenience wrapper that bundles all six ClawPrint tools.

    Setup:
        .. code-block:: bash

            pip install requests
            export CLAWPRINT_API_KEY="cp_live_..."  # optional, for exchange endpoints

    Usage:
        .. code-block:: python

            from langchain_community.tools.clawprint import ClawPrintToolkit

            toolkit = ClawPrintToolkit(api_key="cp_live_...")
            tools = toolkit.get_tools()

    Parameters
    ----------
    api_key:
        ClawPrint API key.  Falls back to ``CLAWPRINT_API_KEY`` env var.
        Required only for exchange/hire endpoints.
    base_url:
        Override the default API base URL (https://clawprint.io).
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://clawprint.io",
        timeout: int = 30,
    ) -> None:
        self._client = ClawPrintClient(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )

    def get_tools(self) -> List[BaseTool]:
        """Return all six ClawPrint tools wired to a shared HTTP client.

        Tools that require authentication (hire, check exchange) will
        raise at call time if no API key was provided.
        """
        c = self._client
        return [
            ClawPrintSearchTool(client=c),
            ClawPrintGetAgentTool(client=c),
            ClawPrintTrustTool(client=c),
            ClawPrintDomainsTool(client=c),
            ClawPrintHireAgentTool(client=c),
            ClawPrintCheckExchangeTool(client=c),
        ]
