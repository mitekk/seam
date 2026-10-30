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

const LANGS = {
  python: { template: "checker.py.tmpl", ext: ".py", defaultOut: "scripts/check_docs.py" },
  node: { template: "checker.mjs.tmpl", ext: ".mjs", defaultOut: "scripts/check_docs.mjs" },
};

function die(msg, code = 2) {
  process.stderr.write(`generate-checker: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { repo: process.cwd(), language: null, out: null, writeBaseline: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--language") out.language = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--write-baseline") out.writeBaseline = true;
    else die(`unknown argument ${argv[i]}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfgFile = join(args.repo, CONFIG_PATH);
  if (!existsSync(cfgFile)) {
    die(`no ${CONFIG_PATH} in ${args.repo} — run /seam:init first; the checker is generated from`
      + ` the config, and there is nothing to generate from`);
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
    .replaceAll("{{CHECKER_PATH}}", outPath);

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
