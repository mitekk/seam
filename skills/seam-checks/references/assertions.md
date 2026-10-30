# The assertions

Thirteen built in, plus whatever the repo invents. Each one says what it reads, what it needs from
`.seam/config.json`, and — the part that matters most — **what it deliberately does not reach**. A
reader who thinks a check reaches further will trust a green run further than they should.

Every assertion is a **local, offline, deterministic read**. None of them makes a network call,
none of them needs a database, and none of them reads the board. That is what makes a green run
mean the same thing on a plane as in CI.

| # | Assertion | Layers | Default |
|---|---|---|---|
| A1 | Every `*.md` path cited in backticks resolves | all | on |
| A2 | Every `§ Section` citation names a heading that exists | all | on (targeted form only) |
| A3 | The documented check list and CI's run steps name the same commands | 2 | **off** |
| A4 | Every `<identifier>.<field>` in prose resolves against the artifact | 2 | on iff an artifact is configured |
| A5 | Vocabulary blocks name exactly the members the artifact defines | 2 | off |
| A6 | Retired names never reappear | 2, 3 | off |
| A7 | A reversed decision is not prescribed again | 2, 3 | off |
| A8 | One issue, one owning plan | 5 | on iff a layer-5 doc exists |
| A9 | A stated count matches a computed one | 2, 5 | off |
| A10 | Every doc under `docs/` is in the table, with a layer | all | on |
| A11 | Config `load_bearing` matches the table's `Enforces` column | — | on |
| A12 | Append-only layers are byte-frozen on the default branch | 3, 4 | on iff layer 3 or 4 exists |
| A13 | ADRs carry a date and a status; PRD versions are indexed | 3, 4 | on iff layer 3 or 4 exists |

**Off is not passing.** An assertion that needs a repo-specific list is off until the list exists,
because an empty list that passes reads as evidence the thing is fine. Where an assertion is on
and *cannot make its comparison*, it **fails** and says so — see A3 and A12.

## A1 — a cited markdown path resolves

Reads: every `` `path.md` `` in backticks, in every doc. Resolves against the repo root, then
beside the citing file.

Needs: `assertions.A1.allow`, a list of `{path, reason}`. A reason is required: an entry means
"this file is absent on purpose and the sentence is about its absence".

Does not reach:

- **Any path that is not markdown.** Widening it to every backticked path turns every shell
  fragment and every column name into a claim about the filesystem. Campaign's equivalent is
  markdown-only too, and still needs an allow-list.
- **A glob.** `` `docs/adr/*.md` `` names a *form*, not a file, and is skipped. That is why the
  table's track rows and the PRD templates' forward references are written as globs.
- **A doc whose citations are intentions.** An implementation plan names the files it is about to
  create, so by construction every one of those paths is absent — measured at 23 on this repo's
  own plan. `intent_globs` exempts the **doc**, not each path, because neither existing mechanism
  fits: a baseline entry means "not yet" and these evaporate the moment the work lands, and an
  allow-list entry means "never". It defaults to `docs/superpowers/plans/*.md`, the one place this
  is true by construction, and it exempts nothing else.
- **A backticked label inside a markdown link.** In ``[`api.md`](.claude/rules/api.md)`` the link
  **target** is the claim and the label is how it reads, so the target is what gets resolved and
  the label is dropped. Measured on a repo nothing was tuned against: a README listing eight
  rules that way reported eight dangling citations, every one of them wrong, while all eight
  targets resolved. A link whose target is a markdown path **is** checked; one pointing anywhere
  else is the browser's problem.

## A2 — a `§` citation names a heading that exists

Reads: `` `x.md` § Name ``, and a following run of `§`s separated by nothing but a connector —
`` `docs/x.md` § A, § B and § C ``, which is how these are actually written. A heading is citable
by its full text, by each of its dash-separated clauses, and by any leading word-sequence of
those, so `§ Contact` names "Contact and identification" and `§ Geometry` names
"D-012 — Geometry and spacing".

Needs: nothing, unless you want the bare form (`assertions.A2.bare_sections: true`).

Does not reach:

- **A `§` whose subject is not a markdown file.** `` `some-skill` § The one gate `` cannot be
  resolved against anything in the tree. It is skipped, not reported. A check that reds on a
  citation it cannot evaluate is a check that gets switched off.
