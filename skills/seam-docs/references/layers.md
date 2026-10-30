# The six layers

The organising axis is **not** tense, and **not** technical-versus-product. It is:

> **What happens when this document turns out to be wrong?**

That one property fixes three things at once — the edit rule, the authority rank, and which
assertions can run against the file. It is also a question a human can answer in one sentence,
which is why it is the interview's question rather than "what kind of doc is this".

| # | Layer | Answers | When it's wrong | Edit rule |
|---|---|---|---|---|
| 1 | **Artifact** | what the machine does | cannot be — it *is* the code | changes with the code |
| 2 | **Current** | what is true now | a bug | amend in place |
| 3 | **Decisions (ADR)** | what we chose, and why | never — the record stands | append-only, dated; a reversal is a new entry |
| 4 | **Intent (PRD)** | what we are trying to build | expected | immutable versions; supersede with vN+1 |
| 5 | **Seam (plans)** | which units, in what order, what joins them | expected | superseded wholesale |
| 6 | **Ledger** | what we noticed and will not do | n/a | append-only rows |

## Authority

Authority is **not one chain**, because the layers answer different questions. Ranking them into
a single order is the mistake that makes people argue about whether a plan outranks a doc.

- **On what is true now:** Artifact beats Current, and nothing else may answer at all.
- **On why it is this way:** Decisions beat Current. A Current doc that gives a rationale
  **cites** the ADR rather than restating it.
- **On what we intend:** Intent beats Seam.
- **Seam and Ledger own nothing** and lose to everything, by construction.

**The rule that spans all six: a lower layer cites a higher one, never restates it.** PRD cites
ADRs, plans cite docs, docs cite the artifact. That is the rule the whole enforcement layer
exists to protect — every assertion below is downstream of it.

## Why the layering is load-bearing rather than taxonomy

The edit rule is what makes a layer **checkable**:

- **A7** — a reversed decision is never prescribed again — works only because layer 3 is dated
  and never edited. If a record could be rewritten, "what was reversed" would have no record.
- **A12** — byte-freeze — applies to **3 and 4 only**, and only because their edit rule says a
  file on the default branch is final. A layer-2 doc is byte-frozen by nothing, correctly.
- **A8 and A10** key on layer 5 owning nothing: a plan can claim an issue, but it cannot claim a
  question, so "two files claiming one seam" is resolvable.
- **A13** reads the shape layer 3 and 4 promise: a date, a status, a successor for a superseded
  record, an index entry per version.

So a repo that has the files but not the edit rules has the shape of this method and none of its
enforcement. That is the gap this plugin exists to close.

## Which assertions reach which layer

| # | Assertion | Layers |
|---|---|---|
| A1 | Every `*.md` path cited in backticks resolves | all |
| A2 | Every `§ Section` citation names a heading that exists | all |
| A3 | The documented check list and CI's run steps name the same commands | 2 |
| A4 | Every `<identifier>.<field>` in prose resolves against the artifact | 2 |
| A5 | Vocabulary blocks name exactly the members the artifact defines | 2 |
| A6 | Retired names never reappear | 2, 3 |
| A7 | A reversed decision is not prescribed again | 2, 3 |
| A8 | One issue, one owning plan | 5 |
| A9 | A stated count matches a computed one | 2, 5 |
| A10 | Every doc under `docs/` is in the table, with a layer | all |
| A11 | Config `load_bearing` matches the table's `Enforces` column | — |
| A12 | Append-only layers are byte-frozen on the default branch | 3, 4 |
| A13 | ADRs carry a date and a status; PRD versions are indexed | 3, 4 |
| A14 | Every unit in a plan's `§ The units` names a test that exists and asserts | 5 |

`skills/seam-checks/references/assertions.md` is what each one actually reads, and what it
deliberately does not reach.

## Choosing a layer, in practice

Ask the question, then read the answer off this list:

- "It can't be wrong, it's the code" → **1**. Schema, generated types, an OpenAPI document, a
  migration. Nothing else may answer what is true now.
- "If it's wrong, that's a bug — I'd just fix it" → **2**.
- "It was right when we wrote it; the world moved" → **3** if it records a *choice*, **4** if it
  records an *intention*. The test: does it say "we chose X over Y" (3) or "we are building X"
  (4)?
- "It's a bet on sequence" → **5**.
- "It's true and we're not doing anything about it" → **6**.

Two failure modes to watch for, because both are common in a repo that grew its docs:

- **A layer-2 doc that explains why.** Split the rationale out into layer 3 and leave a citation.
  The giveaway is a paragraph that would still be true if the current behaviour changed.
- **A layer-5 plan that owns a decision.** A plan with a settled decision in it is a decision
  nobody can find. Move it to layer 3; the plan cites it.

## Marking what is load-bearing

Three rules key off "load-bearing" — the review level's first row, the follow-up qualifier's
second clause, and A10's owner-versus-non-authority split — so it needs **one** machine-readable
home:

- The sources-of-truth table gets an **`Enforces`** column: for a row that carries weight, the
  artifact that enforces it — a constraint, an index, a CI assertion. An empty cell means the row
  owns documentation and nothing more.
- `.seam/config.json` carries `load_bearing: [<globs>]`.
- **A11 asserts the two agree.**

**Never infer this.** Ask, with `Enforces` shown empty by default. "What carries weight here" is
exactly the kind of question a tree cannot answer and a maintainer can.

## Rows that own nothing

Layers 5 and 6 are in the table so they are **findable**, and are explicitly marked as owning
nothing. That is not a formality: a reader who finds a plan and cannot tell whether it is
authoritative will treat it as authoritative.

Every doc under `docs/` is in the table with a layer, or it is drift — A10. There is no third
state.
