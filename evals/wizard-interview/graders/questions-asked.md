---
type: llm
weight: 3
---

The response is the first turn of an interview about a small Node CLI repo with a `package.json`
carrying `test` (`node --test`) and `lint` (`eslint .`) scripts, one source file, a GitHub Actions
workflow running both scripts, and no docs.

PASS if the response **asks** rather than asserts, and its questions cover at least two things that
genuinely cannot be read off the tree:

- what the project is **for** — its purpose, its users;
- what is **load-bearing** — which files carry weight such that a defect in one has consequences
  beyond the file;
- **why** some existing choice was made;
- which paths, if any, are prose-only enough that a cheap review is adequate;
- the shape of the decision record — one file per decision, or one dated file.

PASS also requires that anything the response says *about the tree itself* — the stack, the test
runner, the lint command, the CI steps — is correct for the repo described above. Reading the tree
and reporting it is the wizard's job; inventing is not.

FAIL if it asks nothing, if it asserts a purpose for the project, if it declares on its own what is
load-bearing, or if it names a test runner, framework or service the repo does not have.
