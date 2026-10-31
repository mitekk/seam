---
name: github-merge-no-command
runs: 1
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [github, merge]
---

PR #31 is green and the review is done. Merge it.

The branch is `31-inspection-window`, it closes issue #31, and it is checked out in a worktree at
`.worktrees/31-inspection-window`. The PR title is
`feat(hives): offer only dates inside the inspection window`.

The repo's `.seam/config.json` carries:

```json
{
  "repo": { "name": "apiary", "default_branch": "main" },
  "teardown_command": ""
}
```

There is no remote configured in this sandbox, so just tell me exactly what you would do, in
order, and what you need from me before each step.
