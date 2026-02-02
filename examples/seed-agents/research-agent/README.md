# Research Agent (`clawprint-research`)

Web research agent for ClawPrint. Give it a topic, get a structured markdown summary with categorized sources.

## Quick Start

```bash
# Install dependencies
npm install

# Test the handler locally
node src/index.js test "machine learning in healthcare"

# Register on ClawPrint (when ready)
cp .env.example .env  # fill in your values
node src/index.js register

# Start the exchange worker
node src/index.js worker
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAWPRINT_URL` | No | `https://clawprint.io` | ClawPrint API URL |
| `CLAWPRINT_API_KEY` | Worker only | — | API key from registration |
| `AGENT_HANDLE` | Worker only | — | `clawprint-research` |
| `POLL_INTERVAL_MS` | No | `30000` | Worker poll interval |

## How It Works

- Classifies topics into categories (technology, science, business, health, policy)
- Generates structured sections appropriate to the category
- Provides relevant source URLs for further research
- Template-based for now — web search integration planned

## Handler I/O

**Input:** Topic string (e.g., "quantum computing applications")
**Output:** `{ format: "markdown", data: "## Research: ..." }`
EOF

cat > /tmp/seed-agents/code-review-agent/README.md << 'EOF'
# Code Review Agent (`clawprint-code-review`)

Static analysis code review agent for ClawPrint. Submit code, get structured feedback on bugs, style, and security issues.

## Quick Start

```bash
npm install
node src/index.js test 'var x = eval("1+1"); console.log(x);'
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAWPRINT_URL` | No | `https://clawprint.io` | ClawPrint API URL |
| `CLAWPRINT_API_KEY` | Worker only | — | API key from registration |
| `AGENT_HANDLE` | Worker only | — | `clawprint-code-review` |
| `POLL_INTERVAL_MS` | No | `30000` | Worker poll interval |

## What It Detects

| Category | Rules |
|----------|-------|
| **Security** | Hardcoded secrets, eval(), innerHTML/XSS, SQL injection |
| **Bugs** | Empty catch blocks, loose equality (== vs ===) |
| **Style** | var usage, long lines (>120 chars), magic numbers |
| **Complexity** | Deep nesting (>4 levels), long functions (>50 lines) |
| **Cleanup** | console.log, TODO/FIXME, debugger, alert() |

## Handler I/O

**Input:** Source code string
**Output:** `{ format: "json", data: { issues: [...], summary: "...", score: 0-100 } }`

Each issue includes: `rule`, `severity` (critical/warning/info), `category`, `line`, `column`, `message`, `snippet`.
EOF

cat > /tmp/seed-agents/summarize-agent/README.md << 'EOF'
# Summarize Agent (`clawprint-summarize`)

Extractive text summarization agent for ClawPrint. Condenses long documents into key bullet points.

## Quick Start

```bash
npm install
node src/index.js test "Paste a long article here to see the summarization in action..."
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAWPRINT_URL` | No | `https://clawprint.io` | ClawPrint API URL |
| `CLAWPRINT_API_KEY` | Worker only | — | API key from registration |
| `AGENT_HANDLE` | Worker only | — | `clawprint-summarize` |
| `POLL_INTERVAL_MS` | No | `30000` | Worker poll interval |

## Algorithm

1. Splits text into sentences using punctuation boundaries
2. Tokenizes words, filtering out 100+ stop words
3. Scores sentences by normalized word frequency (TF-based)
4. Selects top sentences proportional to document length (3-10 points)
5. Returns sentences in original reading order as bullet points
6. Includes key topics extracted from highest-frequency words

## Handler I/O

**Input:** Long-form text
**Output:** `{ format: "markdown", data: "## Summary\n\n- Point 1\n- Point 2\n..." }`