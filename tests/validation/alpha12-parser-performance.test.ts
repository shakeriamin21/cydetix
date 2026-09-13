import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sourcePoint } from "../../src/ast-analysis/source-location.js";
import { scanRepository } from "../../src/core/engine.js";
import { normalizeScanForDeterminism } from "../../src/validation/determinism.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("corpus parser and coordinate regressions", () => {
  it("preserves UTF-16 offsets and LF line/column semantics at every boundary", () => {
    for (const text of ["", "a\nb\n", "a\r\nb\rc", "😀\nمرحبا\nZ", "\n".repeat(5000)]) {
      const file = { text };
      for (let offset = -1; offset <= text.length + 1; offset++) {
        const safe = Math.max(0, Math.min(offset, text.length));
        const lines = text.slice(0, safe).split("\n");
        expect(sourcePoint(file, offset)).toEqual({
          line: lines.length,
          column: lines.at(-1)?.length ?? 0,
          offset: safe,
        });
      }
    }
  });

  it("keeps Babel scope failures local and retains supported findings in other files", async () => {
    const root = await temporaryDirectory("cydetix-a12-scope-");
    await writeFile(
      path.join(root, "unsupported.tsx"),
      'import { ResetPassword } from "./contract"; const ResetPassword = () => null; export { ResetPassword };\n',
    );
    await writeFile(
      path.join(root, "route.ts"),
      'import express from "express"; const app = express(); app.get("/go", (req, res) => res.redirect(req.query.next));\n',
    );
    const first = await scanRepository({ path: root });
    const second = await scanRepository({ path: root });
    expect(first.reproducibility?.analysisCompleteness).toBe("PARTIAL");
    expect(
      first.coverage.limitations.some(
        (item) => item.includes("unsupported.tsx") && item.includes("scope analysis failed"),
      ),
    ).toBe(true);
    expect(
      first.findings.some(
        (item) => item.ruleId === "AS-REDIRECT-001" && item.location.path === "route.ts",
      ),
    ).toBe(true);
    expect(first.findings.some((item) => item.location.path === "unsupported.tsx")).toBe(false);
    expect(normalizeScanForDeterminism(first)).toEqual(normalizeScanForDeterminism(second));
  });
});
