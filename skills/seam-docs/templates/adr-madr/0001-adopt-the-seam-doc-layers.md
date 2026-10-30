# 0001. Adopt the seam doc layers

**Date:** {{date}}
**Status:** accepted
**Deciders:** {{repo.name}} maintainers

## Context

Documentation in this repo had no rule for what happens when a file turns out to be wrong, so
every file was edited the same way: in place, whenever someone noticed. That makes a rationale
indistinguishable from a current fact, and it makes drift between prose and code invisible until
somebody is bitten by it.

## Decision Drivers

- A file's **edit rule** has to be derivable from what the file is for, not remembered.
- Drift between prose and code should fail a build, not wait for a reader to notice.
- No decision should exist in two places, because two copies disagree.

## Considered Options

| Option | Verdict |
|---|---|
| Six layers keyed on *what happens when the document is wrong* | **chosen** — one property fixes the edit rule, the authority rank, and which assertions can run |
| Group docs by topic | rejected — says nothing about how to edit one, so every file drifts the same way |
| Group docs by tense (current/future) | rejected — puts a rationale and a current fact in the same bucket, which is the confusion being removed |
| No layering, one `README.md` | rejected — nothing to assert against, and ownership of a question becomes a matter of opinion |

## Outcome

Docs are layered 1–6: Artifact, Current, Decisions, Intent, Seam, Ledger. Each layer has one
edit rule. Authority is by question asked rather than one chain — Artifact beats Current on what
is true now, Decisions beat Current on why, Intent beats Seam on what we intend, and Seam and
Ledger own nothing. **A lower layer cites a higher one and never restates it.**

Every doc under `docs/` is listed in `{{table.file}}` § Sources of truth with its layer, or it is
drift.

## Consequences

- **Good:** the edit rule for any file is a lookup, and the layering is what makes the drift
  checker's assertions possible at all.
- **Bad:** a new doc is not free — it needs a row in the table and a layer, and work that would
  have gone into an untracked note now goes into the right layer or into the ledger.
- **Enforced by:** `{{checker.path}}`, assertion A10 (every doc in the table, with a layer).

## Links

- `{{table.file}}` § Sources of truth — the table this record licenses
- `{{checker.path}}` — the assertions the layering makes possible