- **A bare `§` whose subject was named in an earlier sentence, unless you switch it on.** Past the
  adjacency-and-connector rule the binding lapses and the `§` would be read as naming a section of
  the file it is written in — which is a guess. **Measured on a 45-doc repo: 19 misses from the
  targeted form against 205 from the fallback**, nearly all of the latter a `§` whose real subject
  was a skill or another file. A baseline of 19 is a ratchet; 205 is a wall.
- **A document's title.** Only levels 2 to 6 are sections. Without that bound, `§ Checks` in a file
  called `# Checks` matched the title, whose body is the whole file — so a renamed section still
  compared something and passed.
- **A run whose first citation swallowed the prose after it.** The section name is captured up to
  the next sentence boundary, so in "`docs/checks.md` § Checks plus this file's § The harvester
  runtime" the first name eats "plus this file's " and the second `§` then looks adjacent to the
  first — so it is attributed to `docs/checks.md` rather than to the file "this file" means.
  **This one is a known miss, not a bound that holds.** Measured on a 45-doc repo: 19 targeted
  misses inside the scope that repo's own checker uses, and a handful of them this shape. The
  baseline is the mechanism — these go in on day one with a number on them, and a *new* one still
  reds. Bounding the capture tighter was tried and costs more than it buys: a heading's name has
  no reliable right edge in prose.

## A3 — the documented check list against CI

Reads: the ```bash blocks inside each configured doc section, reduced to **check tokens** — the
part of a command that says *which* check it is rather than how it was invoked, so
`psql -f scripts/check_schema.sql` and `psql -d "$URL" -f scripts/check_schema.sql` are the same
token. Against the `run:` payloads of each matching workflow, reduced the same way.

Needs: `doc_sections` (`[{file, section}]`), `workflow_glob`, and `local_only` / `ci_only` for the
commands that legitimately live on one side — each of those is a claim, so keep the lists short and
give each entry a reason in the doc.

**Both sides are section-scoped, and a configured section that is missing FAILS with exit 1,
saying the comparison was not made.** That is distinct from a missing check and is never a silent
skip: without the scoping, an illustrative fenced block in prose becomes a command CI is held to;
without the loud failure, a renamed heading takes half the list quietly out of scope.

Does not reach:

- **Whether a check is any good.** It compares two lists of names.
- **A quoted `#`.** Comments are stripped, because a path named in a trailing comment used to
  satisfy its own token and mask the removal of the command that actually invokes it. A `#` inside
  quotes stays content — `echo "closes #12" && pytest` kept only `echo "closes ` under a plain
  regex, and the check then reported pytest as documented-but-not-in-CI, which is a red naming a
  real check for a cause that is not real.
- **A quote opened in one line of a block scalar and closed in the next.** Quote state resets at
  each newline. Accepted knowingly: carrying it across newlines would let one apostrophe in a
  prose comment poison every line after it, and `ci.yml` files are full of prose comments.
- **A `uses:` step.** Setup is not a check.

## A4 — a `<identifier>.<field>` in prose resolves

Reads: `` `word.word` `` in every doc, against the artifact. `sql` parses `create table`; `ts`
parses a union or enum.

Needs: `artifacts` (`[{path, parser}]`) and, optionally, `not_references` — whole dotted names
that are a convention rather than a reference, like a job kind `resolve.name` or a Python module
`signals.SITEMAP_PATTERNS`.

**`not_fields` has a built-in default and the config adds to it**: file extensions and hostname
endings, so `jobs.py`, `docs/x.md` and `apiaries.org` are read as a path or a host rather than as
a column. An empty default was not a sensible one — on a 45-doc repo it produced eleven findings,
every one of them an extension or a TLD. Adding one exemption of your own cannot lose the
defaults, because the config's list is unioned with them.

The default is **deliberately narrow**: it holds only endings that cannot plausibly be a column or
a union member. `html`, `json`, `log`, `env`, `css`, `txt`, `csv`, `xml`, `svg`, `pdf`, `app`,
`dev` and `io` were all in an earlier version of it and are all plausible field names — a repo
documenting `pages.html` would have had A4 stay green forever through a rename, with no way to
re-enable it. For the repo whose column really is called `html`, **`not_fields_override` replaces
the list outright**.

