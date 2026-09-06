import { parse, type ParseResult } from "@babel/parser";
import { parser as pythonParser } from "@lezer/python";
import type { Tree } from "@lezer/common";

import type { SourceFile } from "../repository-discovery/traverse.js";

export type ParsedSource =
  | { readonly language: "javascript" | "typescript"; readonly ast: ParseResult }
  | { readonly language: "python"; readonly ast: Tree };

export interface ParseFailure {
  readonly path: string;
  readonly message: string;
}

export function parseSource(file: SourceFile): ParsedSource | ParseFailure | undefined {
  if (file.language === "javascript" || file.language === "typescript") {
    try {
      return {
        language: file.language,
        ast: parse(file.text, {
          sourceType: "unambiguous",
          sourceFilename: file.relativePath,
          errorRecovery: false,
          plugins: ["jsx", "typescript", "decorators-legacy"],
        }),
      };
    } catch (error) {
      return {
        path: file.relativePath,
        message: `JavaScript/TypeScript parse failed: ${String(error)}`,
      };
    }
  }
  if (file.language === "python") {
    const ast = pythonParser.parse(file.text);
    const cursor = ast.cursor();
    do {
      if (cursor.type.isError) {
        return {
          path: file.relativePath,
          message: "Python parse failed: syntax tree contains errors",
        };
      }
    } while (cursor.next());
    return { language: "python", ast };
  }
  return undefined;
}

export function isParseFailure(value: ParsedSource | ParseFailure): value is ParseFailure {
  return "message" in value;
}
