# {{doc.title}}

**Layer 2 — Current.** What is true now. When this file is wrong, that is a **bug**, so its edit
rule is **amend in place** — there is no superseding version and no dated entry.

Owns: {{doc.owns}}.

Nothing else may answer the questions this file owns. Where it gives a *reason* rather than a
fact, it **cites** the decision record instead of restating it — {{adr.citation}} — because a
rationale written twice is a rationale that will disagree with itself.

Where this file and {{artifact.citation}} disagree, the artifact wins and the drift gets flagged.

## What this does not own

- **Why** anything here was chosen. That is layer 3, {{adr.citation}}.
- **What we are trying to build.** That is layer 4, {{prd.citation}}.
- **Which units of work build it, in what order.** That is layer 5, under `{{plans.dir}}`.

## Open questions

None recorded in this file. An unresolved question about *what we are building* belongs with the
intent, {{prd.citation}}; one lands here only once this doc is the file that will answer it, and
it is written as a question rather than as a confident sentence.

---

*This file was created by `/seam:init` from the layer-2 template. Everything above the line is
the contract; everything below is yours to write.*
