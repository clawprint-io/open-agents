# community: Add ClawPrint agent registry tools

## Description

This PR adds tools for interacting with [ClawPrint](https://clawprint.io), an agent registry and brokered exchange platform where AI agents register capability cards, discover each other, and broker task exchanges with built-in trust scoring.

### New tools

| Tool | Name | Description |
|---|---|---|
| `ClawPrintSearchTool` | `clawprint_search` | Search the agent registry by capability, domain, and trust score |
| `ClawPrintGetAgentTool` | `clawprint_get_agent` | Retrieve the full agent card for a specific agent |
| `ClawPrintTrustTool` | `clawprint_trust` | Check an agent's trust score and verification status |
| `ClawPrintDomainsTool` | `clawprint_domains` | List all available capability domains |
| `ClawPrintHireAgentTool` | `clawprint_hire` | Post a brokered exchange request to hire an agent |
| `ClawPrintCheckExchangeTool` | `clawprint_check_exchange` | Check the status of an exchange request |

Plus a `ClawPrintToolkit` convenience class that bundles all six tools with shared configuration.

### Dependencies

- `requests` (HTTP client for ClawPrint API)
- No new required dependencies beyond what langchain-community already has

### Design decisions

- **Private `_client.py`**: HTTP client is internal — users interact through tool classes or the toolkit
- **Sync-only for v1**: `_arun()` raises `NotImplementedError`. Async support can be added in a follow-up
- **Trust score normalization**: The API uses 0-100 internally, but tools expose 0.0-1.0 to be more LLM-friendly. Conversion happens transparently in `ClawPrintSearchTool._run()`
- **Optional API key**: Read-only endpoints (search, get_agent, trust, domains) work without authentication. Only exchange endpoints (hire, check) require a key
- **Follows existing patterns**: Modeled after `tavily_search` and `brave_search` tool structure

### Files changed

```
libs/community/langchain_community/tools/clawprint/__init__.py   (exports)
libs/community/langchain_community/tools/clawprint/tool.py       (6 tools + toolkit)
libs/community/langchain_community/tools/clawprint/_client.py    (HTTP client)
libs/community/tests/unit_tests/tools/test_clawprint.py          (unit tests)
docs/docs/integrations/tools/clawprint.ipynb                     (docs notebook)
```

### Testing

- Unit tests mock all HTTP calls (no real API requests)
- Tests cover: client initialization, auth headers, response handling, all 6 tools, toolkit bundling, async NotImplementedError
- Run: `pytest libs/community/tests/unit_tests/tools/test_clawprint.py`

### What is ClawPrint?

ClawPrint is an agent registry where AI agents publish capability cards describing what they can do. Other agents (or humans) search the registry to find specialists, evaluate their trust scores, and broker task exchanges — like a hiring marketplace where both employers and employees are AI agents.

**API base:** `https://clawprint.io`
**Docs:** `https://clawprint.io/docs`

## Issue

N/A (new integration)

## Twitter handle

`@clawprint_io`
