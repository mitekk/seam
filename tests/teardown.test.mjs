// The documented merge teardown, **performed** against four real git repositories.
//
// Why this file exists, as a measurement rather than as a principle. `seam-github` § Merging and
// § Teardown are the most-followed logic the plugin ships, and until this file they were the only
// logic with no test. Three separate orderings of them shipped wrong, and every one read
// plausibly:
//
//   round 0  `git branch -d` first, which refuses while the branch is checked out or held by a
//            worktree — found by a reviewer running it
//   round 1  command-first, which deletes the session's own cwd (`fatal: Unable to read current
//            working directory`) and loses the pull that prevents a stale base — found by a
//            reviewer running it
//   round 2  a worktree repo with an empty `teardown_command` still cannot finish: after the
//            switch the worktree holds the branch and both `-d` and `-D` refuse — found by the
//            implementer running its own fix
//
// Not one was caught by a test, a checker assertion, `claude plugin validate`, or a careful read.
// Every one was caught by **executing** the steps. `docs/contributing.md` § Test-first already
// required this — "if the thing has procedural logic you can run, run it" — and nobody had applied
// it to prose. A documented git sequence is procedural logic you can run.
//
// **The steps are read from the skill, never transcribed here.** A test carrying its own copy of
// the sequence passes while the skill says something else, which is the restatement defect the
// whole method exists to prevent. So § Teardown's five steps each carry the command they are, in a
// fenced block, and `documentedSequence()` below runs those blocks in document order, followed by
// § Merging's step 4. Change the prose's order and this file goes red; that RED was observed, and
// the broken order and its output are in the task's report.
//
// Four shapes, because each of the three defects above lived in exactly one of them:
//
//   1  plain checkout, session on the branch, `teardown_command` empty
//   2  worktree repo, session in the main checkout, command present
//   3  worktree repo, session **inside the worktree**, command present   (round 1's shape)
//   4  worktree repo, session inside the worktree, command empty         (round 2's shape)
//
// **Dangerous-command hygiene is a mechanism, not care.** This suite runs `git branch -D`,
// `git switch` and `git pull --ff-only` four times per run, and during the work that produced
// § Teardown a reviewer subagent ran exactly those three in the owner's real repo because a
// `set -u` bug left a `cd` with an empty argument. So every shape asserts its repo root against
// the expected scratch path before the first mutating command, and every step is preceded by a
// guard that the repo it is about to mutate is under this run's scratch directory. The comparison
// resolves paths with `realpath`/`pwd -P` first, because `mkdtemp` returns `/var/folders/…` while
// `git rev-parse --show-toplevel` returns `/private/var/folders/…` and a naive comparison would
// trip the guard on every correct run — which is how a guard gets deleted.
//
// `gh` is not available and is not required: the squash is shaped with local git against a bare
// repo standing in for the remote, so the whole fixture runs offline like every other check here.
//
// Node's own cwd is never changed. Each shape's steps run in one `bash` child whose cwd is the
// simulated session directory, so when shape 3 deletes that directory it is the child that is
// standing in it — the child `cd`s out in step 1, which is the point of step 1 — and the runner
// stays where it was launched and can still report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync, realpathSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { REPO, scratch, rm } from "./helpers.mjs";

const SKILL = join(REPO, "skills/seam-github/SKILL.md");

// ── Reading the sequence out of the skill ────────────────────────────────────

/**
 * The numbered steps of one section, each with the fenced blocks that sit inside it, in document
 * order. Fences may be indented (a block inside a list item is), and the indentation is stripped
 * so the body runs as written.
 */
