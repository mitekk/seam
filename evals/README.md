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
| `github-pr-shape` | the four dispositions, on a case built so that size and the qualifier give different answers |
| `github-gate` | the refusal: push and merge gated, the commit's review precondition, and the two kept apart |
| `review-level` | the level for seven diffs, against the condition table |
| `review-rounds` | the bound, the named third-round trigger, and that a third round is recommended rather than run |

## What the graders can and cannot do

Measured against this build of the runner, so that the next person does not re-derive it:

- Grader types are `regex`, `tool_order`, `tool_used`, `file_exists`, `llm` and `baseline`.
  **There is no script grader**, and `llm` would not accept any `focus` shape — so a grader cannot
  read a file the run wrote and judge its contents.
- `regex` matches against the run's **last message**, not against files.
- `file_exists` takes one `path` and an optional `exists: false`.
- **There is no working scaffold hook.** `scaffold_script` is rejected in `prompt.md` frontmatter
  and silently does nothing in `case.yaml`. So each case carries its fixture **inline in the
  prompt** and the run builds it.

That is why deterministic assertions about *file contents* live in `node --test` rather than here:
the generator's own tests check the table's columns and the config's prose-freedom exhaustively.
What the evals are for is the part a test cannot reach — whether the skill asks rather than
asserts, disposes of a follow-up correctly, and refuses what it should refuse.

## A single red run is not a finding

**Measured here:** `github-gate` scored 0.00 with three unanimous FAIL judge votes, and then 1.00
with three unanimous PASS votes on the next run, with **no change to the skill in between** — the
only edit was adding a `tool_used` grader to the same case.

So a red case is re-run before it is treated as a defect, and the first question is whether the
skill fired at all. That is what the `tool_used: Skill` grader on most cases is for: without it, a
run where the plugin never loaded is indistinguishable from one where it loaded and got the answer
wrong.

Cases run once each (`runs: 1`) to keep the suite affordable. With the default threshold of 1.0
that means one run has to pass, which is a real weakness and the reason for the paragraph above —
not a reason to loosen a grader.
