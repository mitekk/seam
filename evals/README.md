# The eval suite

One case per behaviour that must survive a rewrite of the skill that produces it. Cases are
`prompt.md` plus `graders/*.md`, in the shape `claude plugin eval init --bare <name>` writes.

```bash
claude plugin eval . --allow-tools Write Edit Bash --trust-plugin
```

`--allow-tools Write Edit Bash` matters: those are gated by default, and a wizard that cannot
write anything scores zero for the wrong reason. The `with-without` ablation arm is the number
worth reading — it says whether the plugin changed the outcome or the model would have managed
anyway.

| Case | Grades |
|---|---|
| `wizard-greenfield` | the **files written** from a recorded answers file, and that no claim was invented |
| `wizard-interview` | the **questions asked**, and that nothing was written before the interview finished |
| `wizard-adopt` | the **layer classification**, the overlap, the layer violation, and that it stayed a proposal |
| `github-issue-shape` | domain, priority, milestone, the Context citation, externally checkable criteria, `--body-file` |
| `github-pr-shape` | five follow-up items, on a case built so that size and the qualifier give different answers |
| `github-size-citation` | the repo's **own** `docs/building.md` winning as the size vocabulary — `Migration`, a size no template has |
| `github-gate` | the refusal: push and merge gated, the commit's review precondition, and the two kept apart |
| `github-merge` | the sequence: squash by default, an OK that has seen the method and what it closes, teardown as a step |
| `github-merge-no-command` | the same with `teardown_command` empty: the remaining steps are the whole of it, and none is invented |
| `github-merge-gate` | the gate alone, on a prompt that asks for no plan: no merge command is run, and the OK's contents are shown first |
| `review-level` | the level for seven diffs, against the condition table |
| `review-rounds` | the bound, the named third-round trigger, and that a third round is recommended rather than run |
| `build-start-contract` | no unit owns the work: the row written, written *before* the source changes, and nothing stopping to ask |
| `build-finish-contract` | a unit whose named test never ran: which of the four clauses is unmet, and the test actually run |
| `context-level` | the level read off the figure not the agent count, the Orange action in full, and no invented threshold |

## What the graders can and cannot do

Measured against this build of the runner — `claude` 2.1.316 — so that the next person does not
re-derive it. **Three of the lines here replace an earlier reading of this same section**, and each
shape below was run rather than read off a schema.

- Grader types are `regex`, `tool_order`, `tool_used`, `file_exists`, `llm` and `baseline`.
  **There is no script grader.**
- `regex` and `llm` both take a target, and it **can be a file the run wrote** — `target:` on a
  `regex` grader, `focus:` on an `llm` one. Either takes one of `trace`, `last_message`, `files`
  or `mock_calls`, or `{source: file, path: <relative to the run's cwd>}`; the default is
  `last_message`. `build-start-contract/graders/unit-row-written.md` is the file form, and that
  case's `start-contract.md` grades the `trace`, which is the only way to judge what a run *did*,
  in what order. A file target that does not exist makes the grader **throw** rather than pass
  quietly.
- `tool_used` takes `input_match`, `min` and `max` beside `tool`, so it can assert *which* path a
  call carried — or that a call never happened at all, with `min: 0, max: 0`.
  `build-finish-contract/graders/test-was-run.md` is the `input_match` form.
- `tool_order` takes `before` and `after`, each a tool name or `{tool, input_match}`, and needs
  **both** calls in the trace — so it reds when a run chose `Write` where the grader named `Edit`.
  That is a tool-choice red and not a behaviour one, which is why no case here uses it.
- `file_exists` takes one `path` and an optional `exists: false`.
- The runner **pre-flights** every grader against the case's `allowed_tools` and the run's grants,
  and says when one cannot pass — *"it checks a file the run creates, but no tool the run may use
  can create one"*. That warning costs nothing and is worth reading.
- **There is no working scaffold hook.** `scaffold_script` is rejected in `prompt.md` frontmatter
  and silently does nothing in `case.yaml`. So each case carries its fixture **inline in the
  prompt** and the run builds it.

**Both arms of the citation-plus-fallback route are covered, by different cases.**
`github-size-citation`'s fixture **has** a `docs/building.md`, and its fourth size `Migration`
is what proves the repo's doc won. `github-pr-shape` and `build-start-contract` have **none**, so
there the skill's `$CLAUDE_PLUGIN_ROOT` fallback is what supplies the sizes and the start
contract — a run of the latter said so in as many words: *"The repo has no `docs/building.md`, so
I used the build skill's default steps."*

**The fallback is reliable for the start contract and measurably not for the finish contract.**
Removing `docs/building.md` from `build-finish-contract`'s fixture was tried, over three runs, and
the skill fired twice while reading the template **none** of the three: it offered to write the doc
and then fell back to the plan's `Done when` column alone — *"This repo has no `docs/building.md`,
so the only finish contract is the plan's 'Done when' column."* That is the same shape Ruling 100
fixed for the size vocabulary, in the other skill, so the fixture keeps its `docs/building.md` and
the finding is written up rather than papered over.

### Which cases the plugin actually changes

`--ablation with-without` is the number worth reading, and measured over the runs stated it sorts
this suite into cases that earn their keep and cases that are regression guards:

