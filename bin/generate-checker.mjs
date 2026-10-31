#!/usr/bin/env node
// generate-checker — emit this repo's drift checker from `.seam/config.json`.
//
// A program, not a template a model copies. The two emitted checkers — Python 3 (stdlib only)
// and Node `.mjs` — implement the same assertions with the same output format, so a repo can
// switch languages without changing what is enforced. The test suite runs both on every fixture
// and compares their findings, because that claim is only true if it is checked.
//
// What is substituted is the version stamp and the two paths. The ASSERTIONS are not generated
// per-config: the emitted checker reads `.seam/config.json` at run time and decides there what
// is enabled. That is deliberate — it is what makes "every repo-specific knob lives in the
// config, never edited into the script" true, and therefore what makes regeneration safe.
//
// `.seam/assertions/*` is never read, written or overwritten here. Those are the repo's own, and
// the emitted checker discovers them.
//
// Usage:
//   node bin/generate-checker.mjs --repo <dir> [--language python|node] [--out <path>]
//                                 [--write-baseline]
//
// Exit codes: 0 emitted, 2 there is no config to emit from.

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, "..");
const TEMPLATES = join(PLUGIN, "skills", "seam-checks", "templates");
const CONFIG_PATH = ".seam/config.json";

// What A14 counts as an assertion when `assertions.A14.assertion_pattern` is absent. It is written
// once, here, and substituted into both templates: two hand-kept copies drifted undetected in
// review, and a widening in one passed every test. It carries no quote, backtick or `${`, so it
// is inserted raw into a Python raw string and a JS `String.raw` alike.
const DEFAULT_ASSERTION_PATTERN =
  String.raw`\bassert(?:[_A-Z]\w*)?\b|\bexpect(?:[_A-Z]\w*)?\b|\b(?:ASSERT|EXPECT)_\w+\b`;

const LANGS = {
  python: { template: "checker.py.tmpl", ext: ".py", defaultOut: "scripts/check_docs.py" },
  node: { template: "checker.mjs.tmpl", ext: ".mjs", defaultOut: "scripts/check_docs.mjs" },
};

function die(msg, code = 2) {
  process.stderr.write(`generate-checker: ${msg}\n`);
  process.exit(code);
}

const USAGE = `generate-checker — emit a repo's drift checker from its .seam/config.json

  node bin/generate-checker.mjs [--repo <dir>] [--language python|node] [--out <path>]
                                [--write-baseline]

  --repo <dir>        the repo to emit into. Defaults to the CURRENT WORKING DIRECTORY, and
                      .seam/config.json is resolved against it — so run this from the repo root,
                      or pass --repo.
  --language <lang>   python (stdlib only) or node (.mjs). Defaults to checker.language in the
                      config. Both implement the same assertions with the same output format.
  --out <path>        where to write it. Defaults to checker.path in the config, else
                      scripts/check_docs.py or scripts/check_docs.mjs. The extension has to match
                      the language.
  --write-baseline    after emitting, run the checker with --write-baseline so today's violations
                      are recorded and it then fails only on what is new. An ORDINARY run never
                      writes the baseline.

  Exit 0 emitted, 2 there is nothing to emit from.

  .seam/assertions/* is never read, written or overwritten here: those are the repo's own, and
  the emitted checker discovers them.

  No config yet? The wizard writes one: /seam:init, or
  node bin/seam-init.mjs --answers <file> --repo <dir>.
`;

function parseArgs(argv) {
  const out = { repo: process.cwd(), language: null, out: null, writeBaseline: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--language") out.language = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--write-baseline") out.writeBaseline = true;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    } else die(`unknown argument ${argv[i]}\n\n${USAGE}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfgFile = join(args.repo, CONFIG_PATH);
  if (!existsSync(cfgFile)) {
    // Name the non-slash-command route too: a session that installed the plugin mid-flight
    // cannot reach /seam:init, and pointing only at the unreachable door is a dead end.
    die(`no ${CONFIG_PATH} in ${args.repo} — the checker is generated from the config, and there`
      + ` is nothing to generate from.\n\nWrite one with the wizard: /seam:init, or`
      + ` \`node ${join(PLUGIN, "bin", "seam-init.mjs")} --answers <file> --repo ${args.repo}\`.`
      + `\nIf you meant a different directory, pass --repo; the config is resolved against the`
      + ` current working directory by default. \`--help\` for the rest.`);
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(cfgFile, "utf8"));
  } catch (e) {
    die(`${CONFIG_PATH} is not valid JSON: ${e.message}`);
  }

  const language = args.language ?? cfg.checker?.language;
  if (!LANGS[language]) {
    die(`checker.language must be "python" or "node", not ${JSON.stringify(language)}`);
  }
  const lang = LANGS[language];
  const outPath = args.out ?? cfg.checker?.path ?? lang.defaultOut;
  if (!outPath.endsWith(lang.ext)) {
    die(`checker.path is ${outPath}, which does not end in ${lang.ext} — the language and the`
      + ` filename disagree, and the one that runs is whichever CI invokes`);
  }

  const version = JSON.parse(
    readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8"),
  ).version;

  const body = readFileSync(join(TEMPLATES, lang.template), "utf8")
    .replaceAll("{{SEAM_VERSION}}", version)
    .replaceAll("{{CONFIG_PATH}}", CONFIG_PATH)
    .replaceAll("{{CHECKER_PATH}}", outPath)
    // A function, so that a `$` in the pattern is not read as a replacement token.
    .replaceAll("{{DEFAULT_ASSERTION_PATTERN}}", () => DEFAULT_ASSERTION_PATTERN);

  const abs = join(args.repo, outPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  chmodSync(abs, 0o755);

  const enabled = Object.values(cfg.assertions ?? {}).filter((a) => a?.enabled).length;
  process.stdout.write(
    `wrote ${outPath} (seam ${version}, ${language}, ${enabled} assertions enabled)\n`
    + `every knob stays in ${CONFIG_PATH}; regenerate rather than editing the script\n`,
  );

  if (args.writeBaseline) {
    const argv = language === "python"
      ? ["python3", "-I", outPath, "--write-baseline"]
      : [process.execPath, outPath, "--write-baseline"];
    try {
      const printed = execFileSync(argv[0], argv.slice(1), {
        cwd: args.repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      process.stdout.write(printed);
    } catch (e) {
      process.stderr.write(e.stdout?.toString() ?? "");
      process.stderr.write(e.stderr?.toString() ?? "");
      die("the emitted checker failed while recording the baseline", 1);
    }
  }
}

main();
