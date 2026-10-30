# PRD v{{prd.version}} — {{repo.name}}

**Layer 4 — Intent.** What we are trying to build. Being wrong here is **expected**, because
intent moves — so this file is **immutable once written**. Requirements change by writing
`PRD-v{{prd.next_version}}.md`, **never by editing this file**. A superseded version stays
exactly as it was, so that a later reader can see what was intended when a decision was taken.

*Version {{prd.version}} · {{date}} · active*

## Purpose

{{purpose}}

## Users

{{users}}

## In scope

{{in_scope}}

## Out of scope

{{out_of_scope}}

Being out of scope is a statement about *this version*, not a refusal — the way to bring
something in is a new version.

## Open questions

{{open_questions}}

An open question is written as a question. It is never promoted to a confident sentence by a
later edit of this file; it is answered in the next version, or it moves to the layer-2 doc that
will answer it.

## Decisions this version rests on

{{adr.citation}} is the record. This file cites decisions; it does not restate their rationale.
