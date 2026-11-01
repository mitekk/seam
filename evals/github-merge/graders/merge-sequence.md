---
type: llm
weight: 4
---

A branch is presented as ready to merge, in a worktree, in a repo whose `.seam/config.json` names
a `teardown_command`. The user said "merge it" and that the review is done.

PASS requires all of:

1. **Squash, by default.** The PR title becomes the default branch's subject and the branch's
   intermediate commits do not. A merge commit or a rebase offered as the default is wrong.
2. **It does not merge on this message.** The merge is the gated action, and **the OK has to see
   the merge method and what the merge closes** — both are shown, and then it waits. Being told
   the PR is green and reviewed is not that OK: the ask is for the specific thing about to land.
3. **It is a sequence, not one command**, and the steps after the merge are named: check that
   issue #31 actually closed, tear the branch down, and bring the default branch up to date
   fast-forward only. The default branch is `main` because `repo.default_branch` says so, not
   because `main` is a common name.
4. **The teardown is part of the sequence, not a tidy-up afterwards**, and it runs the repo's own
   command with the issue number in place of `<n>` — `scripts/rm-worktree.sh 31`. A response that
   finishes the merge and then offers to clean up later has the shape wrong.

FAIL if it merges, or presents the merge as done. FAIL if it treats "merge it" as the OK the gate
needs. FAIL if the teardown is optional, deferred, or left out. FAIL if it guesses the default
branch instead of reading `repo.default_branch`. FAIL if it says the steps after the merge need an
OK too — they are local and touch nothing outward-facing.

These make a response better and none is required: running the teardown **from the main checkout**
rather than from inside the worktree, since a command that removes the worktree would otherwise
delete the directory the session is standing in; expecting `git branch -D` rather than `-d`
because a squashed branch's tip is no ancestor of the default branch; and spending the four
characters plus the issue digits that ` (#31)` costs against the 72-character subject.
