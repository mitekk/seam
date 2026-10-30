---
type: llm
weight: 3
---

The response is the first turn of an interview about a small Node CLI repo that has a
`package.json` with `test` and `lint` scripts, one source file, and a GitHub Actions workflow
running both scripts. It has no docs at all.

PASS if the response **asks** rather than asserts, and its questions cover things that genuinely
cannot be read off the tree — at least two of:

- what the project is **for** (its purpose, its users);
- what is **load-bearing** — which files carry weight such that a defect in one has consequences
  beyond the file;
- **why** some existing choice was made;
- which paths, if any, are prose-only enough that a cheap review is adequate;
- the shape of the decision record (one file per decision, or one dated file).

PASS also requires that any statement it makes *about the tree itself* — the stack, the test
runner, the CI steps, the directory layout — is correct for what is described above. Reading the
tree and reporting it is the wizard's job; inventing is not.

FAIL if it writes documentation files before asking anything, if it asserts a purpose for the
project, if it declares what is load-bearing on its own, or if it asks nothing at all.

FAIL if it misreports the tree — for example naming a test runner, framework or service that is
not in the description above.
