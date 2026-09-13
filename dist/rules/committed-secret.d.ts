import { type Finding } from "../core/schema.js";
import type { SecurityRule } from "../rule-engine/types.js";
/** A PEM header alone proves neither key material nor credential exposure. */
export declare function privateKeyMarkerFinding(finding: Finding): Finding;
export declare const committedSecretRule: SecurityRule;
//# sourceMappingURL=committed-secret.d.ts.map