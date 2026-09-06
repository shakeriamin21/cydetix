import { stableFingerprint } from "../core/hash.js";
import { authorizationProofSchema, } from "./model.js";
const OWNERSHIP_FIELD = /^(?:owner|ownerId|user|userId|account|accountId|member|memberId|subject|subjectId)$/i;
const SUBJECT_IDENTITY = /(?:owner|user|account|member|subject)/i;
const OBJECT_FIELD = /(?:^id$|Id$)/;
const MAX_PATH_STATES = 10_000;
const MAX_PROOFS = 10_000;
function proofId(routeId, resourceId, invariant) {
    return `proof:${stableFingerprint(["1.0.0", routeId, resourceId, invariant]).slice(0, 16)}`;
}
function callAdjacency(ir) {
    const result = new Map();
    for (const call of ir.calls) {
        if (call.resolution !== "resolved" || call.calleeSymbolId === undefined)
            continue;
        const calls = result.get(call.callerSymbolId) ?? [];
        calls.push(call);
        result.set(call.callerSymbolId, calls);
    }
    for (const calls of result.values())
        calls.sort((left, right) => left.id.localeCompare(right.id));
    return result;
}
function findCallPath(adjacency, start, target, maxDepth) {
    if (start === target)
        return [];
    const pending = [
        { symbolId: start, calls: [], visited: new Set([start]) },
    ];
    let explored = 0;
    while (pending.length > 0 && explored < MAX_PATH_STATES) {
        const current = pending.shift();
        explored += 1;
        if (current === undefined || current.calls.length >= maxDepth)
            continue;
        for (const call of adjacency.get(current.symbolId) ?? []) {
            const callee = call.calleeSymbolId;
            if (callee === undefined || current.visited.has(callee))
                continue;
            const calls = [...current.calls, call];
            if (callee === target)
                return calls;
            pending.push({ symbolId: callee, calls, visited: new Set([...current.visited, callee]) });
        }
    }
    return undefined;
}
function evidenceFor(ir, id) {
    return ir.evidence.find((item) => item.id === id);
}
function identityLineage(ir, fact) {
    const byId = new Map(ir.identities.map((item) => [item.id, item]));
    const result = [];
    const visiting = new Set();
    const visit = (current) => {
        if (visiting.has(current.id))
            return;
        visiting.add(current.id);
        for (const parentId of current.derivedFrom) {
            const parent = byId.get(parentId);
            if (parent !== undefined)
                visit(parent);
        }
        result.push(current);
    };
    visit(fact);
    return result;
}
function evidencePath(ir, route, calls, subject, resource, invariant, enforcementMessage) {
    const raw = [];
    const routeEvidence = route.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
    if (routeEvidence !== undefined) {
        raw.push({
            kind: "route",
            irId: route.id,
            location: routeEvidence.location,
            message: routeEvidence.message,
        });
    }
    for (const call of calls) {
        const callEvidence = call.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
        if (callEvidence !== undefined) {
            raw.push({
                kind: "call",
                irId: call.id,
                location: callEvidence.location,
                message: callEvidence.message,
            });
        }
    }
    if (subject !== undefined) {
        for (const fact of identityLineage(ir, subject)) {
            const factEvidence = fact.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
            if (factEvidence !== undefined) {
                raw.push({
                    kind: "identity",
                    irId: fact.id,
                    location: factEvidence.location,
                    message: factEvidence.message,
                });
            }
        }
    }
    const resourceEvidence = resource.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
    if (resourceEvidence !== undefined) {
        raw.push({
            kind: "resource",
            irId: resource.id,
            location: resourceEvidence.location,
            message: resourceEvidence.message,
        });
        raw.push({
            kind: "enforcement",
            irId: proofId(route.id, resource.id, invariant),
            location: resourceEvidence.location,
            message: enforcementMessage,
        });
    }
    return raw.map((item, order) => ({ order, ...item }));
}
export function buildAuthorizationProofs(ir) {
    const proofs = [];
    const adjacency = callAdjacency(ir);
    const identityById = new Map(ir.identities.map((identity) => [identity.id, identity]));
    for (const route of ir.routes) {
        if (route.handlerSymbolId === undefined)
            continue;
        for (const resource of ir.resourceOperations) {
            if (proofs.length >= MAX_PROOFS) {
                return proofs.sort((left, right) => left.id.localeCompare(right.id));
            }
            const calls = findCallPath(adjacency, route.handlerSymbolId, resource.functionSymbolId, 12);
            if (calls === undefined)
                continue;
            const resourceFacts = ir.identities.filter((identity) => identity.symbolId === resource.functionSymbolId);
            const trustedSubjects = resourceFacts.filter((identity) => identity.trust === "trusted-authenticated" &&
                SUBJECT_IDENTITY.test(identity.name) &&
                !/tenant/i.test(identity.name));
            const ownershipSelectors = resource.selectors.filter((selector) => OWNERSHIP_FIELD.test(selector.field));
            const provenSelector = ownershipSelectors.find((selector) => selector.trust === "trusted-authenticated");
            const attackerObjectSelector = resource.selectors.find((selector) => OBJECT_FIELD.test(selector.field) &&
                !OWNERSHIP_FIELD.test(selector.field) &&
                !/tenant/i.test(selector.field) &&
                selector.trust === "attacker-controlled");
            const eligibleOperation = ["read-one", "update", "delete"].includes(resource.operation);
            const state = provenSelector !== undefined
                ? "PROVEN"
                : eligibleOperation && attackerObjectSelector !== undefined && trustedSubjects.length > 0
                    ? "VIOLATED"
                    : "UNKNOWN";
            const subject = (provenSelector?.identityFactId === undefined
                ? undefined
                : identityById.get(provenSelector.identityFactId)) ?? trustedSubjects[0];
            const explanation = state === "PROVEN"
                ? `${resource.resourceType} ${resource.operation} is constrained by ${provenSelector?.field ?? "ownership"} from trusted authenticated identity.`
                : state === "VIOLATED"
                    ? `${resource.resourceType} ${resource.operation} uses attacker-controlled ${attackerObjectSelector?.field ?? "object identity"} while received authenticated subject identity is omitted from the resource selector.`
                    : `Supported evidence does not establish whether ${resource.resourceType} ${resource.operation} enforces object-level authorization.`;
            const enforcementMessage = state === "PROVEN"
                ? "The resource selector constrains ownership with trusted authenticated identity."
                : state === "VIOLATED"
                    ? "Trusted authenticated subject identity reaches the resource function but is omitted from its selector."
                    : "Object-level authorization could not be proven or disproven from supported evidence.";
            const path = evidencePath(ir, route, calls, subject, resource, "object-authorization", enforcementMessage);
            if (path.length < 2)
                continue;
            proofs.push(authorizationProofSchema.parse({
                schemaVersion: "1.0.0",
                id: proofId(route.id, resource.id, "object-authorization"),
                invariant: "object-authorization",
                state,
                routeId: route.id,
                resourceOperationId: resource.id,
                subjectIdentityFactIds: trustedSubjects.map((identity) => identity.id).sort(),
                evidencePath: path,
                explanation,
                confidence: state === "UNKNOWN" ? "medium" : "high",
                reachability: state === "UNKNOWN" ? "possible" : "likely",
            }));
            const trustedTenants = resourceFacts.filter((identity) => identity.trust === "trusted-authenticated" && /tenant/i.test(identity.name));
            const tenantSelectors = resource.selectors.filter((selector) => /^tenant(?:Id)?$/i.test(selector.field));
            const trustedTenantSelector = tenantSelectors.find((selector) => selector.trust === "trusted-authenticated");
            const attackerTenantSelector = tenantSelectors.find((selector) => selector.trust === "attacker-controlled");
            const tenantState = trustedTenantSelector !== undefined
                ? "PROVEN"
                : trustedTenants.length > 0 &&
                    (attackerTenantSelector !== undefined || tenantSelectors.length === 0)
                    ? "VIOLATED"
                    : "UNKNOWN";
            const tenantSubject = (trustedTenantSelector?.identityFactId === undefined
                ? undefined
                : identityById.get(trustedTenantSelector.identityFactId)) ?? trustedTenants[0];
            const tenantExplanation = tenantState === "PROVEN"
                ? `${resource.resourceType} ${resource.operation} is constrained by tenant identity from authenticated context.`
                : tenantState === "VIOLATED" && attackerTenantSelector !== undefined
                    ? `${resource.resourceType} ${resource.operation} uses attacker-controlled tenant identity while trusted authenticated tenant identity reaching the resource function is ignored.`
                    : tenantState === "VIOLATED"
                        ? `${resource.resourceType} ${resource.operation} receives trusted authenticated tenant identity but omits a tenant constraint from the resource selector.`
                        : `Supported evidence does not establish whether ${resource.resourceType} ${resource.operation} enforces tenant isolation.`;
            const tenantEnforcementMessage = tenantState === "PROVEN"
                ? "The resource selector constrains tenant access with trusted authenticated tenant identity."
                : tenantState === "VIOLATED" && attackerTenantSelector !== undefined
                    ? "The tenant selector consumes attacker-controlled identity instead of the available authenticated tenant identity."
                    : tenantState === "VIOLATED"
                        ? "Authenticated tenant identity reaches the resource function but no tenant selector consumes it."
                        : "Tenant isolation could not be proven or disproven from supported evidence.";
            const tenantPath = evidencePath(ir, route, calls, tenantSubject, resource, "tenant-isolation", tenantEnforcementMessage);
            if (tenantPath.length >= 2) {
                proofs.push(authorizationProofSchema.parse({
                    schemaVersion: "1.0.0",
                    id: proofId(route.id, resource.id, "tenant-isolation"),
                    invariant: "tenant-isolation",
                    state: tenantState,
                    routeId: route.id,
                    resourceOperationId: resource.id,
                    subjectIdentityFactIds: trustedTenants.map((identity) => identity.id).sort(),
                    evidencePath: tenantPath,
                    explanation: tenantExplanation,
                    confidence: tenantState === "UNKNOWN" ? "medium" : "high",
                    reachability: tenantState === "UNKNOWN" ? "possible" : "likely",
                }));
            }
        }
    }
    return proofs.sort((left, right) => left.id.localeCompare(right.id));
}
//# sourceMappingURL=proof.js.map