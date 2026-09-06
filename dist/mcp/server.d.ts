type JsonRpcId = string | number | null;
interface JsonRpcRequest {
    readonly jsonrpc: "2.0";
    readonly id?: JsonRpcId;
    readonly method: string;
    readonly params?: unknown;
}
interface JsonRpcResponse {
    readonly jsonrpc: "2.0";
    readonly id: JsonRpcId;
    readonly result?: unknown;
    readonly error?: {
        readonly code: number;
        readonly message: string;
        readonly data?: unknown;
    };
}
interface ToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Record<string, unknown>;
    readonly annotations: {
        readonly readOnlyHint: boolean;
        readonly destructiveHint: boolean;
        readonly idempotentHint: boolean;
        readonly openWorldHint: boolean;
    };
}
export declare const CYDETIX_MCP_TOOLS: readonly ToolDefinition[];
export declare function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined>;
export declare function runMcpServer(): Promise<void>;
export {};
//# sourceMappingURL=server.d.ts.map