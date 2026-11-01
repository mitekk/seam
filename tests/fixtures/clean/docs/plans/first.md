# The queenless list

**Layer 5 — Seam.** Superseded wholesale. **This file owns nothing.**

There are **two** plan files, and this is the first.

## The units

| # | Unit | Proves it | Done when |
|---|---|---|---|
| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |

## The issues, in the order they can be built

| # | Issue | Depends on | Why this order |
|---|---|---|---|
| 1 | #4 seed the database | — | nothing reads before something writes |
