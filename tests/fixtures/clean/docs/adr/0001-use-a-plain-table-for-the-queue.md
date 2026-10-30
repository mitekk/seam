# 0001. Use a plain table for the queue

**Date:** 2026-01-01
**Status:** accepted
**Deciders:** apiary maintainers

## Context

One writer, one reader, a handful of jobs a day.

## Decision Drivers

- Nothing to configure.
- The rows are inspectable with the same tools as the rest of the data.

## Considered Options

| Option | Verdict |
|---|---|
| A plain table claimed with `for update skip locked` | **chosen** — no new dependency |
| A queue library | rejected — a daemon and a config file for a handful of jobs a day |

## Outcome

The queue is a plain table.

## Consequences

- **Good:** no new dependency.
- **Bad:** retries are hand-written.
- **Enforced by:** nothing, yet.
