import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  requireReadyEvidence,
  sourceBoundEvidenceEnvelopeSchema,
  validateSourceBoundEvidenceSet,
} from "../../src/validation/source-bound-evidence.js";

const repository = "shakeriamin21/cydetix";
const s1 = "b31f1fddc2ea4aeb7726d1cfeca2e769ca68460d";
const s2 = "b".repeat(40);

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    evidenceFormatVersion: "1.0.0",
    evidenceType: "complete-test-suite",
    repository,
    sourceCommit: s2,
    producer: { name: "release-tests", version: "1.0.0" },
    result: "PASS",
    subject: {
      kind: "FILE",
      identity: ".cydetix/evidence/tests.raw.json",
      sha256: "c".repeat(64),
      bytes: 42,
    },
    details: { filesPassed: 1, testsPassed: 1 },
    ...overrides,
  };
}

function fixture(records: unknown[], referenceOverrides: Record<string, unknown> = {}) {
  const blobs = records.map((record, index) => {
    const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
    return { path: `.cydetix/evidence/${index}.json`, bytes };
  });
  const first = blobs[0];
  if (first === undefined) throw new Error("fixture requires a record");
  return {
    blobs,
    index: {
      evidenceFormatVersion: "1.0.0",
      repository,
      sourceCommit: s2,
      evidence: [
        {
          evidenceType: "complete-test-suite",
          path: first.path,
          sha256: createHash("sha256").update(first.bytes).digest("hex"),
          required: true,
          ...referenceOverrides,
        },
      ],
    },
  };
}

describe("source-bound release evidence", () => {
  it("accepts a complete explicitly referenced evidence set deterministically", () => {
    const valid = fixture([envelope()]);
    const first = validateSourceBoundEvidenceSet(valid.index, valid.blobs, {
      repository,
      sourceCommit: s2,
    });
    const second = validateSourceBoundEvidenceSet(valid.index, valid.blobs, {
      repository,
      sourceCommit: s2,
    });
    requireReadyEvidence(first, ["complete-test-suite"]);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it("rejects evidence with a missing source binding", () => {
    const record: Record<string, unknown> = envelope();
    delete record.sourceCommit;
    const value = fixture([record]);
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow();
  });

  it("rejects the explicit S1 replay attack while evaluating S2", () => {
    const value = fixture([envelope({ sourceCommit: s1 })]);
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow("Evidence source mismatch");
  });

  it("rejects correct-type evidence from another repository", () => {
    const value = fixture([envelope({ repository: "attacker/cydetix" })]);
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow("Evidence repository mismatch");
  });

  it("rejects a malformed source SHA", () => {
    const value = fixture([envelope({ sourceCommit: "not-a-sha" })]);
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow();
  });

  it("rejects a missing mandatory evidence file", () => {
    const value = fixture([envelope()]);
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, [], { repository, sourceCommit: s2 }),
    ).toThrow("Missing required evidence");
  });

  it("rejects an evidence-file hash mismatch", () => {
    const value = fixture([envelope()], { sha256: "d".repeat(64) });
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow("Evidence hash mismatch");
  });

  it("rejects corrupted JSON", () => {
    const value = fixture([envelope()]);
    const bytes = Buffer.from("{broken\n");
    const blob = value.blobs[0];
    const reference = value.index.evidence[0];
    if (blob === undefined || reference === undefined) throw new Error("fixture is incomplete");
    value.blobs[0] = { path: blob.path, bytes };
    reference.sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow("not valid JSON");
  });

  it("rejects duplicate conflicting evidence", () => {
    const value = fixture([envelope()]);
    const reference = value.index.evidence[0];
    if (reference === undefined) throw new Error("fixture is incomplete");
    value.index.evidence.push({ ...reference, path: ".cydetix/evidence/other.json" });
    expect(() =>
      validateSourceBoundEvidenceSet(value.index, value.blobs, { repository, sourceCommit: s2 }),
    ).toThrow();
  });

  it("ignores an ambient unreferenced PASS", () => {
    const value = fixture([envelope()]);
    const ambient = Buffer.from(
      `${JSON.stringify(envelope({ evidenceType: "openssf-scorecard" }))}\n`,
    );
    value.blobs.push({ path: ".cydetix/evidence/ambient.json", bytes: ambient });
    const accepted = validateSourceBoundEvidenceSet(value.index, value.blobs, {
      repository,
      sourceCommit: s2,
    });
    expect(accepted.has("openssf-scorecard")).toBe(false);
  });

  it("rejects an aggregate child bound to S1", () => {
    const value = fixture([
      envelope({
        details: {
          children: [
            { evidenceType: "hosted-sandbox", repository, sourceCommit: s1, result: "PASS" },
          ],
        },
      }),
    ]);
    const aggregateBlob = value.blobs[0];
    if (aggregateBlob === undefined) throw new Error("fixture is incomplete");
    const parsed = sourceBoundEvidenceEnvelopeSchema.parse(
      JSON.parse(Buffer.from(aggregateBlob.bytes).toString("utf8")),
    );
    const child = (parsed.details.children as Array<Record<string, unknown>>)[0];
    expect(child?.sourceCommit).not.toBe(s2);
    // Aggregate children are not trusted as standalone evidence; the required child must
    // have its own explicitly referenced envelope.
    const accepted = validateSourceBoundEvidenceSet(value.index, value.blobs, {
      repository,
      sourceCommit: s2,
    });
    expect(() => requireReadyEvidence(accepted, ["hosted-sandbox"])).toThrow(
      "Missing required evidence hosted-sandbox",
    );
  });

  it.each(["NOT_CHECKED", "SKIPPED_CAPABILITY", "FAIL"])(
    "keeps a bound mandatory %s record non-ready",
    (result) => {
      const value = fixture([envelope({ result })]);
      const accepted = validateSourceBoundEvidenceSet(value.index, value.blobs, {
        repository,
        sourceCommit: s2,
      });
      expect(() => requireReadyEvidence(accepted, ["complete-test-suite"])).toThrow("not PASS");
    },
  );
});
