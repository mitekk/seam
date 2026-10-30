# PRD versions

**Layer 4 — Intent.** The index of every version, newest first. `PRD-current.md` carries the
full active text; a `PRD-v*.md` file is **immutable** once written.

Requirements change by writing the next version and replacing `PRD-current.md` with its text. A
version file is never edited — that is what makes "what did we intend when we decided this?"
answerable eighteen months later, and it is what assertion A12 byte-freezes.

| Version | Date | Summary |
|---|---|---|
| [v{{prd.version}}](PRD-v{{prd.version}}.md) | {{date}} | First recorded intent: {{purpose_short}} |
