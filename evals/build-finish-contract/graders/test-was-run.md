---
type: tool_used
tool: Bash
input_match: "--test"
---

Clause 1's mechanical half: a `node --test` run actually happened. The fixture carries exactly one
test file, `tests/count.test.mjs`, so the suite **is** the named test here — which is why the
matcher is the flag and not the filename: a run that does the right thing with `node --test` and no
path must not red. What it proves is therefore "the suite containing the named test was run", and
that is the whole claim. Without it, a response that correctly *describes* clause 1 and runs
nothing is indistinguishable from one that read an output.
