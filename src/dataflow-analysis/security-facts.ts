import type { ParsedSource } from "../ast-analysis/parser.js";
import { analyzeExpressAuthentication } from "../framework-adapters/express.js";
import { analyzePrismaOperations } from "../framework-adapters/prisma.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import {
  securityIrId,
  securityIrSchema,
  type IdentityFact,
  type IdentityTrust,
  type IrCall,
  type IrEdge,
  type IrEvidence,
  type IrLocation,
  type ResourceOperation,
  type SecurityIr,
} from "../security-ir/model.js";

interface ClassifiedIdentity {
  readonly source: IdentityFact["source"];
  readonly trust: IdentityTrust;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyRequestExpression(
  expression: string,
  requestName: string,
  authenticated: boolean,
): ClassifiedIdentity | undefined {
  const request = escapeRegExp(requestName);
  if (new RegExp(`^${request}(?:\\?\\.)?\\.params(?:\\.|\\[)`).test(expression)) {
    return { source: "request-param", trust: "attacker-controlled" };
  }
  if (new RegExp(`^${request}(?:\\?\\.)?\\.query(?:\\.|\\[)`).test(expression)) {
    return { source: "request-query", trust: "attacker-controlled" };
  }
  if (new RegExp(`^${request}(?:\\?\\.)?\\.body(?:\\.|\\[)`).test(expression)) {
    return { source: "request-body", trust: "attacker-controlled" };
  }
  if (new RegExp(`^${request}(?:\\?\\.)?\\.headers(?:\\.|\\[)`).test(expression)) {
    return { source: "request-header", trust: "attacker-controlled" };
  }
  if (new RegExp(`^${request}(?:\\?\\.)?\\.(?:auth|user)(?:\\.|\\[)`).test(expression)) {
    return authenticated
      ? { source: "authenticated-context", trust: "trusted-authenticated" }
      : { source: "unknown", trust: "unknown" };
  }
  if (/^(?:"[^"]*"|'[^']*'|\d+|true|false|null)$/.test(expression)) {
    return { source: "literal", trust: "trusted-constant" };
  }
  return undefined;
}

function combineTrust(facts: readonly IdentityFact[]): IdentityTrust {
  const unique = new Set(facts.map((fact) => fact.trust));
  return unique.size === 1 ? (facts[0]?.trust ?? "unknown") : "unknown";
}

function addEvidence(
  evidence: IrEvidence[],
  kind: IrEvidence["kind"],
  location: IrLocation,
  message: string,
): string {
  const id = securityIrId("evidence", kind, location.path, String(location.start.offset), message);
  if (!evidence.some((item) => item.id === id)) evidence.push({ id, kind, location, message });
  return id;
}

export function enrichSecurityFacts(
  input: SecurityIr,
  files: readonly SourceFile[],
  parsedByPath: ReadonlyMap<string, ParsedSource>,
): SecurityIr {
  const symbolsById = new Map(input.symbols.map((symbol) => [symbol.id, symbol]));
  const authProofs = analyzeExpressAuthentication(input, files);
  const routeIdsByHandler = new Map<string, Set<string>>();
  for (const route of input.routes) {
    if (route.handlerSymbolId === undefined) continue;
    const routes = routeIdsByHandler.get(route.handlerSymbolId) ?? new Set<string>();
    routes.add(route.id);
    routeIdsByHandler.set(route.handlerSymbolId, routes);
  }
  const provenRouteIdsByHandler = new Map<string, Set<string>>();
  for (const proof of authProofs) {
    const routes = provenRouteIdsByHandler.get(proof.handlerSymbolId) ?? new Set<string>();
    routes.add(proof.routeId);
    provenRouteIdsByHandler.set(proof.handlerSymbolId, routes);
  }
  const authenticatedHandlers = new Map<string, string>();
  for (const proof of authProofs) {
    const allRoutes = routeIdsByHandler.get(proof.handlerSymbolId);
    const provenRoutes = provenRouteIdsByHandler.get(proof.handlerSymbolId);
    if (allRoutes !== undefined && provenRoutes?.size === allRoutes.size) {
      authenticatedHandlers.set(proof.handlerSymbolId, proof.requestParameterName);
    }
  }
  const evidence = [...input.evidence];
  const edges: IrEdge[] = [...input.edges];
  const identities: IdentityFact[] = [];
  const identityByFunctionAndName = new Map<string, IdentityFact[]>();
  const enforcements = [...input.enforcements];

  const recordIdentity = (
    functionSymbolId: string,
    name: string,
    classified: ClassifiedIdentity,
    identityLocation: IrLocation,
    message: string,
    derivedFrom: readonly string[] = [],
  ): IdentityFact => {
    const key = `${functionSymbolId}\u0000${name}`;
    const existing = (identityByFunctionAndName.get(key) ?? []).find(
      (fact) =>
        fact.trust === classified.trust &&
        fact.source === classified.source &&
        fact.derivedFrom.join("\u0000") === derivedFrom.join("\u0000"),
    );
    if (existing !== undefined) return existing;
    const evidenceId = addEvidence(evidence, "identity-source", identityLocation, message);
    const fact: IdentityFact = {
      id: securityIrId(
        "identity",
        functionSymbolId,
        name,
        classified.source,
        classified.trust,
        ...derivedFrom,
      ),
      symbolId: functionSymbolId,
      name,
      source: classified.source,
      trust: classified.trust,
      derivedFrom: [...derivedFrom],
      location: identityLocation,
      evidenceIds: [evidenceId],
    };
    identities.push(fact);
    const grouped = identityByFunctionAndName.get(key) ?? [];
    grouped.push(fact);
    identityByFunctionAndName.set(key, grouped);
    return fact;
  };

  for (const proof of authProofs) {
    const evidenceId = addEvidence(evidence, "identity-source", proof.location, proof.message);
    const enforcementId = securityIrId(
      "enforcement",
      proof.routeId,
      proof.middlewareSymbolId,
      "authentication",
    );
    enforcements.push({
      id: enforcementId,
      functionSymbolId: proof.middlewareSymbolId,
      kind: "authentication",
      state: "PROVEN",
      location: proof.location,
      evidenceIds: [evidenceId],
    });
    edges.push({
      from: proof.routeId,
      to: enforcementId,
      kind: "enforces-authorization",
      evidenceIds: [evidenceId],
    });
  }

  let calls: IrCall[] = input.calls.map((call) => ({
    ...call,
    arguments: call.arguments.map((argument) => ({ ...argument, identityFactIds: [] })),
  }));

  for (let iteration = 0; iteration < Math.max(1, input.symbols.length); iteration += 1) {
    let changed = false;
    const nextCalls = calls.map((call) => {
      const caller = symbolsById.get(call.callerSymbolId);
      if (caller === undefined) return call;
      const requestName = caller.parameterNames[0] ?? "req";
      const authenticated = authenticatedHandlers.has(caller.id);
      const nextArguments = call.arguments.map((argument) => {
        const direct = classifyRequestExpression(argument.expression, requestName, authenticated);
        let facts = identityByFunctionAndName.get(`${caller.id}\u0000${argument.expression}`) ?? [];
        if (direct !== undefined) {
          const fact = recordIdentity(
            caller.id,
            argument.expression,
            direct,
            call.location,
            `${argument.expression} is classified as ${direct.trust} from ${direct.source}.`,
          );
          facts = [...facts, fact];
        }
        const ids = [...new Set(facts.map((fact) => fact.id))].sort();
        if (ids.join("\u0000") !== argument.identityFactIds.join("\u0000")) changed = true;
        return { ...argument, identityFactIds: ids };
      });
      return { ...call, arguments: nextArguments };
    });
    calls = nextCalls;

    for (const call of calls) {
      if (call.resolution !== "resolved" || call.calleeSymbolId === undefined) continue;
      const callee = symbolsById.get(call.calleeSymbolId);
      if (callee === undefined) continue;
      for (const argument of call.arguments) {
        const parameterName = callee.parameterNames[argument.position];
        if (parameterName === undefined || argument.identityFactIds.length === 0) continue;
        const sources = argument.identityFactIds
          .map((id) => identities.find((fact) => fact.id === id))
          .filter((fact): fact is IdentityFact => fact !== undefined);
        if (sources.length === 0) continue;
        const before = identities.length;
        recordIdentity(
          callee.id,
          parameterName,
          { source: "derived", trust: combineTrust(sources) },
          call.location,
          `${parameterName} derives from call argument ${argument.position} supplied by ${symbolsById.get(call.callerSymbolId)?.name ?? "caller"}.`,
          sources.map((fact) => fact.id).sort(),
        );
        if (identities.length !== before) changed = true;
      }
    }
    if (!changed) break;
  }

  const resourceOperations: ResourceOperation[] = [];
  for (const candidate of analyzePrismaOperations(input, files, parsedByPath)) {
    const evidenceId = addEvidence(
      evidence,
      "resource-access",
      candidate.location,
      candidate.message,
    );
    const operationId = securityIrId(
      "resource",
      candidate.location.path,
      String(candidate.startOffset),
      candidate.resourceType,
      candidate.operation,
    );
    const selectors = candidate.selectors.map((selector) => {
      const facts =
        identityByFunctionAndName.get(
          `${candidate.functionSymbolId}\u0000${selector.expression}`,
        ) ?? [];
      const fact = facts.length === 1 ? facts[0] : undefined;
      const literal = classifyRequestExpression(selector.expression, "req", false);
      return {
        field: selector.field,
        expression: selector.expression,
        ...(fact === undefined ? {} : { identityFactId: fact.id }),
        trust: fact?.trust ?? literal?.trust ?? "unknown",
      };
    });
    resourceOperations.push({
      id: operationId,
      functionSymbolId: candidate.functionSymbolId,
      technology: "Prisma",
      resourceType: candidate.resourceType,
      operation: candidate.operation,
      selectors,
      location: candidate.location,
      evidenceIds: [evidenceId],
    });
    edges.push({
      from: candidate.functionSymbolId,
      to: operationId,
      kind: candidate.operation.startsWith("read") ? "reads-resource" : "writes-resource",
      evidenceIds: [evidenceId],
    });
  }

  return securityIrSchema.parse({
    ...input,
    calls,
    identities: identities.sort((left, right) => left.id.localeCompare(right.id)),
    resourceOperations: resourceOperations.sort((left, right) => left.id.localeCompare(right.id)),
    enforcements: enforcements.sort((left, right) => left.id.localeCompare(right.id)),
    evidence: evidence.sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.sort((left, right) =>
      `${left.from}:${left.kind}:${left.to}`.localeCompare(
        `${right.from}:${right.kind}:${right.to}`,
      ),
    ),
    limitations: [
      ...input.limitations,
      "Authenticated Express identity is trusted only when a statically bound middleware proves credential verification and authenticated-context assignment.",
      "Identity propagation follows positional arguments across resolved calls only; aliases, mutation, closures, destructuring, and returned values remain UNKNOWN.",
      "Prisma analysis supports direct prisma.<model> operations with flat literal where selectors; nested, spread, relational, raw, and dynamically built queries remain UNKNOWN.",
    ],
  });
}