function stepsOf(sec, where) {
  const out = [];
  let cur = null;
  let fence = null;
  for (const line of sec.split("\n")) {
    const f = /^(\s*)(```|~~~)\s*(\w*)\s*$/.exec(line);
    if (f) {
      if (fence === null) {
        fence = { indent: f[1].length, lang: f[3], body: [] };
      } else {
        if (cur) cur.blocks.push({ lang: fence.lang, body: fence.body.join("\n") });
        fence = null;
      }
      continue;
    }
    if (fence) { fence.body.push(line.slice(fence.indent)); continue; }
    const m = /^(\d+)\. \*\*(.+?)\*\*/.exec(line);
    if (m) { cur = { n: Number(m[1]), label: m[2], blocks: [] }; out.push(cur); }
  }
  assert.equal(fence, null, `${where}: a fenced block is never closed, so the parse below read`
    + ` prose as commands or commands as prose`);
  return out;
}

/**
 * The documented sequence, in the order the skill gives it: § Teardown's five steps, then
 * § Merging's step 4, which is the pull and which § Merging puts after the teardown.
 *
 * Every assertion here is the "off is not passing" half of this file. A parse that found nothing
 * would hand the shapes an empty script, and four shapes that run no commands against a repo that
 * was already in the end state would pass green with nothing measured. So the parse states the
 * shape it requires and fails loudly when the prose stops carrying it — which is also the
 * instruction to whoever edits the prose next.
 */
function documentedSequence() {
  const md = readFileSync(SKILL, "utf8");
  const mergeAt = md.indexOf("## Merging, and the steps it is");
  const teardownAt = md.indexOf("### Teardown,");
  const endAt = md.indexOf("## Status reporting");
  assert.ok(mergeAt !== -1 && teardownAt > mergeAt && endAt > teardownAt,
    "§ Merging, § Teardown or § Status reporting moved — nothing was read, and a fixture that"
    + " read nothing would run nothing");

  const merge = stepsOf(md.slice(mergeAt, teardownAt), "§ Merging");
  const teardown = stepsOf(md.slice(teardownAt, endAt), "§ Teardown");
  assert.deepEqual(merge.map((s) => s.n), [1, 2, 3, 4],
    `§ Merging is not a four-step numbered list: ${JSON.stringify(merge.map((s) => s.n))}`);
  assert.deepEqual(teardown.map((s) => s.n), [1, 2, 3, 4, 5],
    `§ Teardown is not a five-step numbered list: ${JSON.stringify(teardown.map((s) => s.n))}`);

  const seq = [];
  const take = (s, where) => {
    assert.equal(s.blocks.length, 1,
      `${where} carries ${s.blocks.length} fenced blocks, expected exactly one — the block IS the`
      + ` step, and a step with none is a step this fixture cannot perform: ${s.label}`);
    const { lang, body } = s.blocks[0];
    assert.equal(lang, "bash", `${where}'s block is tagged \`${lang}\`, not \`bash\``);
    assert.ok(body.trim().length > 0, `${where}'s block is empty`);
    // A `<placeholder>` is prose shorthand, not something a shell can run. The blocks are
    // parameterised by the four `$SEAM_*` variables § Teardown names instead.
    assert.doesNotMatch(body, /<[a-z][a-z -]*>/,
      `${where}'s block still carries a <placeholder>, so it is not runnable as written:\n${body}`);
    seq.push({ where, label: s.label, body });
  };

  for (const s of teardown) take(s, `§ Teardown step ${s.n}`);
  // § Merging's first three steps are the gated merge, the issue check and "tear the branch down"
  // — prose with nothing to run. Asserted so a command added to one of them is not silently
  // dropped from the sequence this file performs.
  for (const s of merge) {
    if (s.n === 4) continue;
    assert.equal(s.blocks.length, 0,
      `§ Merging step ${s.n} gained a fenced block that this fixture does not run: ${s.label}`);
  }
  const pull = merge.find((s) => s.n === 4);
  take(pull, "§ Merging step 4");
  assert.match(pull.blocks[0].body, /git pull/,
    "§ Merging step 4's block is not the pull, so the one end-state fact an exit-code reading"
    + " loses is no longer being exercised");

  assert.equal(seq.length, 6, `read ${seq.length} runnable steps, expected six`);
  return seq;
}

// ── The repositories under test ─────────────────────────────────────────────

const BRANCH = "12-queenless-filter";
const DEFAULT_BRANCH = "main";
const ISSUE = "12";

// Hermetic git: the run must not depend on — or be steered by — the machine's own git config,
// `core.hooksPath` above all. Identity is set per repo below.
const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...GIT_ENV },
  }).trim();
}

