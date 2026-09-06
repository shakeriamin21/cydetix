import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { runRemediation } from "../../src/remediation/fix.js";

const temporaryDirectories: string[] = [];

async function temporary(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cydetix-session-variation-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("AS-SESSION-001 remediation variations", () => {
  it("applies a bounded idempotent fix across comments and property ordering", async () => {
    const root = await temporary();
    const target = path.join(root, "session.ts");
    await writeFile(
      target,
      [
        'import session from "express-session";',
        "declare const app: any;",
        "// preserve this review note",
        'app.use(session({ cookie: { sameSite: "lax", secure: true, httpOnly: false } }));',
        "",
      ].join("\n"),
      "utf8",
    );
    const before = await scanRepository({ path: root });
    const finding = before.findings.find(
      (candidate) => candidate.ruleId === "AS-SESSION-001" && candidate.autofix === "SAFE",
    );
    expect(finding).toBeDefined();
    if (finding === undefined) throw new Error("Expected SAFE session finding.");
    const applied = await runRemediation({
      path: root,
      finding: finding.fingerprint,
      applySafe: true,
    });
    expect(applied.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    const after = await readFile(target, "utf8");
    expect(after).toContain("// preserve this review note");
    expect(after).toContain("httpOnly: true");
    const second = await runRemediation({
      path: root,
      finding: finding.fingerprint,
      applySafe: true,
    });
    expect(second.transactions).toEqual([]);
    expect(await readFile(target, "utf8")).toBe(after);
  });

  it("does not transform secure or unsupported wrapper configuration", async () => {
    const root = await temporary();
    const target = path.join(root, "session.ts");
    const source = [
      'import session from "express-session";',
      "declare const app: any;",
      "const cookie = { httpOnly: true, secure: true };",
      "const options = { cookie };",
      "app.use(session(options));",
      "",
    ].join("\n");
    await writeFile(target, source, "utf8");
    const report = await runRemediation({ path: root, applySafe: true });
    expect(report.transactions).toEqual([]);
    expect(await readFile(target, "utf8")).toBe(source);
  });

  it("keeps the finding fingerprint stable across irrelevant Python comments and blank lines", async () => {
    const firstRoot = await temporary();
    const secondRoot = await temporary();
    await writeFile(
      path.join(firstRoot, "app.py"),
      'app.config["SESSION_COOKIE_HTTPONLY"] = False\n',
      "utf8",
    );
    await writeFile(
      path.join(secondRoot, "app.py"),
      '# unrelated explanation\n\napp.config["SESSION_COOKIE_HTTPONLY"] = False\n',
      "utf8",
    );
    const first = await scanRepository({ path: firstRoot });
    const second = await scanRepository({ path: secondRoot });
    expect(first.findings[0]?.fingerprint).toBe(second.findings[0]?.fingerprint);
  });
});
