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

**Settled:** the disposition is decided by **two questions, neither of them the size**. Does a
unit of planned work — or a document that owns the change — cover the item? If nothing does, is it
worth doing at all, and if it is, is the work bigger than a unit you could write and finish in the
branch in flight? A unit covers it → do it now; nothing covers it and it is not worth doing → one
ledger row; worth doing and bigger than a unit you could finish here → file an issue, if it passes
the qualifier; worth doing and not bigger than that → **write the unit, then do it**. The four are
mutually exclusive, so no precedence between them has to be remembered, and "worth doing" is asked
once.

That last disposition is new, and the old rule had no route for it: an item that fitted it became
an issue instead. In the owner's words: *"I'd rather it planned and implemented instead directly
go with new issue just because we need to cover some corners."* Filing is for genuine complexity;
covering corners is part of the work, and an issue filed to cover one inflates the board.
**Complexity is reach, not size** — whether the work is bigger than a unit you could write and
finish — because a size test in that slot would be the rule this entry reverses wearing a
different name.

A change no unit owns may name the **document** that owns it instead, which takes the first
disposition with the document standing in for the unit. Without it the ordering rule would route
work that has no test to write to an issue, which is the move this entry reverses.

**Rejected:** keeping size in the deciding position, which is what put the corners on the board;
a fourth qualifier clause for "no unit owns it", which would have kept them there under another
name; and an earlier four-row phrasing of this same order that asked "worth the time" in one row
and "not worth the time" in another — read with one meaning for the phrase it left the issue row
reachable only for work not worth doing, so the two questions above replace it.

**Enforced by:** nothing mechanical. No assertion reads a PR body, and which disposition an item
takes is a judgement made in flight; `skills/seam-github/SKILL.md` § Follow-ups is the procedural
owner, and `evals/github-pr-shape` is the only measurement.

## R-001 — rulings taken while building the plan-first layer

*2026-11-01 · in flight*

### Ruling — a MADR repo writes one record per ruling, not one per batch

Settled with a fixture, because `tests/prescribed.test.mjs` is where both ADR formats are built
and the question could be measured rather than argued.

**Settled:** in a repo whose `adr.format` is `madr`, a ruling taken in flight is **its own
numbered record**, named `NNNN-ruling-<slug>.md`. A plan's worth of rulings is a plan's worth of
records.

**Why, measured:** a batch record — one record collecting a branch's rulings — is appendable only
while the branch is in flight. The moment it is on the default branch A12 freezes its bytes, with
only the `**Status:**` line exempt, so the next ruling cannot go in it. A prescription to batch is
therefore one that works until the first merge and then fails, and the failure arrives as a byte
violation on a file somebody is in the middle of appending to.
`tests/prescribed.test.mjs` pins all three states: the batch record appended to before it lands
passes, the landed record untouched passes, and the append after landing is an A12 finding.

A record per ruling cannot be reopened by construction, and it gives each ruling a **number** —
which `superseded by NNNN`, and every citation of one ruling by another, need.

**Costs if wrong:** directory volume. `docs/adr/` reads as mostly rulings rather than decisions,
and a reader looking for why something is the way it is scrolls past them. The `ruling-` filename
prefix is the whole mitigation: the listing is chronological, as an append-only dated track is,
and the kind is visible without opening the file. The alternative trades that volume for a record
that can be reopened by mistake, and the mistake is silent until a merge.

**The single-file format has no such constraint**, and that asymmetry is the reason this ruling is
needed at all: `docs/decisions.md` is held to a *prefix* check rather than byte-equality, so a
dated section that is still the last thing in the file stays open and a branch's rulings batch
into it naturally — which is what this very section does.

**Enforced by:** `scripts/check_docs.mjs`, assertion A12, and `tests/prescribed.test.mjs`, which
performs every prescribed action in both formats and fails if one of them reds the checker.
