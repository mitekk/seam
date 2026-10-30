---
name: github-issue-shape
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [github, issues]
---

I want to file an issue on `mitekk/apiary`: the queenless list renders every hive in the apiary
rather than only the queenless ones, so the one page the beekeeper opens is useless.

This repo's `docs/taxonomy.md` says the domains are `hives`, `web` and `infra`; the priorities are
`p0`, `p1` and `p2`; and the active milestone is `1 · Queenless list`. `docs/plans/inspections.md`
§ The issues is where the inspection work is sequenced, and `db/schema.sql` is the only
load-bearing path.

Draft the issue and show me the exact `gh` command you would run. Do not run anything.
