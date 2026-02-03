"""Unit tests for langchain_community.tools.clawprint.

All HTTP calls are mocked — no real API requests are made.
"""

from __future__ import annotations

import json
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from langchain_community.tools.clawprint._client import (
    ClawPrintAPIError,
    ClawPrintClient,
    CLAWPRINT_DEFAULT_BASE_URL,
)
from langchain_community.tools.clawprint.tool import (
    ClawPrintCheckExchangeTool,
    ClawPrintDomainsTool,
    ClawPrintGetAgentTool,
    ClawPrintHireAgentTool,
    ClawPrintSearchTool,
    ClawPrintToolkit,
    ClawPrintTrustTool,
)


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def mock_client() -> ClawPrintClient:
    """Return a client with a mocked requests.Session."""
    client = ClawPrintClient(api_key="cp_test_key_123")
    client._session = MagicMock()
    return client


def _mock_response(data: Any, status_code: int = 200) -> MagicMock:
    """Build a mock requests.Response."""
    resp = MagicMock()
    resp.ok = 200 <= status_code < 300
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = json.dumps(data) if isinstance(data, dict) else str(data)
    return resp


# ======================================================================
# Client tests
# ======================================================================


class TestClawPrintClient:
    def test_default_base_url(self) -> None:
        client = ClawPrintClient()
        assert client.base_url == CLAWPRINT_DEFAULT_BASE_URL

    def test_custom_base_url_strips_slash(self) -> None:
        client = ClawPrintClient(base_url="https://custom.api.io/")
        assert client.base_url == "https://custom.api.io"

    def test_api_key_from_env(self) -> None:
        with patch.dict("os.environ", {"CLAWPRINT_API_KEY": "cp_env_key"}):
            client = ClawPrintClient()
            assert client.api_key == "cp_env_key"

    def test_explicit_key_overrides_env(self) -> None:
        with patch.dict("os.environ", {"CLAWPRINT_API_KEY": "cp_env_key"}):
            client = ClawPrintClient(api_key="cp_explicit")
            assert client.api_key == "cp_explicit"

    def test_auth_required_without_key_raises(self) -> None:
        client = ClawPrintClient(api_key=None)
        # Ensure env is clean
        with patch.dict("os.environ", {}, clear=True):
            client_no_key = ClawPrintClient(api_key=None)
            with pytest.raises(ClawPrintAPIError, match="requires an API key"):
                client_no_key._headers(auth_required=True)

    def test_auth_header_set(self) -> None:
        client = ClawPrintClient(api_key="cp_test_123")
        headers = client._headers(auth_required=True)
        assert headers["Authorization"] == "Bearer cp_test_123"

    def test_handle_response_success(self, mock_client: ClawPrintClient) -> None:
        resp = _mock_response({"agents": []})
        result = mock_client._handle_response(resp)
        assert result == {"agents": []}

    def test_handle_response_204(self, mock_client: ClawPrintClient) -> None:
        resp = _mock_response(None, status_code=204)
        result = mock_client._handle_response(resp)
        assert result is None

    def test_handle_response_error(self, mock_client: ClawPrintClient) -> None:
        resp = _mock_response({"detail": "Not found"}, status_code=404)
        with pytest.raises(ClawPrintAPIError, match="404"):
            mock_client._handle_response(resp)

    def test_search_agents(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"agents": [{"handle": "@bot1"}]}
        )
        result = mock_client.search_agents("code review")
        mock_client._session.get.assert_called_once()
        call_args = mock_client._session.get.call_args
        assert "/v1/agents/search" in call_args[0][0]
        assert call_args[1]["params"]["q"] == "code review"
        assert result == {"agents": [{"handle": "@bot1"}]}

    def test_search_agents_with_filters(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response({"agents": []})
        mock_client.search_agents("test", domain="code-review", min_score=80.0)
        call_args = mock_client._session.get.call_args
        assert call_args[1]["params"]["domain"] == "code-review"
        assert call_args[1]["params"]["min_score"] == 80.0

    def test_get_agent(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"handle": "@bot1", "name": "Bot One"}
        )
        result = mock_client.get_agent("@bot1")
        assert "/v1/agents/@bot1" in mock_client._session.get.call_args[0][0]
        assert result["handle"] == "@bot1"

    def test_get_trust(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"handle": "@bot1", "score": 85}
        )
        result = mock_client.get_trust("@bot1")
        assert "/v1/trust/@bot1" in mock_client._session.get.call_args[0][0]
        assert result["score"] == 85

    def test_list_domains(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"domains": ["code-review", "translation"]}
        )
        result = mock_client.list_domains()
        assert "/v1/domains" in mock_client._session.get.call_args[0][0]
        assert "code-review" in result["domains"]

    def test_create_exchange_request(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.post.return_value = _mock_response(
            {"request_id": "req_abc123", "status": "pending"}
        )
        result = mock_client.create_exchange_request(
            domains=["code-review"], task="Review my code"
        )
        call_args = mock_client._session.post.call_args
        assert "/v1/exchange/requests" in call_args[0][0]
        payload = call_args[1]["json"]
        assert payload["domains"] == ["code-review"]
        assert payload["task"] == "Review my code"
        assert result["request_id"] == "req_abc123"

    def test_get_exchange_request(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"request_id": "req_abc123", "status": "matched"}
        )
        result = mock_client.get_exchange_request("req_abc123")
        assert "/v1/exchange/requests/req_abc123" in (
            mock_client._session.get.call_args[0][0]
        )
        assert result["status"] == "matched"


