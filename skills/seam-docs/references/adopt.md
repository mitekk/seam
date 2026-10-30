# Adopting a repo that already has docs

The riskiest path, because the repo already has an answer to most of the interview and it is
written down somewhere — usually in two places that disagree.

**The governing rule: never rewrite an existing doc's body.** Not a tidy-up, not a reformat, not
"while I was in there". What this path writes is the table, `.seam/config.json`, the baseline, and
any file the user adds. Reshaping an existing file is a separate, per-file step the user asks for
by name.

## The four steps

### 1. Inventory — a program, not a read-through

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/seam-inventory.mjs" --repo . > /tmp/seam-inventory.json
```

It is read-only and has no dependencies. It prints JSON: every markdown file under `docs/` and at
the repo root, with its size, headings, edit history, citations, dangling citations, and a
**`layer_guess` carrying the evidence for it**. Plus the artifacts, the existing table's rows, the
overlaps, the layer violations, the CI workflows, any `rules/`-style directory, and the agents.

Use it rather than reading forty files. Reading the files is how a proposal acquires invented
confidence; the inventory's claims are all traceable to the tree.

Pass `--table <file>` when the sources-of-truth table lives somewhere other than `CLAUDE.md`.

### 2. Propose what each file owns and which layer it is

A **proposal**, not an assertion. For each file, show: the path, the `layer_guess` and its `why`,
and a one-line "owns" sentence you have drafted from its headings. Then ask.

`layer_guess` is a path-and-history heuristic and it is right about most files. What it cannot see
is semantics: a file in a directory called `design/` whose own README says it is not an authority
reads as layer 2 and is really a layer-5 row. **Measured against a repo whose table was already
written, the guess agreed on 13 of 14 rows; the one miss was exactly that case.** So show the
evidence and let the user correct it — never present the guess as the answer.

The strongest evidence available is `git.appends_only`: a file amended in place is layer 2, one
only ever appended to is layer 3 or 6. One commit says nothing, and the inventory reports `null`
rather than guessing.

### 3. Flag overlaps and layer violations

- **Overlap** — two files claiming one heading. That is what the table exists to resolve, so it is
  a question for the user, never something to resolve quietly. Each overlap carries the `layers`
  involved: when they are all one layer it is usually a shared *format* (every plan has a
  § The issues), not two files competing for one question. Discount those; raise the rest.
- **Layer violation** — a file that restates something a higher layer owns. Two shapes are
  detected:
  - a **Current doc carrying a rationale** — "we chose X over Y because…". The reasoning belongs
    in layer 3, with a citation left behind. The giveaway is a sentence that would still be true
    if the current behaviour changed.
  - a **Seam doc that settles something** — layer 5 owns nothing, so a decision there is a
    decision nobody can find.

  Both come with the matching lines as `evidence`. Show the lines, not the verdict.

### 4. Write only the table, the config, the baseline, and files the user adds

Then run the program, `--dry-run` first:

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/seam-init.mjs" --answers seam-answers.json --repo . --dry-run
```

A row for a file that already exists takes `"create": false`. The program will not overwrite an
existing file in any case — it prints `kept` — but saying `false` is how the answers record that
the file is the user's.

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

Assertion **A3 stays off** until a workflow exists *and* the user confirms it is wired, because A3
compares two sides and a missing side makes the comparison vacuous. Off is distinct from passing.

## The baseline

A repo that has had docs for a while has day-one drift, and it is not hypothetical: one real
repo's `CLAUDE.md` cites six paths that do not exist, so A1 would go red on the first run, on the
very file the wizard just wrote the table into.

So run the checker once with **`--write-baseline`** and it records every current violation to
`.seam/baseline.json` — assertion id, file, line, and the matched text — after which it **fails
only on violations not in the baseline**. An ordinary run never writes it, so a repo with no
baseline file is a repo that reds on its day-one drift. `/seam:audit` prints the count on every run, so it stays visible and is expected to
shrink. A violation whose line no longer matches drops out of the baseline automatically rather
than being carried forever.

**A baseline entry is a debt with a number on it, not an approval.** An allow-list entry is the
other thing: it requires a **written reason** — the checker refuses one without it — and it means
"this will never be fixed". The baseline is its own file; an allow-list lives under the assertion
it exempts, in `.seam/config.json`. Two places, two rules, and the difference is the point.

Tell the user the size of the baseline **before** writing it, from the inventory's `summary`. A
number they agreed to is a ratchet; a number they discover afterwards is a wall.

## What the inventory deliberately does not reach

Named here because a reader who thinks it reaches further will trust a proposal further than they
should.

- **Whether a doc is *true*.** It reads structure and history, never claims. A doc that is wrong
  about the code looks identical to one that is right.
- **Semantics of ownership.** "What does this file own" is drafted from headings and must be
  confirmed. Two files can share no heading and still compete for one question.
- **A `§` citation whose subject is not a markdown file.** `` `some-skill` § The one gate ``
  cannot be resolved against anything in the tree, so it is reported as
  `cites.unresolvable_sections` — information, not a defect. A check that reds on a citation it
  cannot evaluate is a check that gets switched off.
- **A bare `§` whose subject was named in an earlier sentence.** A `§` binds to a markdown path
  adjacent to it, and to a following run of `§`s separated by nothing but a connector —
  "`docs/x.md` § A, § B and § C", which is how these are written. Past that the binding lapses
  and the `§` is read as naming a section of the file it is written in, which is a **guess**. The
  two outcomes are reported separately — `dangling.sections` for a citation that named its file,
  `dangling.bare_sections` for one that fell back — because they are not equally trustworthy.
  Measured on a 45-doc repo: 19 targeted misses inside the scope that repo's own checker uses,
  against 205 bare ones. The targeted number is a baseline you can ratchet down; the bare number
  is noise, and the checker has that form **off by default**.
- **Nested checkouts.** A directory containing a `.git` entry is another repo's tree and is not
  walked. Without that, one repo's seven worktrees contributed 67 of 75 "artifacts".
- **The board.** Whether an issue a plan claims is still open needs a network call, and every
  assertion here is a local, offline, deterministic read.
