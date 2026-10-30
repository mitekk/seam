# Adopting a repo that already has docs

The riskiest path, because the repo already has an answer to most of the interview's questions
and it is written down somewhere — usually in two places that disagree.

**The governing rule: never rewrite an existing doc's body.** Not a tidy-up, not a reformat, not
"while I was in there". What this path writes is the table, `.seam/config.json`, the baseline, and
any file the user adds. Reshaping an existing file is a separate, per-file step the user asks for
by name.

## The four steps

1. **Inventory.** `docs/`, `README.md`, the file named by `table.file` (usually `CLAUDE.md`),
   `.claude/`, and any `rules/`-style directory. List every candidate with its size and its
   headings.
2. **Propose, per file, what it currently owns and which layer it is** — derived from its
   headings and its edit history, and shown as a **proposal**, not asserted. `git log --follow`
   on a file is the strongest signal available for the layer: a file amended in place for two
   years is layer 2; one only ever appended to is layer 3 or 6.
3. **Flag overlaps and layer violations.**
   - *Overlap*: two files claiming one seam. That is what the table exists to resolve, so it is
     a question for the user, not something to resolve quietly.
   - *Layer violation*: a file that restates something a higher layer owns — most often a layer-2
     doc carrying a rationale that belongs in layer 3, or a plan that settles a decision.
4. **Write only** the sources-of-truth table (marker-scoped), `.seam/config.json`, the baseline,
   and files the user adds.

## `table.file` is marker-scoped

The table goes between

```
<!-- seam:sources-of-truth start -->
<!-- seam:sources-of-truth end -->
```

and is **appended** if the markers are absent. Nothing outside them is touched — which is what
makes it safe to run against a `CLAUDE.md` somebody has been maintaining by hand.

## CI is generated only when absent

- **No workflow** → offer to write one.
- **A workflow exists** → print the job to add and change nothing.

Assertion **A3 stays off** until a workflow exists *and* the user confirms it is wired, because
A3 compares two sides and a missing side makes the comparison vacuous. Off is distinct from
passing.

## The baseline

A repo that has had docs for a while has day-one drift, and it is not hypothetical: a `CLAUDE.md`
citing six paths that no longer exist will fail A1 on the first run, on the very file the wizard
just wrote the table into.

So the first checker run writes every current violation to `.seam/baseline.json` — assertion id,
file, line, and the matched text — and the checker then **fails only on violations not in the
baseline**. `/seam:audit` prints the count on every run, so it stays visible and is expected to
shrink. A violation whose line no longer matches drops out of the baseline automatically rather
than being carried forever.

**A baseline entry is a debt with a number on it, not an approval.** That is the distinction the
allow-list keeps: an allow-list entry requires a written reason and means "this will never be
fixed". They are separate files for exactly that reason.
