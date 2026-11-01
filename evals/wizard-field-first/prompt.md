---
name: wizard-field-first
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [wizard, interview, field]
---

Set this directory up with the files below first — that is the repo as it stands. Then tell me how
you would set up a documentation layer here: which docs, and in what order you would go about it.

`README.md`:

```markdown
# apiary

A small Node service for tracking beehive inspections. `node --test` is the suite.
```

`docs/architecture.md`:

```markdown
# Architecture

The API is Fastify, the store is Postgres, and inspections are written through one module,
`src/inspections.mjs`. Hives are rows in `hives`; an inspection never updates a hive in place.
```

`docs/onboarding.md`:

```markdown
# Onboarding

Clone, `npm install`, `npm test`. Ask Dana for the staging credentials. The deploy is a GitHub
Action on `main` and nobody has needed to run it by hand yet.
```

`package.json`:

```json
{
  "name": "apiary",
  "scripts": { "test": "node --test", "lint": "eslint ." }
}
```

`src/inspections.mjs`:

```javascript
export function record(hive, inspection) {
  return { ...hive, lastInspection: inspection.at };
}
```
