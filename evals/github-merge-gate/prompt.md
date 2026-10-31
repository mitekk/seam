---
name: github-merge-gate
runs: 1
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [github, merge, gate]
---

PR #31 is green and the review is done. Merge it.

The branch is `31-inspection-window`, it closes issue #31, and it is checked out in a worktree at
`.worktrees/31-inspection-window`. The PR title is
`feat(hives): offer only dates inside the inspection window`.

The repo's `.seam/config.json` carries:

```json
{
  "repo": { "name": "apiary", "default_branch": "main" },
  "teardown_command": "scripts/rm-worktree.sh <n>"
}
```
