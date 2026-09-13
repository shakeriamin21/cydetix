import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { parser as pythonParser } from "@lezer/python";
export function parseSource(file) {
    if (file.language === "javascript" || file.language === "typescript") {
        let stage = "parse";
        try {
            const ast = parse(file.text, {
                sourceType: "unambiguous",
                sourceFilename: file.relativePath,
                errorRecovery: false,
                plugins: ["jsx", "typescript", "decorators-legacy"],
            });
            // Babel may accept TypeScript type/value declarations that its scope builder cannot model.
            // Admit only trees usable by all downstream semantic traversals; failures stay file-local.
            stage = "scope analysis";
            traverse(ast, {});
            return {
                language: file.language,
                ast,
            };
        }
        catch (error) {
            return {
                path: file.relativePath,
                message: `JavaScript/TypeScript ${stage} failed: ${String(error)}`,
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
export function isParseFailure(value) {
    return "message" in value;
}
//# sourceMappingURL=parser.js.map