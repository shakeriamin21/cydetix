import type { Finding } from "../core/schema.js";
import { type CorpusLabels, type CorpusManifest, type CorpusValidationResult } from "./model.js";
/** Expected labels are consumed only here, after scanning has produced ordinary Finding data. */
export declare function evaluateCorpus(manifestInput: CorpusManifest, labelsInput: CorpusLabels, findings: readonly Finding[]): CorpusValidationResult;
//# sourceMappingURL=evaluator.d.ts.map