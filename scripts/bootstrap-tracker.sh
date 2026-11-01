#!/usr/bin/env bash
# Create seam's own labels and milestones on a GitHub remote, from docs/taxonomy.md.
#
# Not run automatically: creating a remote repo and writing to it is outward-facing, so it
# needs an explicit OK every time (skills/seam-github/SKILL.md § The gate). Run it by hand
# once `gh repo create` has been done.
#
# Usage: scripts/bootstrap-tracker.sh <owner>/<repo>
set -euo pipefail

[ $# -eq 1 ] || { echo "usage: $0 <owner>/<repo>" >&2; exit 2; }
repo=$1

# Domains — docs/taxonomy.md § Domains is the authoritative list. Keep in step.
for d in wizard checker github review plugin tests docs; do
  gh label create "$d" -R "$repo" --description "domain: $d" --color ededed --force
done

# Priorities — docs/taxonomy.md § Priorities.
gh label create p0 -R "$repo" --description "live defect someone outside the repo sees, or blocks the active milestone" --color b60205 --force
gh label create p1 -R "$repo" --description "in the active milestone" --color fbca04 --force
gh label create p2 -R "$repo" --description "later" --color c5def5 --force

# Milestones — docs/taxonomy.md § Milestones.
while IFS='|' read -r n title; do
  [ -n "$title" ] || continue
  gh api -X POST "repos/$repo/milestones" -f title="$n · $title" >/dev/null || true
done <<'MILESTONES'
1|Establish the field — seam is brownfield
2|Skeleton
3|The doc wizard, greenfield
4|The adopt path
5|The drift checker
6|GitHub conventions
7|The review policy
8|First real adoption
MILESTONES

echo "labels and milestones created on $repo"
