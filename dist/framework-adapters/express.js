function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function provesAuthentication(symbolSource, requestName) {
    const request = escapeRegExp(requestName);
    const verifiesToken = /\b(?:jwt|jsonwebtoken)\.verify\s*\(/.test(symbolSource) ||
        /\b(?:jwtVerify|verifyToken)\s*\(/.test(symbolSource);
    const readsCredential = new RegExp(`\\b${request}(?:\\?\\.)?\\.(?:headers(?:\\?\\.)?\\.?authorization|get\\(\\s*["']authorization["']\\s*\\))`, "i").test(symbolSource);
    const establishesContext = new RegExp(`\\b${request}(?:\\?\\.)?\\.(?:auth|user)\\s*=`).test(symbolSource);
    return verifiesToken && readsCredential && establishesContext;
}
export function analyzeExpressAuthentication(ir, files) {
    const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
    const symbolsById = new Map(ir.symbols.map((symbol) => [symbol.id, symbol]));
    const proofs = [];
    for (const route of ir.routes) {
        if (route.handlerSymbolId === undefined)
            continue;
        const handler = symbolsById.get(route.handlerSymbolId);
        if (handler === undefined)
            continue;
        for (const middlewareId of route.middlewareSymbolIds) {
            const middleware = symbolsById.get(middlewareId);
            if (middleware === undefined)
                continue;
            const file = filesByPath.get(middleware.location.path);
            const requestName = middleware.parameterNames[0];
            if (file === undefined || requestName === undefined)
                continue;
            const source = file.text.slice(middleware.location.start.offset, middleware.location.end.offset);
            if (!provesAuthentication(source, requestName))
                continue;
            proofs.push({
                routeId: route.id,
                handlerSymbolId: handler.id,
                middlewareSymbolId: middleware.id,
                requestParameterName: handler.parameterNames[0] ?? "req",
                location: middleware.location,
                message: `${middleware.name} verifies a request credential and establishes authenticated request context before ${handler.name}.`,
            });
        }
    }
    return proofs.sort((left, right) => `${left.routeId}:${left.middlewareSymbolId}`.localeCompare(`${right.routeId}:${right.middlewareSymbolId}`));
}
//# sourceMappingURL=express.js.map