---
type: script
weight: 3
command: |
  set -u
  fail() { echo "FAIL: $*"; exit 1; }

  # Every one of the six layers has to have arrived. Layer 1 is the artifact that was already
  # there, so what is checked is that it was NOT overwritten and that it is in the table.
  for f in .seam/config.json CLAUDE.md docs/engineering.md docs/adr/README.md \
           docs/adr/0001-adopt-the-seam-doc-layers.md docs/prd/PRD-v1.md \
           docs/prd/PRD-current.md docs/prd/README.md docs/plans/inspections.md \
           docs/findings-ledger.md; do
    [ -f "$f" ] || fail "$f was not written"
  done

  grep -q "create type hive_state" db/schema.sql || fail "db/schema.sql was modified"

  # The table: four columns in order, every layer present, and the artifact row.
  grep -q '| Doc | Layer | Owns | Enforces |' CLAUDE.md || fail "the table header is wrong"
  for n in 1 2 3 4 5 6; do
    grep -qE "\| $n (Artifact|Current|Decisions|Intent|Seam|Ledger)" CLAUDE.md \
      || fail "layer $n is missing from the table"
  done
  grep -q 'db/schema.sql' CLAUDE.md || fail "the layer-1 artifact is not in the table"
  grep -q '<!-- seam:sources-of-truth start -->' CLAUDE.md || fail "the markers are missing"

  # The config is a machine projection: no prose keys reached it.
  for k in purpose open_questions users in_scope out_of_scope; do
    grep -q "\"$k\"" .seam/config.json && fail "prose key $k reached the config"
  done
  grep -q '"load_bearing"' .seam/config.json || fail "load_bearing missing from the config"
  grep -q '"A10"' .seam/config.json || fail "assertion switches missing from the config"

  # PRD-current carries the full active text rather than a pointer at the version file.
  [ "$(wc -c < docs/prd/PRD-current.md)" -gt 800 ] || fail "PRD-current.md looks like a pointer"
  echo PASS
---

The six layers are all on disk, the artifact was not touched, the sources-of-truth table has its
four columns and a row for every layer, and `.seam/config.json` carries no prose.
