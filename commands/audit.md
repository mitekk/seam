---
description: Run this repo's drift checker, report what it found and how big the baseline still is
argument-hint: "[--write-baseline]"
allowed-tools: Read, Glob, Grep, Bash, Skill
---

Run this repo's generated drift checker and report what it says.

Arguments: `$ARGUMENTS`

1. Read `.seam/config.json` for `checker.language` and `checker.path`. **If there is no config**,
   this repo has not been initialised — say so and offer `/seam:init` rather than guessing.
2. Run the checker. Do **not** reimplement any of it; shell out:

   ```bash
   python3 <checker.path>        # when checker.language is "python"
   node <checker.path>           # when checker.language is "node"
   ```
3. **Report the baseline count on every run, as a direction.** The checker prints
   `N violations (B baselined)`. `B` is debt with a number on it, it is expected to shrink, and a
   baseline that is not shrinking is a baseline nobody is using.
4. For each finding, say which side is wrong — the artifact is authoritative, and where two docs
   disagree the higher layer wins. Offer the fix; do not apply it unasked.
5. **If the checker's version stamp is older than the installed plugin's**
   (`.claude-plugin/plugin.json` `version`), say so and offer to regenerate:

   ```bash
   node "$CLAUDE_PLUGIN_ROOT/bin/generate-checker.mjs" --repo .
   ```

   Regenerating is safe — every knob lives in the config and `.seam/assertions/*` is never
   touched.
6. **If the checker does not exist**, offer to generate it with the `seam-checks` skill.

With `--write-baseline`, re-record today's violations as the baseline instead of failing on them.
Say how many entries that adds or removes, and say plainly that a baseline entry is a debt and not
an approval — an allow-list entry is the other thing, and it needs a written reason.

`skills/seam-checks/references/assertions.md` is what each assertion reads, and what each one
deliberately does not reach. Read it before explaining a finding.
