# Engineering

**Layer 2 — Current.** What is true now; the edit rule is **amend in place**.

Owns: stack, data access, and the hive-state vocabulary.

## Stack

Node, and `node --test`. The checks are in `docs/checks.md` § Checks, and the index links them
as [`checks.md`](docs/checks.md) — a label, not a citation, because the link target is the claim.

## Data access

A hive's current state is `hives.state`, and its apiary is `hives.apiary_id`. An apiary's name is
`apiaries.name`.

## Hive states

The vocabulary is `db/schema.sql`'s `hive_state`, and these are its members:

```
queenless
requeened
thriving
```

## Queue

A plain table. The rationale is in `docs/adr/*.md` — this file cites it rather than restating it.
