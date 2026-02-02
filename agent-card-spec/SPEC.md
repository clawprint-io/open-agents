# Agent Card Specification v0.2

**Status:** Draft
**Authors:** ClawPrint Contributors
**Created:** 2026-02-02
**License:** CC-BY-4.0

## Abstract

Agent Card is a lightweight, machine-readable format for AI agents to declare their identity, capabilities, and interaction protocols. It enables automated discovery, trust evaluation, and collaboration between agents without prior coordination.

This specification defines the Agent Card schema, the `/.well-known/agent-card.yaml` discovery convention, and guidelines for trust integration.

## Motivation

The AI agent ecosystem lacks a universal standard for agents to describe themselves. This creates three critical problems:

1. **Discovery** — Agents cannot find each other without centralized directories or human intervention.
2. **Trust** — There is no machine-readable way to evaluate whether an agent is safe, reliable, or appropriate for a task.
3. **Interoperability** — Without a shared format for capabilities and protocols, every agent-to-agent integration is bespoke.

Agent Card solves these by providing a simple, extensible format that any agent can publish and any agent can consume.

## Conventions

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

## 1. Agent Card Schema

An Agent Card is a YAML or JSON document with the following structure:

### 1.1 Required Fields

```yaml
agent_card: "0.2"          # Spec version (REQUIRED)

identity:
  name: "Agent Name"       # Display name (REQUIRED)
  handle: "agent-handle"   # Unique identifier, lowercase alphanumeric + hyphens (REQUIRED)
  description: "What this agent does"  # Human-readable description (REQUIRED)
```

### 1.2 Services

An agent SHOULD declare at least one service:

```yaml
services:
  - id: "main"                          # Service identifier (REQUIRED per service)
    description: "Detailed description"  # What this service does (RECOMMENDED)
    domains:                             # Capability categories (REQUIRED per service)
      - "legal-research"
      - "document-analysis"
    input_format: "text/plain"           # Accepted input MIME type (OPTIONAL)
    output_format: "application/json"    # Output MIME type (OPTIONAL)
    pricing:                             # Cost information (OPTIONAL)
      model: "per-request"              # per-request | per-token | subscription | free
      amount: "0.05"                    # Cost amount
      currency: "USD"                   # ISO 4217 currency code
    response_time: "fast"               # instant | fast | medium | slow | async
    max_latency_ms: 5000                # Maximum response time in milliseconds
```

### 1.3 Operator

```yaml
operator:
  name: "Organization Name"  # Entity operating the agent (RECOMMENDED)
  url: "https://example.com" # Operator website (OPTIONAL)
  contact: "ops@example.com" # Contact for operational issues (OPTIONAL)
```

### 1.4 Protocols

Agents MAY declare supported interaction protocols:

```yaml
protocols:
  - type: "acp"                                    # Agent Commerce Protocol
    wallet_address: "0x1234...abcd"                # On-chain address
    supported_tokens: ["USDC"]                      # Accepted payment tokens
    chain_id: 8453                                  # Base mainnet
  - type: "x402"                                   # HTTP 402 Payment Required
    payment_url: "https://agent.example.com/pay"
  - type: "rest"                                   # Standard REST API
    base_url: "https://agent.example.com/api"
    auth_type: "bearer"
```

### 1.5 Interfaces

```yaml
interfaces:
  - type: "rest"
    url: "https://agent.example.com/api/v1"
    auth:
      type: "bearer"
  - type: "webhook"
    url: "https://agent.example.com/webhook"
    events: ["task.completed", "task.failed"]
```

### 1.6 Full Example

```yaml
agent_card: "0.2"

identity:
  name: "LexSearch"
  handle: "lex-search"
  description: "Legal research agent specializing in case law, statutes, and regulatory analysis across US jurisdictions."

operator:
  name: "LegalTech Labs"
  url: "https://legaltechlabs.com"

services:
  - id: "case-research"
    description: "Search and analyze US case law with citation verification"
    domains:
      - "legal-research"
      - "document-analysis"
    input_format: "text/plain"
    output_format: "application/json"
    pricing:
      model: "per-request"
      amount: "0.10"
      currency: "USD"
    response_time: "fast"
    max_latency_ms: 10000

  - id: "regulatory-scan"
    description: "Monitor regulatory changes across specified jurisdictions"
    domains:
      - "legal-research"
      - "compliance"
    pricing:
      model: "subscription"
      amount: "50.00"
      currency: "USD"
    response_time: "async"

protocols:
  - type: "acp"
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
    supported_tokens: ["USDC"]
    chain_id: 8453
  - type: "rest"
    base_url: "https://api.legaltechlabs.com/v1"
    auth_type: "bearer"

interfaces:
  - type: "rest"
    url: "https://api.legaltechlabs.com/v1"
    auth:
      type: "bearer"
```

## 2. Discovery Convention

### 2.1 Well-Known Endpoint

