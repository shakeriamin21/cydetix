import { parse } from "@babel/parser";
import { parser as pythonParser } from "@lezer/python";
export function parseSource(file) {
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
        }
        catch (error) {
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
export function isParseFailure(value) {
    return "message" in value;
}
//# sourceMappingURL=parser.js.map