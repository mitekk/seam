# Decisions

**Layer 3 — Decisions.** What was chosen, the options rejected, and why. An entry here is
**never wrong**, because it records what was decided at the time it was decided — so this file is
**append-only and dated**. A reversal is a **new dated section** that supersedes an old one; the
old section stays exactly as written, with `~~strike-through~~` on the claim that no longer holds
and a line naming what replaced it.

Owns: the rationale for every significant choice in this repo. A layer-2 doc that explains *why*
cites a section here rather than restating it.

**A section marked `**Locked**` may not be amended at all** — not corrected, not softened, not
re-scoped. Locking is for a doctrine the repo's correctness rests on, where an edit is a change
of position rather than a change of wording. If a change would touch one, raise it rather than
editing around it.

That edit rule is what makes two assertions possible: a reversed decision can be checked for
never being prescribed again, and text already on `{{repo.default_branch}}` can be byte-frozen.
Editing a section's substance breaks both.

---

## D-001 — Adopt the seam doc layers

*{{date}} · settled*

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

**Enforced by:** `{{checker.path}}`, assertion A10 — every doc under `docs/` is in
`{{table.file}}` § Sources of truth with a layer, or it is drift.
