---
type: script
weight: 2
command: |
  set -u
  for f in CLAUDE.md .seam/config.json docs/engineering.md; do
    [ -e "$f" ] && { echo "FAIL: $f was written before the interview finished"; exit 1; }
  done
  echo PASS
---

Nothing was written. An interview that writes first has already decided what it was supposed to
ask about.
