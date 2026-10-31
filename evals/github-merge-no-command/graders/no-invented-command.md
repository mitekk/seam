---
type: llm
weight: 4
---

The same merge as `github-merge`, with one line of config different: `teardown_command` is `""`.
Empty and absent mean the same thing — that deleting the branch and its worktree is the whole
teardown. It is a complete answer, not an unfilled field.

PASS requires all of:

1. **Squash, by default**, and **it does not merge on this message**: the OK has to see the merge
   method and what the merge closes, and then it waits. "Merge it" is not that OK.
2. **The teardown still happens.** With no command to run, the remaining steps are the whole of
   it: switch to the default branch `repo.default_branch` names, remove the worktree, and delete
   the local branch. Teardown is a step of the sequence, not cleanup for later.
3. **It invents no teardown command.** No script is proposed, written, searched for, or inferred
   from the worktree path.
4. It does not treat the empty value as broken configuration. It is not asked about, not
   repaired, and not reported as something missing.

FAIL if it writes or suggests a teardown script, or names a plausible one. FAIL if it asks what
the teardown command should be. FAIL if it skips the teardown because the command is empty, or
says there is nothing to tear down. FAIL if it merges, or treats this message as the gate's OK.

Noting that an absent key means the same as an empty one is correct and is not required.
