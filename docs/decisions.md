# Decisions

**Layer 3 — Decisions.** What was chosen, the options rejected, and why. An entry here is
**never wrong**, because it records what was decided at the time it was decided — so this file is
**append-only and dated**. A reversal is a **new dated section** that supersedes an old one and
names it; the old section stays exactly as written.

Three kinds of entry live here, each in a `## ` section whose first line is its date:

- **Decision** — the section itself: what was chosen, the options rejected, and why.
- **Ruling** — a `### Ruling — <what>` taken in flight: what was decided, why, and what it costs
  if wrong.
- **Direction correction** — a `### Direction correction — <what>`: what was being built, what was
  asked for instead, and the date it was said. It is the record of a live "not that way", which
  otherwise lives only in a session transcript.

Rulings and corrections are append-only like everything else in the file.

Owns: the rationale for every significant choice in this repo. A layer-2 doc that explains *why*
cites a section here rather than restating it.

**A section marked `**Locked**` may not be amended at all** — not corrected, not softened, not
re-scoped. Locking is for a doctrine the repo's correctness rests on, where an edit is a change
of position rather than a change of wording. If a change would touch one, raise it rather than
editing around it.

That edit rule is what makes two assertions possible: a reversed decision can be checked for
never being prescribed again, and text already on `master` can be held in place —
an append passes, an edit to anything already there does not. Editing a section's substance
breaks both.

---

## D-001 — Adopt the seam doc layers

*2026-10-31 · settled*

Documentation here had no rule for what happens when a file turns out to be wrong, so every file
was edited the same way: in place, whenever someone noticed. That makes a rationale
indistinguishable from a current fact, and it makes drift between prose and code invisible until
somebody is bitten by it.

**Settled:** docs are layered 1–6 — Artifact, Current, Decisions, Intent, Seam, Ledger — keyed on
*what happens when the document turns out to be wrong*, because that one property fixes the edit
rule, the authority rank, and which assertions can run against the file. **A lower layer cites a
higher one and never restates it.**

**Rejected:** grouping by topic, which says nothing about how to edit a file; grouping by tense,
which puts a rationale and a current fact in the same bucket; and no layering at all, which
leaves nothing to assert against.

**Enforced by:** `scripts/check_docs.mjs`, assertion A10 — every doc under `docs/` is in
`docs/contributing.md` § Sources of truth with a layer, or it is drift.

## D-002 — Follow-up dispositions order by ownership, not by size

*2026-10-31 · settled*

`skills/seam-github/SKILL.md` § Follow-ups shipped with size in the deciding position: **Small or
Medium → fold it into the branch in flight**, and anything else to the qualifier, which decides an
issue or a ledger row. Size is the wrong question to ask first. A Small change that no unit of
planned work owns is still implementation that got ahead of the plan, and the only route the rule
left for it was an issue — so corners of work already in front of someone went onto the board
instead of into the branch.

**Settled:** the dispositions are ordered by **whether a unit of planned work owns the item**, and
size decides only how much ceremony the disposition carries. A unit already covers it → do it now;
no unit covers it and it is worth the time → **write the unit, then do it**; no unit covers it and
it is genuinely complex → file an issue, if it passes the qualifier; true and not worth the
time → one ledger row. The second row is new and it **outranks filing**, in the owner's words:
*"I'd rather it planned and implemented instead directly go with new issue just because we need to
cover some corners."* Filing is for genuine complexity; covering corners is part of the work, and an
issue filed to cover one inflates the board.

A change no unit owns may name the **document** that owns it instead — an ops change, a decision,
a doc fix — which is the first disposition with the document standing in for the unit. Without it,
the ordering rule would route work that has no test to write to an issue, which is the move this
entry reverses.

**Rejected:** keeping size in the deciding position, which is what put the corners on the board;
and a fourth qualifier clause for "no unit owns it", which would have kept them there under
another name.

**Reverses:** the rule quoted in the first paragraph, in `skills/seam-github/SKILL.md`, and not a
section of this file — this track begins at D-001, so the reversed rule was never recorded here
and there is no section to supersede.

**Enforced by:** nothing mechanical. No assertion reads a PR body, and which disposition an item
takes is a judgement made in flight; `skills/seam-github/SKILL.md` § Follow-ups is the procedural
owner, and `evals/github-pr-shape` is the only measurement.
