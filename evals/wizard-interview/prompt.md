---
name: wizard-interview
runs: 1
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [wizard, interview]
---

Set up a documentation layer for my repo.

It is a small Node CLI. `package.json` has a `test` script (`node --test`) and a `lint` script
(`eslint .`); there is one source file, `src/index.mjs`, exporting a `total` function; and
`.github/workflows/ci.yml` runs `npm test` and `npm run lint` on push. There are no docs at all.

Ask me whatever you need to know before writing anything.
