---
name: wizard-adopt
runs: 1
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [wizard, adopt]
---

Create this repo as a git repo with the files below, exactly as given, and commit them. Then work
out which seam layer each existing document belongs to and what each one owns, and show me your
proposal. **Do not write any documentation files, and do not change any of the files below.**

`docs/engineering.md`:

```markdown
# Engineering

## Stack

Node, and `node --test`.

## Queue

We chose a plain table over a queue library because a library would have to be configured.
```

`docs/architecture.md`:

```markdown
# Architecture

## Stack

Node, with one service.
```

`docs/adr/0001-pick-postgres.md`:

```markdown
# 0001. Pick Postgres

**Date:** 2026-01-01
**Status:** accepted

## Context

Relational data, so Postgres over a document store.
```

`docs/plans/first.md`:

```markdown
# First

## The issues

| # | Issue |
|---|---|
| 1 | #4 seed the database |
```

`docs/findings-ledger.md`:

```markdown
# Findings ledger

| Date | Observation |
|---|---|
```

`CLAUDE.md`:

```markdown
# Repo

## Sources of truth

| Doc | Owns |
|---|---|
| `docs/engineering.md` | Stack and the queue |
| `docs/gone.md` | A doc that left the repo |
```
