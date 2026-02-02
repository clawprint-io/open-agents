#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Registering agent from agent-card.yaml..."
node src/index.js register "$@"