function commit(cwd, name, body, message) {
  writeFileSync(join(cwd, name), body);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-m", message);
}

const sh = (s) => `'${String(s).replaceAll("'", `'\\''`)}'`;

/**
 * One shape: a bare repo standing in for the remote, a main checkout, optionally a worktree
 * holding the branch, and the squash already landed on the remote's default branch with the
 * remote branch deleted — which is where `gh pr merge --squash --delete-branch` leaves things.
 */
function shapeRepo(name, { worktree, inside, command }) {
  const root = realpathSync(scratch(`seam-teardown-${name}-`));

  const origin = join(root, "origin.git");
  mkdirSync(origin);
  git(root, "init", "--bare", "-b", DEFAULT_BRANCH, origin);

  const main = join(root, "apiary");
  mkdirSync(main);
  git(main, "init", "-b", DEFAULT_BRANCH);
  git(main, "config", "user.email", "test@example.com");
  git(main, "config", "user.name", "Test");
  commit(main, "README.md", "# apiary\n", "chore(repo): start the apiary");
  git(main, "remote", "add", "origin", origin);
  git(main, "push", "-u", "origin", DEFAULT_BRANCH);
  const base = git(main, "rev-parse", "HEAD");

  // The branch, where the shape says it lives.
  let wt = "";
  if (worktree) {
    wt = join(root, `wt-${ISSUE}`);
    git(main, "worktree", "add", "-b", BRANCH, wt, DEFAULT_BRANCH);
    commit(wt, "filter.txt", "only queenless hives\n", "feat(hives): filter the queenless list");
    git(wt, "push", "-u", "origin", BRANCH);
  } else {
    git(main, "switch", "-c", BRANCH);
    commit(main, "filter.txt", "only queenless hives\n", "feat(hives): filter the queenless list");
    git(main, "push", "-u", "origin", BRANCH);
  }

  // The squash, shaped with local git because `gh` is not available here: a third checkout lands
  // one commit on the remote's default branch and deletes the remote branch.
  const side = join(root, "side");
  git(root, "clone", "-q", origin, side);
  git(side, "config", "user.email", "test@example.com");
  git(side, "config", "user.name", "Test");
  commit(side, "filter.txt", "only queenless hives\n",
    `feat(hives): filter the queenless list on hive state (#${ISSUE})`);
  git(side, "push", "origin", DEFAULT_BRANCH);
  git(side, "push", "origin", "--delete", BRANCH);
  const squash = git(side, "rev-parse", "HEAD");

  // The stub `teardown_command`: shaped like campaign's `rm-worktree.sh` — cd to the main root,
  // remove the worktree, delete the branch — and deliberately not campaign's script. It carries
  // the same guard as the steps, since it is the one mutating command that is not one of them.
  let teardown = "";
  if (command) {
    assert.ok(worktree, "a teardown command with no worktree is not one of the four shapes");
    const script = join(root, "rm-worktree.sh");
    writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
n="$1"
cd ${sh(main)}
test "$(git rev-parse --show-toplevel)" = ${sh(main)} || {
  echo "GUARD TRIPPED in the teardown stub: $(git rev-parse --show-toplevel)" >&2; exit 9; }
branch=$(git for-each-ref --format='%(refname:short)' "refs/heads/$n-*")
test -n "$branch"
git worktree remove ${sh(wt)}
git branch -D "$branch"
`);
    chmodSync(script, 0o755);
    teardown = `${sh(script)} ${ISSUE}`;      // `teardown_command` with <n> already substituted
  }

  // Where the session is standing when the sequence starts — the axis that separates shapes 2 and
  // 3, and the first draft of this file got it wrong: both worktree-with-a-command shapes started
  // inside the worktree, so shape 2 was shape 3 under a different name and the main-checkout case
  // was untested while reporting green.
  assert.ok(!inside || worktree, "a session inside a worktree the shape does not build");
  return {
    root, origin, main, wt, session: inside ? wt : main, base, squash, teardown,
  };
}

// ── Running the sequence ────────────────────────────────────────────────────

/**
 * The documented blocks, in order, as one bash script — one process, because a session runs them
 * in one shell and step 1's `cd` has to reach step 5. No `set -e`: § Teardown is idempotent and a
 * step may legitimately find its work already done, so each step's status is reported and all of
 * them are asserted, rather than the first non-zero ending the run and hiding the rest.
 */
function sequenceScript(seq, { root, expected }) {
  const lines = [
    "set -u",
    `SEAM_SCRATCH=${sh(root)}`,
    `SEAM_EXPECTED=${sh(expected)}`,
    // The guard, before the first mutating command of the shape, as § Scope discipline requires.
    'top=$(git rev-parse --show-toplevel)',
    'test "$top" = "$SEAM_EXPECTED" || { echo "GUARD TRIPPED: $top" >&2; exit 9; }',
    // And again before every step, because step 1 moves the shell to another repo and steps 2–5
    // mutate whatever it landed in.
    `guard() {
  t=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "GUARD TRIPPED: no git repository at the current directory" >&2; return 1; }
  case "$t" in
    "$SEAM_SCRATCH"/*) return 0 ;;
    *) echo "GUARD TRIPPED: $t" >&2; return 1 ;;
  esac
}`,
    `step() {
  __n=$1; __where=$2; __body=$3
  if ! guard; then echo "STEP $__n ($__where) EXIT 9"; return 0; fi
  eval "$__body"
  echo "STEP $__n ($__where) EXIT $?"
}`,
  ];
  seq.forEach((s, i) => lines.push(`step ${i + 1} ${sh(s.where)} ${sh(s.body)}`));
  return lines.join("\n") + "\n";
}

/** Runs the script from the simulated session directory. Never throws; the caller asserts. */
function perform(seq, repo) {
  const script = sequenceScript(seq, { root: repo.root, expected: realpathSync(repo.session) });
  const env = {
    ...process.env, ...GIT_ENV,
    SEAM_BRANCH: BRANCH,
    SEAM_DEFAULT_BRANCH: DEFAULT_BRANCH,
    SEAM_WORKTREE: repo.wt ? realpathSync(repo.wt) : "",
    SEAM_TEARDOWN: repo.teardown,
  };
  // `spawnSync`, not `execFileSync`: the latter returns stdout only and **throws away stderr on a
  // zero exit**, which is where the guard's own message goes. The first draft of this file used it
  // and reported a tripped guard with an empty stderr — a diagnostic that could not diagnose,
  // which is the same class of defect as a check that cannot fail.
  const r = spawnSync("bash", ["-c", script], {
    cwd: repo.session, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env,
  });
  assert.equal(r.error, undefined, `bash did not run: ${r.error}`);
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// ── The shapes ──────────────────────────────────────────────────────────────

const SHAPES = [
  // name, options — `inside` is where the session stands — and what the shape is for.
  ["plain", { worktree: false, inside: false, command: false },
    "a plain checkout with the session on the branch: the switch has to happen before the delete"],
  ["worktree-command", { worktree: true, inside: false, command: true },
    "a worktree repo run from the main checkout: the command owns the removal and the delete"],
  ["worktree-inside", { worktree: true, inside: true, command: true },
    "round 1's shape: the command deletes the directory the session is standing in"],
  ["worktree-empty", { worktree: true, inside: true, command: false },
    "round 2's shape: with no command, the worktree still holds the branch when the delete runs"],
];

for (const [name, opts, why] of SHAPES) {
  test(`§ Merging and § Teardown, performed: ${name} — ${why}`, () => {
    const seq = documentedSequence();
    const repo = shapeRepo(name, opts);

    // The pre-state, asserted rather than assumed. Without this the end-state facts below can
    // pass vacuously: a repo already on the default branch with the branch already gone and
    // nothing to pull would satisfy all four while the sequence did nothing at all.
    assert.equal(git(repo.main, "rev-parse", "--verify", `refs/heads/${BRANCH}`).length, 40,
      "the branch is not there before the teardown, so its deletion proves nothing");
    // The shape's own axes, so a shape cannot quietly become another one: where the branch is
    // checked out, and where the session is standing.
    assert.equal(existsSync(repo.session), true, "the session directory was never built");
    assert.equal(git(repo.session, "rev-parse", "--show-toplevel"), repo.session,
      `the session is not at the root of ${opts.inside ? "the worktree" : "the main checkout"}`);
    assert.equal(git(repo.wt || repo.main, "rev-parse", "--abbrev-ref", "HEAD"), BRANCH,
      "the branch is not checked out where the shape says it is");
    assert.equal(git(repo.main, "rev-parse", "--abbrev-ref", "HEAD"),
      opts.worktree ? DEFAULT_BRANCH : BRANCH,
      "the main checkout is not on the branch the shape puts it on");
    assert.equal(git(repo.main, "rev-parse", DEFAULT_BRANCH), repo.base,
      "the local default branch is already past its base, so the pull has nothing to prove");
    assert.notEqual(repo.base, repo.squash);
    // The squash is a descendant of the base: that is what makes the pull a fast-forward, and if
    // it were not, `--ff-only` would refuse and the shape would be measuring the wrong refusal.
    git(repo.main, "fetch", "-q", "origin");           // objects, so the ancestry can be read
    git(repo.main, "merge-base", "--is-ancestor", repo.base, repo.squash);
    git(repo.main, "update-ref", "refs/remotes/origin/main", repo.base);   // undo the peek

    const r = perform(seq, repo);

    // Every step ran, and every step succeeded. A step that found its work already done exits 0
    // through its own conditional — § Teardown is idempotent and `branch not found` is that, not
    // a failure — so "all zero" is the right reading and a skipped step is not hidden by it.
    const reported = [...r.stdout.matchAll(/^STEP (\d+) \((.+?)\) EXIT (\d+)$/gm)]
      .map((m) => [Number(m[1]), m[2], Number(m[3])]);
    assert.equal(reported.length, seq.length,
      `${reported.length} of ${seq.length} steps reported a status — the sequence stopped early`
      + `\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`);
    assert.deepEqual(reported.map(([, where, code]) => [where, code]),
      seq.map((s) => [s.where, 0]),
      `a documented step failed as written\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`);
    assert.equal(r.status, 0, `the sequence exited ${r.status}\n${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, /GUARD TRIPPED/, r.stdout + r.stderr);

    // The four end-state facts the sequence promises. Not "no command errored": round 1 passed an
    // exit-code-only reading while silently losing the pull.
    const show = `\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`;
    assert.equal(git(repo.main, "branch", "--list", BRANCH), "",
      `the local branch survived the teardown${show}`);
    if (repo.wt) {
      assert.equal(existsSync(repo.wt), false, `the worktree directory survived${show}`);
      assert.doesNotMatch(git(repo.main, "worktree", "list", "--porcelain"), /wt-12/,
        `the worktree is still registered${show}`);
    }
    assert.equal(git(repo.main, "rev-parse", "--abbrev-ref", "HEAD"), DEFAULT_BRANCH,
      `the main checkout is not on the default branch${show}`);
    assert.equal(git(repo.main, "rev-parse", "HEAD"), repo.squash,
      `the default branch did not reach the squash, so the pull in § Merging's step 4 did not`
      + ` happen or did not fast-forward — this is the fact round 1 lost in silence${show}`);
    assert.equal(git(repo.main, "rev-list", "--merges", `${repo.base}..HEAD`), "",
      `the default branch took a merge commit, so the pull was not fast-forward only${show}`);

    rm(repo.root);
  });
}
