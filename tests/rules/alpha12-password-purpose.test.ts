import { describe, expect, it } from "vitest";
import { parseSource, isParseFailure } from "../../src/ast-analysis/parser.js";
import { passwordHashRule } from "../../src/rules/password-hash.js";
import type { SourceFile } from "../../src/repository-discovery/traverse.js";

describe("password hash purpose is independent of observed hashing", () => {
  it.each([
    [
      "python",
      "import hashlib\ndef lookup(password):\n    digest = hashlib.sha1(password.encode()).hexdigest()\n    return digest[:5]\n",
    ],
    [
      "python",
      "import hashlib\ndef store(password):\n    password_hash = hashlib.md5(password.encode()).hexdigest()\n    database.save(password_hash)\n",
    ],
    [
      "typescript",
      'import crypto from "node:crypto"; const hash = crypto.createHash("sha1").update(password).digest("hex");',
    ],
  ] as const)("does not invent storage proof for %s hashing", (language, text) => {
    const file: SourceFile = {
      relativePath: language === "python" ? "purpose.py" : "purpose.ts",
      absolutePath: "unused",
      language,
      text,
      size: Buffer.byteLength(text),
    };
    const parsed = parseSource(file);
    if (!parsed || isParseFailure(parsed)) throw new Error("Expected parsed source");
    const finding = passwordHashRule.analyze({ file, parsed })[0];
    expect(finding).toMatchObject({
      ruleId: "AS-PASSWORD-001",
      ruleVersion: "1.0.1",
      confidence: "high",
      proofState: "UNKNOWN",
      reachability: "unknown",
      analysisCompleteness: "PARTIAL",
      autofix: "ARCHITECTURAL",
    });
    expect(
      finding?.evidence.some((item) =>
        item.message.includes("persistence as a credential verifier is not established"),
      ),
    ).toBe(true);
  });
});