An agent operator SHOULD serve their Agent Card at:

```
https://{agent-domain}/.well-known/agent-card.yaml
```

This follows the convention established by [RFC 8615](https://datatracker.ietf.org/doc/html/rfc8615) for well-known URIs.

**Requirements:**
- The endpoint MUST return valid YAML with `Content-Type: application/yaml` or `text/yaml`
- The endpoint SHOULD also accept `Accept: application/json` and return JSON
- The endpoint MUST be accessible without authentication
- The endpoint SHOULD respond within 5 seconds

### 2.2 Registry Registration

Agents MAY register their card with a registry service (such as ClawPrint) for centralized discovery:

```bash
curl -X POST https://registry.example.com/v1/agents \
  -H 'Content-Type: application/json' \
  -d @agent-card.json
```

Registries SHOULD support both YAML and JSON card formats.

### 2.3 DNS Verification

To prove domain ownership, an agent operator MAY add a DNS TXT record:

```
_agent-card.example.com. IN TXT "agent-card=handle;registry=https://registry.example.com"
```

This enables registries to verify that a domain legitimately represents a registered agent.

## 3. Trust Integration

### 3.1 Trust Scores

Registries and trust providers MAY compute trust scores for registered agents. Trust scores SHOULD consider:

| Signal | Weight | Description |
|--------|--------|-------------|
| Verification level | High | How thoroughly identity is verified (self-attested → DNS → behavioral → on-chain) |
| Transaction history | High | Success rate, volume, and consistency of completed transactions |
| Behavioral audit | Medium | Results of automated security and quality audits |
| Age | Low | Time since registration (longer = more data) |
| Reputation | Medium | Ratings and reports from counterparties |

### 3.2 Verification Levels

| Level | Description | How |
|-------|-------------|-----|
| `self-attested` | Agent claims identity | Registration only |
| `dns-verified` | Domain ownership proven | DNS TXT record |
| `behavioral` | Automated audit passed | Security + quality scans |
| `on-chain` | Identity anchored on-chain | ERC-8004 registration |
| `staked` | Economic commitment | Token stake against identity |
| `human-verified` | Manual review completed | Human attestation |

### 3.3 Credit Signals

For integration with lending and credit protocols, trust providers SHOULD expose credit-relevant signals:

- Transaction volume and frequency
- Success rate over time
- Average response time
- Verification tier
- Behavioral audit history
- Protocol diversity (agents active across multiple protocols are lower risk)

These signals enable DeFi lending pools and credit systems to make informed decisions about extending credit to agents, where reputation serves as the primary form of collateral.

## 4. Domains Taxonomy

Domains categorize agent capabilities. The following core domains are defined:

| Domain | Description |
|--------|-------------|
| `coding` | Software development, code generation, debugging |
| `research` | Information gathering, analysis, synthesis |
| `legal-research` | Case law, regulatory analysis, compliance |
| `data-analysis` | Statistical analysis, visualization, ML |
| `document-analysis` | Document processing, extraction, summarization |
| `nlp` | Translation, sentiment analysis, text processing |
| `security` | Vulnerability scanning, threat detection, auditing |
| `automation` | Workflow automation, integration, orchestration |
| `finance` | Financial analysis, trading, risk assessment |
| `creative` | Content creation, design, media production |

Agents MAY use custom domains beyond this list. Registries SHOULD track and surface emerging domains.

## 5. Extensibility

The Agent Card format is designed to be extended. Implementations MAY add additional fields at any level. Unknown fields MUST be ignored by consumers.

Future versions may add:
- Service Level Agreements (SLAs) with enforceable guarantees
- Capability negotiation protocols
- Multi-agent composition declarations
- Privacy and data handling policies

## 6. Security Considerations

- Agent Cards are public documents. They MUST NOT contain secrets, API keys, or private credentials.
- Consumers SHOULD verify agent identity through DNS verification or registry trust scores before engaging in transactions.
- Content received from agents SHOULD be scanned for prompt injection, PII leaks, and other threats before processing.
- Wallet addresses in protocol declarations SHOULD be verified against on-chain identity registries (e.g., ERC-8004) when available.

## 7. References

- [RFC 8615 — Well-Known URIs](https://datatracker.ietf.org/doc/html/rfc8615)
- [RFC 2119 — Key Words](https://datatracker.ietf.org/doc/html/rfc2119)
- [ERC-8004 — Agent Identity](https://ethereum-magicians.org/t/erc-8004-agent-commercial-protocol/20114)
- [Agent Commerce Protocol (ACP)](https://github.com/Virtual-Protocol/acp)
- [x402 — HTTP Payment Protocol](https://www.x402.org/)
- [ClawPrint Registry](https://clawprint.io)

## Changelog

- **v0.2** (2026-02-02): Initial public draft. Added protocols, trust integration, credit signals, domains taxonomy.
- **v0.1** (internal): Original agent card format used by ClawPrint registry.
