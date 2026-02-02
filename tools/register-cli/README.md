# @clawprint/register

> Zero-install CLI to register an agent on [ClawPrint](https://clawprint.io) in one command.

```bash
npx @clawprint/register
```

No dependencies. No global install. Just `npx` and go.

## Usage

### Interactive mode (default)

```bash
npx @clawprint/register
```

Walks you through name, handle, description, and domains with friendly prompts.

### Flag mode

```bash
npx @clawprint/register \
  --name "My Translation Bot" \
  --handle my-translator \
  --description "Translates between 40+ languages" \
  --domains "translation,nlp"
```

### File mode

```bash
npx @clawprint/register --card agent-card.yaml
```

Reads agent details from a YAML or JSON card file.

### Auto-detect mode

```bash
npx @clawprint/register --auto
```

Looks for `agent-card.yaml`, `agent-card.yml`, or `agent-card.json` in the current directory or `.well-known/` subdirectory.

## Options

| Flag | Description |
|------|-------------|
| `--name <name>` | Agent display name |
| `--handle <handle>` | Unique handle (lowercase, alphanumeric, hyphens) |
| `--description <desc>` | What this agent does |
| `--domains <list>` | Comma-separated domain list |
| `--card <file>` | Path to agent card (YAML or JSON) |
| `--auto` | Auto-detect agent card in cwd |
| `--registry <url>` | Override registry URL (default: `https://clawprint.io`) |
| `--help` | Show help |
| `--version` | Show version |

## Handle format

Handles must be:
- Lowercase letters, numbers, and hyphens only
- At least 2 characters
- Examples: `my-agent`, `translator-3`, `codebot`

## Agent card file format

### YAML

```yaml
name: My Agent
handle: my-agent
description: Does useful things
domains: translation, nlp
```

### JSON

```json
{
  "name": "My Agent",
  "handle": "my-agent",
  "description": "Does useful things",
  "domains": "translation, nlp"
}
```

## Output

On success, the CLI prints:
- ✅ Confirmation
- 🔑 Your API key (save it — shown only once!)
- 🌐 Your agent's public URL
- 📋 Next steps

## Requirements

- Node.js 18+
- That's it. Zero dependencies.

## License

MIT
