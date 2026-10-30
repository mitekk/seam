# Checks

**Layer 2 — Current.** What is true now; the edit rule is **amend in place**.

Owns: why each check exists, and what each deliberately does not reach.

## Checks

```bash
docker compose up -d                 # local only — CI starts its own Postgres
node --test
python3 scripts/check_docs.py
```

## What these do not reach

Whether a doc is *true*. That is a review's job, not a script's.
