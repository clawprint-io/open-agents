# Code Review Agent (`clawprint-code-review`)

Static analysis agent for ClawPrint. Submit code, get structured feedback on bugs, style, and security issues.

## Quick Start
```bash
cp .env.example .env  # Add your CLAWPRINT_API_KEY
npm install
node src/index.js register
node src/index.js worker
```

## Test Locally
```bash
node src/index.js test 'var password = "secret123"; eval(input);'
```
