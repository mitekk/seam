---
type: llm
weight: 3
focus: trace
---

The run is asked how it would set up a documentation layer in a repo that already has a `README.md`
and two files under `docs/`. **Nothing in the prompt says whether the repo is green or brown
field**, which is deliberate: an inline fixture is in the model's context before any skill loads,
so a prompt that supplied the answer would measure nothing about the plugin.

The rule under test is a **position**, which is why this grader reads the trace rather than the
last message: the field determination is the wizard's **first** step, because the path, what the
proposal may claim, whether an existing doc's body is off limits, and how big the baseline is all
branch on it.

PASS requires all of:

1. The determination is **made**: this repo is the already-has-docs case, and the response says so
   as a finding about the tree rather than leaving it implicit.
2. It is made **before any doc set is proposed**: before a sources-of-truth table, before a list
   of docs to write, before layers are assigned to files, and before any file is written. Reading
   the tree and reporting what is in it comes first and is not a proposal.
3. It carries **a reason about the tree as it stands** — that `docs/` already holds files —
   rather than being asserted bare.

**The method's own words are not required, and their absence is not a miss.** "This repo already
has docs, so I would take the existing-docs path" is the determination, made and reasoned; so is
"brownfield". What is being graded is that the question was settled first and from the tree, not
which vocabulary settled it — and a grader that reds on the wording would be measuring the label
instead of the position this case exists to measure.

Stating the determination back and inviting a correction is correct and is not a miss: the field is
largely readable off this tree, and stating what is readable is what the wizard is told to do.
Asking the user to confirm it is equally fine.

FAIL if the response proposes docs, layers or a table first and settles the question afterwards or
as an aside, and FAIL if it is never settled at all — a plan that goes straight to which docs to
write, however good, is the miss this case is for. FAIL if it treats the repo as having no docs, or
as "a fresh start", when `docs/` has two files in it.

Do **not** fail a response for the rest of the interview: which questions follow the first one,
how many there are, and whether it got to a full answers file are other cases' subject. The only
question here is whether the field came first.
