import { describe, expect, it } from "vitest";
import { parseSource, isParseFailure } from "../../src/ast-analysis/parser.js";
import {
  analyzeApplicationDataflow,
  DATAFLOW_RESOURCE_BOUNDS,
} from "../../src/dataflow-analysis/bounded-engine.js";
import type { SourceFile } from "../../src/repository-discovery/traverse.js";

function analyze(text: string, language: "typescript" | "python") {
  const file: SourceFile = {
    relativePath: language === "python" ? "bound.py" : "bound.ts",
    absolutePath: "unused",
    language,
    text,
    size: Buffer.byteLength(text),
  };
  const parsed = parseSource(file);
  if (!parsed || isParseFailure(parsed)) throw new Error("Resource fixture must parse");
  return analyzeApplicationDataflow([file], new Map([[file.relativePath, parsed]]));
}

describe("alpha.12 fail-closed propagation bounds", () => {
  it("enforces the fact cap before exhausting the file AST budget", () => {
    const declarations = Array.from(
      { length: 10_005 },
      (_, index) => `const v${index + 1}=v0;`,
    ).join("\n");
    const result = analyze(
      `import express from 'express';const app=express();app.get('/x',(req,res)=>{const v0=req.query.x;${declarations}res.redirect(v1);});`,
      "typescript",
    );
    expect(result.analysis.metrics.astNodesVisited).toBeLessThan(50_000);
    expect(result.analysis.metrics.factsCreated).toBe(10_000);
    expect(result.analysis.completeness).toBe("TRUNCATED");
    expect(result.candidates).toEqual([]);
  });

  it("enforces the repository AST cap across individually bounded files", () => {
    const text = Array.from({ length: 10_100 }, (_, index) => `const v${index}=${index};`).join(
      "\n",
    );
    const files: SourceFile[] = Array.from({ length: 5 }, (_, index) => ({
      relativePath: `m${index}.ts`,
      absolutePath: "unused",
      language: "typescript",
      text,
      size: Buffer.byteLength(text),
    }));
    const parsed = new Map(
      files.map((file) => {
        const result = parseSource(file);
        if (!result || isParseFailure(result)) throw new Error("Expected bounded syntax");
        return [file.relativePath, result];
      }),
    );
    const result = analyzeApplicationDataflow(files, parsed);
    expect(result.analysis.metrics.filesAnalyzed).toBe(4);
    expect(result.analysis.metrics.astNodesVisited).toBeGreaterThan(200_000);
    expect(result.analysis.completeness).toBe("TRUNCATED");
  });
  it("retains the established numeric limits", () => {
    expect(DATAFLOW_RESOURCE_BOUNDS).toEqual({
      maxAstNodesPerFile: 50_000,
      maxRepositoryAstNodes: 200_000,
      maxFacts: 10_000,
      maxIterations: 8,
      maxEvidenceSteps: 16,
    });
  });

  it.each(["typescript", "python"] as const)(
    "reports %s iteration exhaustion as incomplete",
    (language) => {
      const assignments = Array.from(
        { length: 12 },
        (_, index) => `v${12 - index} = v${11 - index}`,
      );
      const text =
        language === "typescript"
          ? `import express from 'express'; const app=express(); ${Array.from({ length: 12 }, (_, i) => `function f${i}(x){return f${i + 1}(x);}`).join("")} function f12(x){return x;} app.get('/x', (req,res)=>res.redirect(f0(req.query.x)));`
          : `from flask import Flask, request, redirect\napp=Flask(__name__)\n@app.route('/x')\ndef route():\n${assignments.map((line) => `    ${line}`).join("\n")}\n    v0=request.args['x']\n    return redirect(v12)\n`;
      const result = analyze(text, language);
      expect(result.analysis.metrics.iterations).toBe(8);
      expect(result.analysis.completeness).toBe("TRUNCATED");
      expect(result.candidates).toEqual([]);
    },
  );

  it.each(["typescript", "python"] as const)(
    "does not present an abbreviated %s evidence chain as complete",
    (language) => {
      const assignments = Array.from({ length: 22 }, (_, i) => `v${i + 1} = v${i}`);
      const text =
        language === "typescript"
          ? `import express from 'express'; const app=express(); app.get('/x', (req,res)=>{const v0=req.query.x;${assignments.map((line) => `const ${line};`).join("")}res.redirect(v22);});`
          : `from flask import Flask, request, redirect\napp=Flask(__name__)\n@app.route('/x')\ndef route():\n    v0=request.args['x']\n${assignments.map((line) => `    ${line}`).join("\n")}\n    return redirect(v22)\n`;
      const result = analyze(text, language);
      expect(result.analysis.completeness).toBe("TRUNCATED");
      expect(result.candidates).toEqual([]);
    },
  );
});
