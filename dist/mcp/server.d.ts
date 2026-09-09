import { type RepositoryBoundary } from "../repository-discovery/boundary.js";
type JsonRpcId = string | number | null;
export interface McpServerOptions {
    readonly projectRoot?: string;
    readonly requiredVersion?: string;
}
export interface McpServerContext {
    readonly projectBoundary: RepositoryBoundary;
    readonly requiredVersion?: string;
}
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
export declare function handleMcpRequest(request: JsonRpcRequest, context: McpServerContext): Promise<JsonRpcResponse | undefined>;
export declare function assertRequiredVersion(requiredVersion: string | undefined): void;
export declare function createMcpServerContext(options?: McpServerOptions): Promise<McpServerContext>;
export declare function runMcpServer(options?: McpServerOptions): Promise<void>;
export {};
//# sourceMappingURL=server.d.ts.map