import type { ScanReport } from "../core/schema.js";

export function renderJson(report: ScanReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
