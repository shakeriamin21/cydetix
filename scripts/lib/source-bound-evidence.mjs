/* global process */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sourceBoundEvidenceEnvelopeSchema } from "../../dist/validation/source-bound-evidence.js";

const defaultRoot = path.resolve(".");

function runGit(root, arguments_) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...arguments_],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1_000_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
    },
  );
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`Evidence producer could not establish Git identity: ${arguments_[0]}.`);
  return result.stdout.trim();
}

function normalizeRepository(value) {
  const normalized = String(value)
    .replace(/^git\+https:\/\/github\.com\//u, "")
    .replace(/^https:\/\/github\.com\//u, "")
    .replace(/^git@github\.com:/u, "")
    .replace(/\.git$/u, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(normalized))
    throw new Error("Package repository identity is not a canonical GitHub owner/name.");
  return normalized;
}

export async function establishEvidenceSource(
  expectedSourceCommit = process.env.CYDETIX_EXPECTED_SOURCE_SHA,
  repositoryRoot = defaultRoot,
) {
  const root = path.resolve(repositoryRoot);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const repository = normalizeRepository(packageJson.repository?.url);
  const sourceCommit = runGit(root, ["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error("Git HEAD is not a full commit SHA.");
  if (expectedSourceCommit !== undefined && sourceCommit !== expectedSourceCommit)
    throw new Error(
      `Evidence producer HEAD mismatch: expected ${expectedSourceCommit}, observed ${sourceCommit}.`,
    );
  const trackedStatus = runGit(root, ["status", "--porcelain", "--untracked-files=no"]);
  if (trackedStatus !== "")
    throw new Error("Evidence producer requires a clean tracked source tree and index.");
  return { root, repository, sourceCommit };
}

export async function fileIdentity(
  file,
  kind = "FILE",
  identity = undefined,
  repositoryRoot = defaultRoot,
) {
  const bytes = await readFile(file);
  return {
    kind,
    identity:
      identity ??
      path.relative(path.resolve(repositoryRoot), path.resolve(file)).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

export async function writeEvidenceAtomically(file, value) {
  const destination = path.resolve(file);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

export async function completeEvidence(source, input, outputPath) {
  const after = await establishEvidenceSource(source.sourceCommit);
  if (after.repository !== source.repository)
    throw new Error("Evidence repository identity changed while the producer was running.");
  const envelope = sourceBoundEvidenceEnvelopeSchema.parse({
    evidenceFormatVersion: "1.0.0",
    evidenceType: input.evidenceType,
    repository: source.repository,
    sourceCommit: source.sourceCommit,
    producer: input.producer,
    result: input.result,
    subject: input.subject ?? {
      kind: "REPOSITORY",
      identity: `${source.repository}@${source.sourceCommit}`,
    },
    details: input.details ?? {},
  });
  await writeEvidenceAtomically(outputPath, envelope);
  return envelope;
}

export async function evidenceReference(file, required = true) {
  const bytes = await readFile(file);
  const parsed = sourceBoundEvidenceEnvelopeSchema.parse(JSON.parse(bytes.toString("utf8")));
  return {
    evidenceType: parsed.evidenceType,
    path: path.relative(defaultRoot, path.resolve(file)).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    required,
  };
}
