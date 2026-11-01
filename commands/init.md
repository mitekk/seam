---
description: Install or extend this repo's layered documentation spine — the sources-of-truth table, one doc per layer, and .seam/config.json
argument-hint: "[--answers <file>] [--dry-run]"
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Skill
---

Install seam's documentation layer into this repo.

Arguments: `$ARGUMENTS`

- No arguments → run the interview, then write what the user approves.
- `--answers <file>` → the interview already happened and this file is its record. **Do not ask
  anything.** Anything the file does not answer is an open question, not a decision for you.
- `--dry-run` → print what would be written and write nothing.

Use the `seam-docs` skill, which owns this procedure. Before anything else:

1. Read `$CLAUDE_PLUGIN_ROOT/skills/seam-docs/references/layers.md` — the layer is the answer to *what happens when
   this document turns out to be wrong*, and it selects the edit rule and the assertions.
2. Read `$CLAUDE_PLUGIN_ROOT/skills/seam-docs/references/interview.md` — the question set, the answers-file schema,
   and which questions may be answered from the tree rather than asked.
3. **Establish whether this repo is green or brown field before proposing anything** — it is the
   interview's first question, it is milestone 1 in the repo's own taxonomy, and it selects the
   path. If this repo already has docs it is brownfield: read
   `$CLAUDE_PLUGIN_ROOT/skills/seam-docs/references/adopt.md` first, and that path never rewrites
   an existing doc's body.

Then, once the answers file exists:

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/seam-init.mjs" --answers <file> --repo . --dry-run
node "$CLAUDE_PLUGIN_ROOT/bin/seam-init.mjs" --answers <file> --repo .
```

Report the `kept` and `missing` lines from its output — they are where the proposal and the tree
disagree. Then offer to generate the checker and the baseline with the `seam-checks` skill.