Does not reach: anything the parser does not parse. **Start with SQL `create table` and TypeScript
unions; everything else is off by default**, because a parser that half-reads an artifact produces
findings nobody can act on.

A note on `not_references`: exempt the **whole** dotted name, not its right-hand side. Suppressing
a bare `snapshot` would also excuse a future `harvests.snapshot`, which is exactly the drift the
assertion exists for.

## A5 — a vocabulary block matches the artifact

Reads: the fenced block inside a configured section, as a set of words, against an enum or union
the artifact defines. Both directions: a member the doc lists and the artifact does not define, and
one the artifact defines and the doc does not list.

Needs: `vocabularies` (`[{file, section, enum}]`).

Does not reach: the *meaning* of a member. It compares two sets of names.

## A6 — a retired name never reappears

Reads: each retired name as a word-boundary search across every doc, with `~~struck~~` spans
blanked first.

Needs: `retired` (`[{name, became, reason}]`). All three fields: the message names what the thing
became, which is the only way the finding is actionable.

Does not reach: a name retired in the code but not listed here. This is a deny list, not an
inference.

## A7 — a reversed decision is not prescribed again

Reads: each configured pattern across every doc, with struck spans blanked.

Needs: `reversed` (`[{pattern, reason, adr}]`).

**Write the pattern to match the prescription, not the discussion.** A doc may *mention* a reversed
decision — a revision note has to be able to say what was reversed — so match the imperative form
(`**Use a queue library**`) rather than the bare name. This assertion works at all only because
layer 3 is dated and never edited: if a record could be rewritten, "what was reversed" would have
no record to point at.

## A8 — one issue, one owning plan

Reads: the `§ The issues` table of each file matching the plan glob, taking `#N` from the **issue
column only** — a dependency named in another column is not a claim of ownership.

Needs: `plan_glob`.

Does not reach: **whether the issue is still open.** That needs a network call, and every
assertion here is offline. A plan claiming a closed issue is a procedural matter, not a
mechanical one.

## A9 — a stated count matches a computed one

Reads: each configured pattern's capture — a numeral or a spelled-out number up to twelve — against
the number of files a glob matches.

Needs: `count_sites` (`[{pattern, count_of, file?}]`). Off by default: a generic "stated number"
detector reports every number in the repo.

Does not reach: a count of anything that is not files matching a glob. Numerals are accepted
alongside words, because "all 3 sibling plans" is the same defect as "all three" and skipping it
silently is worse than not looking — a check that passes on the wrong shape of a sentence it claims
to check reads as evidence the sentence is right.

## A10 — every doc is in the table, with a layer

Reads: every markdown file under `docs/`, against the table's rows. A row's Doc cell may be a
concrete path or a glob, which is how the ADR and PRD tracks cover the several files each writes.

Needs: `table.file`. The table is read from inside its markers when they are present, so a table
elsewhere in that file is not mistaken for this one.

Does not reach:

- **The table's own host file**, which is normally not under `docs/`. Campaign's `CLAUDE.md` is not
  a row in its own table; seam's `docs/contributing.md` is, because it lives under `docs/`. Both
  are fine.
- **Markdown outside `docs/`.** A `README.md` beside some code is that code's business.

There is no third state. A doc is in the table with a layer, or it is drift.

## A11 — the two copies of what carries weight agree

Reads two things, because the human copy and the machine projection can disagree in two ways:

1. **Every path-shaped `Enforces` cell is on `load_bearing`.** A value containing a space, or one
   with no `/` and no `.`, is a **command** — "a constraint, an index, a CI assertion" is what an
   Enforces cell may name, and a CI assertion is a command. Those are left alone, because
   `load_bearing` must hold paths only: the review policy's first row and the follow-up
   qualifier's second clause both read that list as path globs, so a command on it would be a row
   that covers no diff.
2. **Every `docs[]` entry's layer matches the table's.** The layer lives in both, and nothing read
   the config's copy until this half existed — so a doc could be layer 2 in one place and layer 5
   in the other, which is two edit rules for one file. It also reports a config row the table has
   no row for.