# ======================================================================
# Tool tests
# ======================================================================


class TestClawPrintSearchTool:
    def test_name_and_description(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintSearchTool(client=mock_client)
        assert tool.name == "clawprint_search"
        assert "search" in tool.description.lower()

    def test_run_basic_search(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"agents": [{"handle": "@analyst"}]}
        )
        tool = ClawPrintSearchTool(client=mock_client)
        result = tool._run(query="data analysis")
        parsed = json.loads(result)
        assert parsed["agents"][0]["handle"] == "@analyst"

    def test_run_with_trust_conversion(self, mock_client: ClawPrintClient) -> None:
        """min_trust 0.8 should become min_score 80.0 at API level."""
        mock_client._session.get.return_value = _mock_response({"agents": []})
        tool = ClawPrintSearchTool(client=mock_client)
        tool._run(query="test", min_trust=0.8)
        params = mock_client._session.get.call_args[1]["params"]
        assert params["min_score"] == 80.0

    def test_invoke(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response({"agents": []})
        tool = ClawPrintSearchTool(client=mock_client)
        result = tool.invoke({"query": "test"})
        assert isinstance(result, str)


class TestClawPrintGetAgentTool:
    def test_run(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"handle": "@codebot", "name": "Code Bot"}
        )
        tool = ClawPrintGetAgentTool(client=mock_client)
        result = tool._run(handle="@codebot")
        parsed = json.loads(result)
        assert parsed["handle"] == "@codebot"


class TestClawPrintTrustTool:
    def test_run(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"handle": "@codebot", "score": 92, "verified": True}
        )
        tool = ClawPrintTrustTool(client=mock_client)
        result = tool._run(handle="@codebot")
        parsed = json.loads(result)
        assert parsed["score"] == 92


class TestClawPrintDomainsTool:
    def test_run(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"domains": ["code-review", "data-analysis", "translation"]}
        )
        tool = ClawPrintDomainsTool(client=mock_client)
        result = tool._run()
        parsed = json.loads(result)
        assert len(parsed["domains"]) == 3


class TestClawPrintHireAgentTool:
    def test_run(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.post.return_value = _mock_response(
            {"request_id": "req_xyz", "status": "pending"}
        )
        tool = ClawPrintHireAgentTool(client=mock_client)
        result = tool._run(domains=["code-review"], task="Review my PR")
        parsed = json.loads(result)
        assert parsed["request_id"] == "req_xyz"

    def test_run_with_requirements(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.post.return_value = _mock_response(
            {"request_id": "req_xyz", "status": "pending"}
        )
        tool = ClawPrintHireAgentTool(client=mock_client)
        result = tool._run(
            domains=["code-review"],
            task="Review my PR",
            requirements={"budget": 100, "deadline": "2025-12-31"},
        )
        payload = mock_client._session.post.call_args[1]["json"]
        assert payload["requirements"]["budget"] == 100


class TestClawPrintCheckExchangeTool:
    def test_run(self, mock_client: ClawPrintClient) -> None:
        mock_client._session.get.return_value = _mock_response(
            {"request_id": "req_xyz", "status": "completed"}
        )
        tool = ClawPrintCheckExchangeTool(client=mock_client)
        result = tool._run(request_id="req_xyz")
        parsed = json.loads(result)
        assert parsed["status"] == "completed"


# ======================================================================
# Toolkit tests
# ======================================================================


class TestClawPrintToolkit:
    def test_get_tools_returns_six(self) -> None:
        toolkit = ClawPrintToolkit(api_key="cp_test_key")
        tools = toolkit.get_tools()
        assert len(tools) == 6

    def test_tool_names(self) -> None:
        toolkit = ClawPrintToolkit(api_key="cp_test_key")
        tools = toolkit.get_tools()
        names = {t.name for t in tools}
        expected = {
            "clawprint_search",
            "clawprint_get_agent",
            "clawprint_trust",
            "clawprint_domains",
            "clawprint_hire",
            "clawprint_check_exchange",
        }
        assert names == expected

    def test_shared_client(self) -> None:
        toolkit = ClawPrintToolkit(api_key="cp_test_key")
        tools = toolkit.get_tools()
        clients = {id(t.client) for t in tools}  # type: ignore[attr-defined]
        assert len(clients) == 1, "All tools should share the same client"

    def test_default_no_key(self) -> None:
        """Toolkit can be created without a key (read-only use)."""
        with patch.dict("os.environ", {}, clear=True):
            toolkit = ClawPrintToolkit()
            tools = toolkit.get_tools()
            assert len(tools) == 6


# ======================================================================
# Async raises
# ======================================================================


class TestAsyncNotImplemented:
    @pytest.mark.asyncio
    async def test_search_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintSearchTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun(query="test")

    @pytest.mark.asyncio
    async def test_get_agent_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintGetAgentTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun(handle="@test")

    @pytest.mark.asyncio
    async def test_trust_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintTrustTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun(handle="@test")

    @pytest.mark.asyncio
    async def test_domains_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintDomainsTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun()

    @pytest.mark.asyncio
    async def test_hire_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintHireAgentTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun(domains=["test"], task="test")

    @pytest.mark.asyncio
    async def test_check_exchange_arun(self, mock_client: ClawPrintClient) -> None:
        tool = ClawPrintCheckExchangeTool(client=mock_client)
        with pytest.raises(NotImplementedError):
            await tool._arun(request_id="req_test")
