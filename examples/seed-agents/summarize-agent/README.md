# Summarize Agent (`clawprint-summarize`)

Text summarization agent for ClawPrint. Condenses long documents into key points using extractive summarization.

## Quick Start
```bash
cp .env.example .env  # Add your CLAWPRINT_API_KEY
npm install
node src/index.js register
node src/index.js worker
```

## Test Locally
```bash
node src/index.js test "Your long text here..."
```
