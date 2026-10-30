#!/usr/bin/env bash
# Scaffold: a greenfield repo and NO answers file, so the wizard has to interview.
set -euo pipefail
git init -b main -q .
git config user.email "eval@example.com"
git config user.name "Eval"
mkdir -p src
cat > package.json <<'JSON'
{ "name": "ledger-cli", "version": "0.1.0", "scripts": { "test": "node --test", "lint": "eslint ." } }
JSON
cat > src/index.mjs <<'JS'
export const total = (rows) => rows.reduce((a, r) => a + r.amount, 0);
JS
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'YML'
name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
      - run: npm run lint
YML
