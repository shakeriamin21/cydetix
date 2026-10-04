import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { writeContentAddressedSubject } from "./lib/immutable-evidence-subject.mjs";

import {
  completeEvidence,
  establishEvidenceSource,
  fileIdentity,
} from "./lib/source-bound-evidence.mjs";

function take(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || process.argv[index + 1] === undefined)
    throw new Error(`Missing required ${name} argument.`);
  return process.argv[index + 1];
}

const separator = process.argv.indexOf("--");
if (separator === -1 || process.argv[separator + 1] === undefined)
  throw new Error("A direct command is required after --.");
const evidenceType = take("--type");
const output = path.resolve(take("--output"));
const subjectArgument = process.argv.includes("--subject") ? take("--subject") : undefined;
const captureArgument = process.argv.includes("--capture-stdout")
  ? take("--capture-stdout")
  : undefined;
const addressedArgument = process.argv.includes("--capture-stdout-addressed")
  ? take("--capture-stdout-addressed")
  : undefined;
if (
  [subjectArgument, captureArgument, addressedArgument].filter((value) => value !== undefined)
    .length > 1
)
  throw new Error("Use only one subject or stdout capture mode.");

const source = await establishEvidenceSource();
const subjectPath = subjectArgument ?? captureArgument;
await rm(output, { force: true });
if (subjectPath !== undefined) await rm(path.resolve(subjectPath), { force: true });

const requestedExecutable = process.argv[separator + 1];
const requestedArguments = process.argv.slice(separator + 2);
const npmOnWindows = process.platform === "win32" && requestedExecutable === "npm";
const executable = npmOnWindows ? process.execPath : requestedExecutable;
const arguments_ = npmOnWindows
  ? [process.env.npm_execpath, ...requestedArguments]
  : requestedArguments;
if (arguments_.some((value) => value === undefined))
  throw new Error("npm_execpath is required to run npm evidence commands on Windows.");
const result = spawnSync(executable, arguments_, {
  cwd: source.root,
  encoding: "utf8",
  shell: false,
  windowsHide: true,
  timeout: Number(process.env.CYDETIX_EVIDENCE_TIMEOUT_MS ?? 900_000),
  maxBuffer: 20_000_000,
  env: { ...process.env, CYDETIX_EXPECTED_SOURCE_SHA: source.sourceCommit },
});
if (captureArgument !== undefined)
  await writeFile(path.resolve(captureArgument), result.stdout ?? "", "utf8");
const passed = result.error === undefined && result.status === 0;
let addressedPath;
if (addressedArgument !== undefined && passed) {
  JSON.parse(result.stdout);
  addressedPath = await writeContentAddressedSubject(addressedArgument, result.stdout);
}

let subject;
if (addressedPath !== undefined) {
  subject = await fileIdentity(addressedPath);
} else if (subjectPath !== undefined) {
  try {
    subject = await fileIdentity(path.resolve(subjectPath));
  } catch {
    subject = {
      kind: "REPOSITORY",
      identity: `${source.repository}@${source.sourceCommit}`,
    };
  }
}
await completeEvidence(
  source,
  {
    evidenceType,
    producer: { name: "run-source-bound-command", version: "1.0.0" },
    result: passed ? "PASS" : "FAIL",
    subject,
    details: {
      executable: path.basename(executable),
      arguments: requestedArguments,
      exitCode: result.status,
      errorCode: result.error?.code ?? null,
    },
  },
  output,
);
if (!passed) {
  const diagnostic = String(result.stderr ?? "")
    .trim()
    .slice(-2_000);
  throw new Error(
    `Source-bound command failed: ${path.basename(executable)}; exit=${String(result.status)}; ${diagnostic}`,
  );
}
if (subjectArgument !== undefined)
  JSON.parse(await readFile(path.resolve(subjectArgument), "utf8"));
process.stdout.write(`Recorded ${evidenceType} PASS for ${source.sourceCommit}.\n`);
