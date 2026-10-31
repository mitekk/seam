---
type: tool_used
weight: 1
tool: Bash
input_match: "--test"
---

Clause 1's mechanical half: the named test was actually run. The prompt names the suite as
`node --test`, so the call carries `--test`. Without this grader, a response that correctly
*describes* clause 1 and never runs anything is indistinguishable from one that read the output.
