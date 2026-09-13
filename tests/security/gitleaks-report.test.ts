import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface ReviewedFinding {
  fingerprint: string;
  ruleId: string;
  description: string;
  file: string;
  commit: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  matchDigest: string;
}

interface ReviewManifest {
  reviewedFindings: ReviewedFinding[];
}

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const validator = path.join(repositoryRoot, "scripts", "validate-gitleaks-report.mjs");
const manifest = JSON.parse(
  readFileSync(path.join(repositoryRoot, "validation", "gitleaks-reviewed-findings.json"), "utf8"),
) as ReviewManifest;
const supplemental = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "validation", "alpha12", "gitleaks-reviewed-findings.json"),
    "utf8",
  ),
) as ReviewManifest;

function redactedMatchFor(review: ReviewedFinding) {
  if (review.file === "validation/alpha12/self-scan.sarif.json")
    return review.startLine === 6736 ? 'authproof:REDACTED"' : 'authop:REDACTED"';
  if (review.file === "docs/security/ALPHA8_EXTERNAL_CORPUS_VALIDATION.md")
    return "FastAPI annotations. Commit:\n`REDACTED`";
  if (review.file === "fixtures/phase4/secret-exposed/config.ts") return 'credential = "REDACTED"';
  if (review.file === "tests/remediation/safe-fix.test.ts") return 'SECRET", "REDACTED"';
  if (review.file === "dist/remediation/model.d.ts") return 'REDACTED": "REDACTED"';
  if (review.startLine === 428) return 'secret = "REDACTED"';
  if (review.commit.startsWith("068f87"))
    return ["INVARIANT", 'SEC_TEST_AWS_SECRET: "REDACTED"'].join("");
  return 'CYDETIX_TEST_AWS_SECRET: "REDACTED"';
}

function asGitleaksFinding(review: ReviewedFinding) {
  return {
    RuleID: review.ruleId,
    Description: review.description,
    File: review.file,
    Commit: review.commit,
    StartLine: review.startLine,
    EndLine: review.endLine,
    StartColumn: review.startColumn,
    EndColumn: review.endColumn,
    Fingerprint: review.fingerprint,
    Match: redactedMatchFor(review),
    Secret: "REDACTED",
    SymlinkFile: "",
    Tags: [],
  };
}

