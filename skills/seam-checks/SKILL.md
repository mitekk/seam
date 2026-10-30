---
name: seam-checks
description: >
  Generates and maintains a repo's drift checker — the script that fails the build when prose
  and code disagree. Use this when someone wants docs enforced rather than merely written,
  when a check went red and the question is whether the doc or the code is wrong, when a
  check needs adding, switching off or scoping, when the checker is stale after a plugin
  upgrade, or when `/seam:audit` reports a baseline. Also use it when a repo needs an
  assertion seam does not have. Does NOT decide which doc owns what or write the docs
  themselves (that is seam-docs), and does not own the review or the commit gate
  (seam-review, seam-github).
---

# The drift checker

A doc nothing checks is a doc that drifts. This skill generates the checker into the repo, in the
repo's own language, and keeps it current.

**The assertions are `references/assertions.md`.** Read it before switching one on, scoping one, or
explaining a finding — it says what each one reads and, more usefully, what each one deliberately
does not reach.

## Generating it

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/generate-checker.mjs" --repo .
```

It reads `.seam/config.json` and writes the checker at `checker.path` in `checker.language` —
**Python 3 (stdlib only)** or **Node `.mjs`**, both implementing the same assertions with the same
output format. A repo can switch languages without changing what is enforced, and the test suite
compares the two on every fixture so that stays true.

Then record the baseline, and read what it says:

```bash
<the checker> --write-baseline
```

## Three rules about the emitted script

1. **Never edit it.** Every repo-specific knob lives in `.seam/config.json` and is read at run
   time, so regenerating is always safe — and a knob edited into the script is a knob the next
   regeneration silently drops.
2. **Regenerate rather than patch.** The script carries a version stamp; `/seam:audit` notices a
   stale one. Upgrading the plugin and regenerating is the whole upgrade path.
3. **A repo's own assertions go in `.seam/assertions/*`** — `*.py` or `*.mjs`, one `run(ctx)`
   each. Discovered by the emitted checker and never overwritten. That extension point exists
   because a repo always has an assertion nobody else needs; `references/assertions.md`
   § Repo-invented assertions has the contract.

## When a check goes red

The order matters, because getting it wrong is how enforcement gets switched off:

1. **Read the finding.** It names the file, the line, and what it expected.
2. **Decide which side is wrong.** The artifact is authoritative: where a doc and the code
   disagree, the code wins and the doc is the drift. Where two docs disagree, the higher layer
   wins — `seam-docs/references/layers.md` § Authority.
3. **Fix the doc, in the same change** that caused the drift. A doc your change makes wrong is
   part of your change.
4. **If the check is wrong**, scope it in the config — a `not_fields` entry, an allow-list entry
   with a reason, a narrower pattern. Never by editing the script, and never by switching the
   whole assertion off to clear one finding.

**Switching an assertion off is a decision, not a fix**, and it belongs in a decision record. Off
is distinct from passing, which is why an assertion that is on but *cannot make its comparison*
fails loudly instead.

## Adding an assertion

1. Check `references/assertions.md` first: thirteen exist, and the one wanted is often an existing
   one that needs scoping rather than a new one.
2. If it is genuinely new and genuinely this repo's, write it to `.seam/assertions/`. Keep it
   local, offline and deterministic like the rest — a check that needs the network cannot run on a
   plane and can fail because a service is down, which changes what a green run means.
3. If it is new and *general*, it belongs in the plugin, with a planted-drift fixture written
   first. That is a change to seam, not to the repo.

## Wiring it into CI

**Only when no workflow exists.** If one does, print the job to add and change nothing — editing
somebody's CI config is not this skill's business.

```yaml
- run: python3 scripts/check_docs.py      # or: node scripts/check_docs.mjs
```

Assertion **A3 stays off until a workflow exists and the user confirms it is wired**, because A3
compares the documented check list against CI's steps and a missing side makes the comparison
vacuous.

## The baseline

The first run records today's violations so the checker fails only on what is new. **A baseline
entry is a debt with a number on it, not an approval** — that is what keeps it separate from the
allow-list, whose entries carry a written reason and mean "this will never be fixed".

Report the count whenever you touch the checker, and report it as a direction: a baseline that is
not shrinking is a baseline nobody is using.
