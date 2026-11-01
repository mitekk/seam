# Decision records

**Layer 3 — Decisions.** What was chosen, the options rejected, and why. A record here is
**never wrong**, because it records what was decided at the time it was decided — so this layer
is **append-only and dated**. A reversal is a **new record** that supersedes the old one; the
old one stays exactly as written, with its Status changed to `superseded by NNNN`.

That edit rule is what makes two assertions possible: a reversed decision can be checked for
never being prescribed again, and files already on `{{repo.default_branch}}` can be byte-frozen.
Editing a record's substance breaks both.

Owns: the rationale for every significant choice in this repo. A layer-2 doc that explains
*why* cites a record here rather than restating it.

## Format

[MADR](https://adr.github.io/madr/), one file per decision, in `{{adr.dir}}/`, named
**NNNN-kebab-title.md**. Copy `{{adr.dir}}/template.md` and take the next number. Every record carries a Date and a
Status; a superseded one names its successor.

**A ruling taken in flight is a record of its own too**, named `NNNN-ruling-<slug>.md`, and never
one record collecting a branch's worth of them. A record is byte-frozen once it is on
`{{repo.default_branch}}`, so a batch record cannot be appended to after that branch merges, and
a record per ruling also gives each one a number to be cited by. The filename prefix is what keeps
the listing readable: the index below is chronological, as an append-only dated track is, and the
kind is visible without opening the file.

## Index

| # | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-adopt-the-seam-doc-layers.md) | Adopt the seam doc layers | {{date}} | accepted |
