import { type ParseResult } from "@babel/parser";
import type { Tree } from "@lezer/common";
import type { SourceFile } from "../repository-discovery/traverse.js";
export type ParsedSource = {
    readonly language: "javascript" | "typescript";
    readonly ast: ParseResult;
} | {
    readonly language: "python";
    readonly ast: Tree;
};
export interface ParseFailure {
    readonly path: string;
    readonly message: string;
}
export declare function parseSource(file: SourceFile): ParsedSource | ParseFailure | undefined;
export declare function isParseFailure(value: ParsedSource | ParseFailure): value is ParseFailure;
//# sourceMappingURL=parser.d.ts.map