| Case | with | without | Δ | runs |
|---|---|---|---|---|
| `github-merge` | 1.00 | 0.00 | **+1.00** | 2 |
| `build-start-contract` | 1.00 | 0.33 | **+0.67** | 2 |
| `context-level` | 1.00 | 0.56 | **+0.44** | 6 |
| `github-merge-no-command` | 1.00 | 1.00 | 0.00 | 2 |
| `build-finish-contract` | 0.52 | 0.68 | −0.16 | 10 |

**What separates them is whether the prompt quotes the doc that answers the question.** A fixture
has to be inline here, and a quoted doc is in the model's context before any skill loads — so a
case whose answer is in its own fixture cannot show a delta, however good the grader.
`github-merge`, whose method is only in `SKILL.md`, carries the largest one.

**The way out, where there is one, is to ask something the fixture cannot answer.**
`context-level` went from Δ 0.00 to Δ +0.44 on one added clause: its fixture `docs/context.md`
says nothing about *when* to read the level again, so the four moments — before a dispatch, when a
verbose result lands, at a phase boundary, and when a tool result is not what was expected — are
the skill's or they are a guess. The same technique applied to `build-finish-contract` did **not**
move its delta, which is why that case is documented as a guard and its cause routed rather than
patched. A Δ at or below zero is a case to re-read, not a case to delete: `build-finish-contract`
reds when a response reaches "not done" through the plan's `Done when` alone, and that is worth
catching whether or not the base model would have managed the rest.

**What the inline fixture costs, and it is not nothing.** A fixture the prompt quotes is in the
model's context before a single file is read, so **no grader here can prove a file was read rather
than remembered**. `tool_used` with `input_match` would prove it, but a run that answers from the
message is following the prompt rather than failing the skill, so that red would be the case's
fault. A case that needs the repo's own doc to have *won* therefore grades the **effect**:
`github-size-citation`'s fixture doc defines a fourth size, `Migration`, which exists in no
template and no skill, so a body reporting it can only have taken the repo's table as its
vocabulary.

Exhaustive deterministic assertions about *file contents* still live in `node --test`, because
they are offline, free and run on every push: the generator's own tests check the table's columns
and the config's prose-freedom there. A file-reading grader here is for the one fact a case turns
on — that the row reached the plan, that the state reached the disk. What the evals are for is the
part a test cannot reach: whether the skill asks rather than asserts, disposes of a follow-up
correctly, performs a sequence, and refuses what it should refuse.

### The load check is not `--case 'nope'`

**Measured:** `--case 'nope'` prints `No eval cases found matching` and exits **without loading or
validating anything**, so a grader with an invalid `type:` passes it. Cases are loaded *after* the
`--case` filter, so the cheap check is a filtered run with a cost ceiling:

```bash
claude plugin eval . --case '*' --trust-plugin --no-publish --ablation none \
  --max-cost-usd 0.0001 --allow-tools Write Edit Bash
```

Every matched case is loaded and pre-flighted before the first run launches, the ceiling stops it
after one, and a broken case prints `✗ <dir>: invalid case.yaml …` with a closing
`N case file(s) failed to load`. One run's cost is the price of the check.

## A single red run is not a finding

**Measured here:** `github-gate` scored 0.00 with three unanimous FAIL judge votes, and then 1.00
with three unanimous PASS votes on the next run, with **no change to the skill in between** — the
only edit was adding a `tool_used` grader to the same case.

So a red case is re-run before it is treated as a defect, and the first question is whether the
skill fired at all. That is what the `tool_used: Skill` grader is for: without it, a run where the
plugin never loaded is indistinguishable from one where it loaded and got the answer wrong. **Every
case carries one**, and it is the same four lines of frontmatter in each — one artifact, so one
proof that it reds covers all of them:

```bash
for f in evals/*/graders/skill-fired.md; do
  printf '%-46s %s\n' "$f" "$(sed -n '/^---$/,/^---$/p' "$f" | shasum | cut -c1-12)"
done
for d in evals/*/; do [ -d "$d/graders" ] || continue
  [ -f "$d/graders/skill-fired.md" ] || echo "MISSING: $d"
done
```

The second loop prints nothing. It printed `evals/wizard-interview/` until that case got one — and
that was the case whose other two graders both assert a file is **absent**, which is exactly what a
run with no plugin produces.

Cases run once each (`runs: 1`) to keep the suite affordable. With the default threshold of 1.0
that means one run has to pass, which is a real weakness and the reason for the paragraph above —
not a reason to loosen a grader.

**And a single green run is not proof of a fix.** Measured on `github-pr-shape` over five runs
either side of one change: 3 of 5 before, 5 of 5 after. Within the before set, runs 1 and 3
produced near-identical bodies — the same four dispositions, the same three size names — and
opposite verdicts, on judge votes of FAIL/PASS/PASS against FAIL/FAIL/PASS. So part of a case's
variance is the judge's majority vote near the boundary of a long criteria, and **the unit of
evidence for a claim about a case is a pass rate over at least five runs**, with the run count
stated. `--runs 5 --ablation none` is the shape; `--ablation with-without` doubles the bill and
answers a different question.
