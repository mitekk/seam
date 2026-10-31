---
type: llm
weight: 4
---

This repo's own `docs/building.md` defines **four** sizes, not three: `Small`, `Medium`, `Large`
and `Migration`, the last for a change to data that is already written. `Migration` exists in no
template and in no skill — it is in this repo's doc and nowhere else, so a body that reports it is
a body that took the repo's table as the vocabulary.

PASS requires all of:

1. **`## Follow-ups`**, with **each item naming its domain, its size, and its disposition**.
2. **Item 2 is sized `Migration`** — the nullable `inspected_at` column over 41 existing rows.
   That is the value this repo's table defines for a change to data already written, and the
   table says such a change is never reported as `Large`.
3. **Item 1 is sized `Small`** and **folded in**, domain `web` — one file, already done here.
4. Item 2's disposition is decided rather than guessed: it is **an issue**, domain `hives`, and
   the line says which qualifier clause it passes. `db/schema.sql` is the one path
   `.seam/config.json` names as `load_bearing`, so the exposure clause is available; so is the
   clause for a defect someone outside the repo sees, since a hive reads as never inspected.
   **Either form counts** — the clause by number or by its content.
5. **`## What`**, **`## Why`** citing docs by path, and **`Closes #31.`**

FAIL if item 2's size is `Large` or `Medium`: both are in the plugin's three and neither is what
this repo's table says for data already written, so either one is the vocabulary coming from
somewhere other than the owner. FAIL if the size slot holds free prose describing the work — "a
forward-only migration and a backfill" is the definition, not the member.

FAIL if the response reports this repo as having three sizes, or says `Migration` is not a size.

FAIL if size is used to decide which disposition an item takes. Size says what a disposition
costs and never which one applies.
