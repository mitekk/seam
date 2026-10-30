# apiary

Context for anyone working in this repo. Read the row before changing anything it covers.

## Sources of truth — read before changing related code

<!-- seam:sources-of-truth start -->

Every doc under `docs/` is in this table with a layer, or it is drift (assertion A10). A lower
layer **cites** a higher one and never restates it.

| Doc | Layer | Owns | Enforces |
|---|---|---|---|
| `db/schema.sql` | 1 Artifact | The schema, its constraints and its vocabularies — wins over every doc | `db/schema.sql` |
| `docs/engineering.md` | 2 Current | Stack, data access, and the hive-state vocabulary |  |
| `docs/checks.md` | 2 Current | Why each check exists and what it does not reach |  |
| `docs/adr/*.md` | 3 Decisions | What was chosen, the options rejected, and why |  |
| `docs/prd/*.md` | 4 Intent | What we are trying to build |  |
| `docs/plans/*.md` | 5 Seam | Nothing — which issues build a subsystem, in what order |  |
| `docs/findings-ledger.md` | 6 Ledger | Nothing — true observations that are not becoming work |  |

**Seam and Ledger own nothing** and lose to everything by construction.

<!-- seam:sources-of-truth end -->