function validateSource(source: string) {
  const temporary = mkdtempSync(path.join(tmpdir(), "cydetix-gitleaks-"));
  const reportPath = path.join(temporary, "report.json");
  writeFileSync(reportPath, source, "utf8");
  try {
    return spawnSync(process.execPath, [validator, reportPath, "history"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function validate(report: unknown) {
  return validateSource(JSON.stringify(report));
}

describe("Gitleaks reviewed-finding validator", () => {
  const exactFindings = [...manifest.reviewedFindings, ...supplemental.reviewedFindings].map(
    asGitleaksFinding,
  );
  function findingAt(index: number) {
    const finding = exactFindings[index];
    if (finding === undefined) throw new Error(`Missing reviewed finding ${index}.`);
    return finding;
  }
  const reviewedDocumentation = findingAt(0);
  const reviewedFixture = findingAt(1);

  it("accepts 14 immutable historical and nine supplemental findings only with exact reviewed evidence", () => {
    expect(manifest.reviewedFindings).toHaveLength(14);
    expect(supplemental.reviewedFindings).toHaveLength(9);
    expect(exactFindings).toHaveLength(23);
    const result = validate(exactFindings);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: "PASS",
      findings: 23,
      reviewedFindings: 23,
      unreviewedFindings: 0,
      classifications: {
        DOCUMENTATION_EVIDENCE: 10,
        FALSE_POSITIVE_PATTERN: 5,
        INTENTIONAL_TEST_FIXTURE: 8,
      },
    });
  });

  it("rejects altered supplemental evidence and omitted supplemental history", () => {
    expect(
      validate(
        exactFindings.map((finding, index) =>
          index === 14 ? { ...finding, Match: 'authop:ALTERED"' } : finding,
        ),
      ).status,
    ).not.toBe(0);
    expect(validate(exactFindings.slice(0, 14)).status).not.toBe(0);
  });

  it("rejects an exact reviewed subset as incomplete history", () => {
    const result = validate([reviewedDocumentation]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing reviewed historical findings");
  });

  it("rejects a new finding in an otherwise reviewed file", () => {
    const finding = {
      ...exactFindings[0],
      Fingerprint: `1111111111111111111111111111111111111111:${reviewedDocumentation.File}:generic-api-key:44`,
      Commit: "1111111111111111111111111111111111111111",
      StartLine: 44,
      EndLine: 44,
    };
    expect(validate([finding]).status).not.toBe(0);
  });

  it("rejects an unrelated finding under docs/security", () => {
    const finding = {
      ...exactFindings[0],
      File: "docs/security/UNREVIEWED.md",
      Fingerprint:
        "2222222222222222222222222222222222222222:docs/security/UNREVIEWED.md:generic-api-key:1",
      Commit: "2222222222222222222222222222222222222222",
      StartLine: 1,
      EndLine: 1,
    };
    expect(validate([finding]).status).not.toBe(0);
  });

  it("does not treat a reviewed path as approval for another fingerprint", () => {
    const finding = {
      ...reviewedFixture,
      Fingerprint: reviewedFixture.Fingerprint.replace(/^[0-9a-f]/u, "f"),
    };
    expect(validate([finding]).status).not.toBe(0);
  });

  it.each([
    ["fingerprint", { Fingerprint: "f".repeat(40) }],
    ["redacted match", { Match: 'credential = "REDACTED-ALTERED"' }],
  ])("rejects altered reviewed %s evidence", (_name, alteration) => {
    expect(validate([{ ...reviewedFixture, ...alteration }]).status).not.toBe(0);
  });

  it.each([
    ["rule", { RuleID: "unrelated-rule" }],
    ["description", { Description: "Different detector description" }],
    ["file", { File: "fixtures/phase4/other.ts" }],
    ["commit", { Commit: "3".repeat(40) }],
    ["start line", { StartLine: 3 }],
    ["end line", { EndLine: 3 }],
    ["start column", { StartColumn: 3 }],
    ["end column", { EndColumn: 3 }],
  ])("rejects a changed bound %s", (_name, alteration) => {
    expect(validate([{ ...reviewedFixture, ...alteration }]).status).not.toBe(0);
  });

  it("rejects duplicate report fingerprints", () => {
    expect(validate([reviewedFixture, reviewedFixture]).status).not.toBe(0);
  });

  it.each([
    "fixtures\\phase4\\secret-exposed\\config.ts",
    "/repo/fixtures/phase4/secret-exposed/config.ts",
    "C:/repo/fixtures/phase4/secret-exposed/config.ts",
    "fixtures//phase4/secret-exposed/config.ts",
    "fixtures/../secret-exposed/config.ts",
  ])("rejects non-canonical history path %s", (File) => {
    expect(validate([{ ...reviewedFixture, File }]).status).not.toBe(0);
  });

  it("rejects control characters without reflecting them in diagnostics", () => {
    const injectedPath = "docs/security/unreviewed.md\n::error::injected";
    const result = validate([{ ...reviewedDocumentation, File: injectedPath }]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain(injectedPath);
    expect(result.stderr).not.toContain("::error::injected");
  });

  it("rejects credential material even when other reviewed fields match", () => {
    const credential = ["gh", "p_", "a".repeat(36)].join("");
    const finding = { ...reviewedDocumentation, Secret: credential };
    expect(validate([finding]).status).not.toBe(0);
  });

  it("rejects the empty report produced when Git scans no commits", () => {
    const result = validate([]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("verify that Git scanned the full reachable history");
  });

  it("rejects a scan missing only one reviewed historical finding", () => {
    const result = validate(exactFindings.slice(1));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing reviewed historical findings");
  });

  it.each([
    {},
    [null],
    [{ File: "docs/security/UNREVIEWED.md" }],
    [{ ...reviewedDocumentation, StartLine: "42" }],
    [{ ...reviewedDocumentation, EndColumn: 0 }],
  ])("fails closed for malformed report data %#", (report) => {
    expect(validate(report).status).not.toBe(0);
  });

  it("fails closed for malformed JSON", () => {
    const canary = ["credential", "-material", "-must-not-leak"].join("");
    const result = validateSource(`[{"value":"${canary}"} trailing`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain(canary);
  });
});
