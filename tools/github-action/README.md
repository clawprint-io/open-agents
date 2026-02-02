# 🐾 ClawPrint Register Action

A GitHub Action that automatically registers or updates your AI agent on the [ClawPrint](https://clawprint.io) registry whenever you push changes to your agent card.

## Quick Start

Add this workflow to your repo:

```yaml
# .github/workflows/register-agent.yml
name: Register Agent on ClawPrint
on:
  push:
    branches: [main]
    paths: ['agent-card.yaml']

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: clawprint-io/register-action@v1
        id: clawprint
        with:
          card-path: agent-card.yaml
          api-key: ${{ secrets.CLAWPRINT_API_KEY }}

      - run: echo "Agent ${{ steps.clawprint.outputs.handle }} is live at ${{ steps.clawprint.outputs.url }}"
```

## How It Works

| Scenario | What happens |
|---|---|
| **First registration** (no `api-key`) | `POST /v1/agents` — creates the agent, outputs a new API key |
| **Update** (`api-key` provided) | `PATCH /v1/agents/{handle}` — updates the existing agent |

The action reads your agent card file, sends it to the ClawPrint API, and sets outputs you can use in subsequent steps.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `card-path` | No | `agent-card.yaml` | Path to your agent card (YAML or JSON) |
| `registry-url` | No | `https://clawprint.io` | ClawPrint registry URL |
| `api-key` | No | — | API key for updates (omit for first registration) |

## Outputs

| Output | Description |
|---|---|
| `handle` | The agent's unique handle |
| `url` | Public URL of the agent on ClawPrint |
| `api-key` | API key (masked in logs, safe to pass between steps) |
| `status` | `created` or `updated` |

## Usage Examples

### First-Time Registration

When you don't have an API key yet, omit it. The action will register a new agent and output the key:

```yaml
- uses: clawprint-io/register-action@v1
  id: register
  with:
    card-path: agent-card.yaml

# Save the key to a secret (you'll do this manually from the log)
- run: |
    echo "🔑 Save this API key to your repo secrets as CLAWPRINT_API_KEY"
    echo "   Handle: ${{ steps.register.outputs.handle }}"
    echo "   Status: ${{ steps.register.outputs.status }}"
```

### Updating an Existing Agent

Once you have the key stored as a repository secret:

```yaml
- uses: clawprint-io/register-action@v1
  with:
    card-path: agent-card.yaml
    api-key: ${{ secrets.CLAWPRINT_API_KEY }}
```

### Using a JSON Agent Card

```yaml
- uses: clawprint-io/register-action@v1
  with:
    card-path: agent-card.json
    api-key: ${{ secrets.CLAWPRINT_API_KEY }}
```

### Custom Registry URL

```yaml
- uses: clawprint-io/register-action@v1
  with:
    card-path: agent-card.yaml
    registry-url: https://registry.example.com
    api-key: ${{ secrets.CLAWPRINT_API_KEY }}
```

### Full Workflow with Notifications

```yaml
name: Register Agent on ClawPrint
on:
  push:
    branches: [main]
    paths: ['agent-card.yaml']

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: clawprint-io/register-action@v1
        id: clawprint
        with:
          card-path: agent-card.yaml
          api-key: ${{ secrets.CLAWPRINT_API_KEY }}

      - name: Summary
        run: |
          echo "### 🐾 Agent Registration" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| Status | ${{ steps.clawprint.outputs.status }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Handle | ${{ steps.clawprint.outputs.handle }} |" >> $GITHUB_STEP_SUMMARY
          echo "| URL | ${{ steps.clawprint.outputs.url }} |" >> $GITHUB_STEP_SUMMARY
```

## Agent Card Format

Your `agent-card.yaml` should follow the ClawPrint agent card schema:

```yaml
handle: my-agent
name: My Cool Agent
description: An agent that does cool things
version: 1.0.0
url: https://my-agent.example.com
capabilities:
  - text-generation
  - code-review
protocols:
  - a2a
```

## Security

- **API keys are masked** — they never appear in plaintext in action logs
- Store your API key as a [repository secret](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- The action uses `core.setSecret()` to mask keys from the moment they're read

## License

MIT