Needs: nothing beyond the two it compares. This is the assertion that keeps the human copy and the
machine projection from drifting apart, which is the whole reason there are exactly two artifacts
per repo and not three.

## A12 — the append-only layers are byte-frozen

Reads: `git show <branch>:<path>` for every layer-3 and layer-4 file, against the bytes on disk.

Needs: `default_branch`.

**Layers 3 and 4 only**, and only because their edit rule says a file already on the branch is
final: a record is never wrong, and an intent version is superseded rather than corrected. A
layer-2 doc is byte-frozen by nothing, which is correct — wrong there is a bug, and a bug gets
fixed in place.

- A file **not yet on the branch** is skipped. That is a new record, which is the point.
- **No such branch fails**, saying the comparison was not made. Off is distinct from passing.
- **An index is not a record.** `README.md`, `index.md`, `template.md` and `PRD-current.md` inside
  a frozen track are exempt: an index grows by design — adding a version means appending a row —
  and a "current" file is replaced wholesale when a new version lands. Freezing either makes the
  layer unusable, which is the opposite of enforcing its edit rule.

This is a migration freeze generalised: the thing that stops a migration already applied from being
edited is exactly what layers 3 and 4 need, and it is what turns "never overwrite a PRD version"
from a rule nobody can enforce into one CI catches.

## A13 — the append-only layers keep their shape

Reads, for **MADR**: every record in the ADR directory except `README.md` and `template.md` — a
`**Date:**`, a `**Status:**`, and for a superseded one a successor number that exists. For a
**single dated file**: a date within 400 characters of each `##` entry. For **PRD**: every
`PRD-vN.md` is named in the index, **either by filename or by its version label** — an index row
reading `| v0 | 2026-03-10 | … |` makes the version perfectly findable, and this assertion exists
so an unindexed version cannot hide, not so that the index has to spell a filename. Measured on an
unseen repo whose index is written exactly that way.

Needs: `adr.format` and `adr.dir` or `adr.file`; `prd.dir`.

Does not reach: whether the record is *true*, or whether the decision was a good one. It checks the
shape the layer promises.

## Two refusals before anything is checked

Both are exit 2, and both exist because the alternative is a check that looks like a pass:

- **No assertion enabled.** A config with no `assertions` block, or one with every switch off,
  would emit a checker that measures nothing and exits 0. That cannot be told apart from passing,
  which is the thing this whole layer exists to prevent. A repo that genuinely wants none should
  not have a checker.
- **An allow-list entry with no reason.** An entry means "this will never be fixed", and the
  method says it requires a written reason. Nothing read the field until this refusal existed,
  which made the requirement a sentence.

## Repo-invented assertions

`.seam/assertions/*.py` or `*.mjs`, discovered by the emitted checker and **never overwritten by a
regeneration**. Each exposes one function:

```python
def run(ctx):                      # Python
    return [{"id": "X1", "file": "docs/x.md", "line": 12, "text": "...",
             "message": "what is wrong, and what to do about it"}]
```

```javascript
export function run(ctx) { /* the same shape */ }                    // Node
```

`ctx` carries `root`, `config`, `docs` (the paths), `text_of` (path → contents), `table` (the
parsed rows) and `host`. Give each one an id outside the `A<n>` range so a finding's origin is
obvious, and keep them local, offline and deterministic like the rest.

This extension point exists because a repo always has an assertion nobody else needs. Campaign
runs twelve checks and two of them are its own; the alternative — editing them into the emitted
script — is a change the next regeneration silently drops.

## The baseline, and why it is not the allow-list

The first run with `--write-baseline` records every current violation as `{id, file, line, text}`
and the checker then fails only on violations outside it.

Matching is **exact on all four fields**, so a violation whose line no longer matches drops out of
the baseline rather than being carried forever. That is deliberate and it has a cost: inserting a
line near the top of a doc un-baselines that doc's entries, and they come back as findings. Fix
them or re-run `--write-baseline`; the point is that the number is visible and moves.

**A baseline entry is a debt with a number on it. An allow-list entry is a decision.** The
allow-list needs a written reason and means "this will never be fixed"; the baseline means "not
yet". They are separate files so that the difference cannot be blurred, and `/seam:audit` prints
the baseline count on every run so it stays in view.
