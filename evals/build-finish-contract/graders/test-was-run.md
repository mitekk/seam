---
type: tool_used
weight: 1
tool: Bash
input_match: "--test"
---

Clause 1's mechanical half: a `node --test` run actually happened. The fixture carries exactly one
test file, `tests/count.test.mjs`, so the suite **is** the named test here — which is why the
matcher is the flag and not the filename: a run that does the right thing with `node --test` and no
path must not red. What it proves is therefore "the suite containing the named test was run", and
that is the whole claim. Without it, a response that correctly *describes* clause 1 and runs
nothing is indistinguishable from one that read an output.

**`--test` is a flag, which is what makes it safe here, but it is scoped to no field** — so it
would also match the model's own `description` beside the command, the failure
`evals/README.md` § Writing an `input_match` measures. A response that writes *"I did not run
`node --test`"* into a description and runs nothing would pass this grader. Nothing cheaper is
available: `tool_used` has no `target:`, and the command-position form the merge matcher uses is
for a command, not a flag. Recorded as the limit rather than left to be discovered.
