import {
  advisoryAnalysisSchema,
  normalizedAdvisorySchema,
  type AdvisoryAnalysis,
  type NormalizedAdvisory,
  type PackageComponent,
} from "./model.js";

export interface AdvisoryProvider {
  readonly name: string;
  readonly endpoint: string;
  query(packages: readonly PackageComponent[]): Promise<readonly NormalizedAdvisory[]>;
}

export interface AdvisoryOptions {
  readonly mode: "offline" | "online";
  readonly provider?: AdvisoryProvider;
  readonly now?: Date;
}

type FetchLike = typeof fetch;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function advisorySeverity(document: Record<string, unknown>): string | undefined {
  const databaseSpecific = record(document.database_specific);
  if (typeof databaseSpecific?.severity === "string") return databaseSpecific.severity;
  const entries = Array.isArray(document.severity) ? document.severity : [];
  const score = record(entries[0])?.score;
  return typeof score === "string" ? score : undefined;
}

function fixedVersions(document: Record<string, unknown>): string[] {
  const fixed = new Set<string>();
  const affected = Array.isArray(document.affected) ? document.affected : [];
  for (const affectedEntry of affected) {
    const rangesValue = record(affectedEntry)?.ranges;
    const ranges: unknown[] = Array.isArray(rangesValue) ? rangesValue : [];
    for (const range of ranges) {
      const eventsValue = record(range)?.events;
      const events: unknown[] = Array.isArray(eventsValue) ? eventsValue : [];
      for (const event of events) {
        const version = record(event)?.fixed;
        if (typeof version === "string") fixed.add(version);
      }
    }
  }
  return [...fixed].sort();
}

function references(document: Record<string, unknown>): string[] {
  const result = new Set<string>();
  const entries = Array.isArray(document.references) ? document.references : [];
  for (const entry of entries) {
    const url = record(entry)?.url;
    if (typeof url === "string" && /^https:\/\//u.test(url)) result.add(url);
  }
  return [...result];
}

export class OsvAdvisoryProvider implements AdvisoryProvider {
  readonly name = "OSV";
  readonly endpoint = "https://api.osv.dev/v1/querybatch";

  constructor(
    private readonly fetchImplementation: FetchLike = fetch,
    private readonly timeoutMilliseconds = 10_000,
  ) {}

  async query(packages: readonly PackageComponent[]): Promise<readonly NormalizedAdvisory[]> {
    const unique = [
      ...new Map(packages.map((component) => [component.purl, component] as const)).values(),
    ];
    if (unique.length === 0) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMilliseconds);
    try {
      const response = await this.fetchImplementation(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          queries: unique.map((component) => ({
            package: { ecosystem: "npm", name: component.name },
            version: component.version,
          })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OSV querybatch returned HTTP ${response.status}`);
      const batch = record(await response.json());
      if (batch === undefined || !Array.isArray(batch.results))
        throw new Error("OSV querybatch returned an invalid response shape");
      const results = batch.results;
      if (results.length !== unique.length)
        throw new Error("OSV querybatch returned a partial response");
      const ids = new Set<string>();
      const purlsById = new Map<string, Set<string>>();
      for (const [index, item] of results.entries()) {
        const component = unique[index];
        if (component === undefined) continue;
        const vulnerabilitiesValue = record(item)?.vulns;
        const vulnerabilities: unknown[] = Array.isArray(vulnerabilitiesValue)
          ? vulnerabilitiesValue
          : [];
        for (const vulnerability of vulnerabilities) {
          const id = record(vulnerability)?.id;
          if (typeof id !== "string") continue;
          ids.add(id);
          purlsById.set(id, new Set([...(purlsById.get(id) ?? []), component.purl]));
        }
      }
      const details = await Promise.all(
        [...ids].map(async (id) => {
          const detailResponse = await this.fetchImplementation(
            `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`,
            { headers: { accept: "application/json" }, signal: controller.signal },
          );
          if (!detailResponse.ok)
            throw new Error(`OSV advisory ${id} returned HTTP ${detailResponse.status}`);
          return record(await detailResponse.json()) ?? { id };
        }),
      );
      const normalized: NormalizedAdvisory[] = [];
      for (const document of details) {
        const id = typeof document.id === "string" ? document.id : undefined;
        if (id === undefined) continue;
        for (const packagePurl of purlsById.get(id) ?? []) {
          normalized.push(
            normalizedAdvisorySchema.parse({
              id,
              aliases: strings(document.aliases),
              packagePurl,
              ...(advisorySeverity(document) === undefined
                ? {}
                : { severity: advisorySeverity(document) }),
              fixedVersions: fixedVersions(document),
              references: references(document),
              provider: this.name,
            }),
          );
        }
      }
      return normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function analyzeAdvisories(
  packages: readonly PackageComponent[],
  options: AdvisoryOptions,
): Promise<AdvisoryAnalysis> {
  const provider = options.provider ?? new OsvAdvisoryProvider();
  if (options.mode === "offline") {
    return advisoryAnalysisSchema.parse({
      provider: provider.name,
      state: "NOT_CHECKED_OFFLINE",
      endpoint: provider.endpoint,
      packagesSubmitted: 0,
      advisories: [],
      message: "Advisory lookup was not attempted because offline mode is active.",
    });
  }
  try {
    const advisories = [...(await provider.query(packages))];
    return advisoryAnalysisSchema.parse({
      provider: provider.name,
      state: advisories.length === 0 ? "CHECKED_NO_FINDINGS" : "CHECKED_FINDINGS",
      checkedAt: (options.now ?? new Date()).toISOString(),
      endpoint: provider.endpoint,
      packagesSubmitted: new Set(packages.map((component) => component.purl)).size,
      advisories,
      message:
        advisories.length === 0
          ? "The provider returned no advisories for the submitted resolved package versions."
          : `The provider returned ${advisories.length} affected resolved package record(s).`,
    });
  } catch (error) {
    return advisoryAnalysisSchema.parse({
      provider: provider.name,
      state: "PROVIDER_UNAVAILABLE",
      endpoint: provider.endpoint,
      packagesSubmitted: new Set(packages.map((component) => component.purl)).size,
      advisories: [],
      message: `Advisory provider was unavailable; results are unknown (${error instanceof Error ? error.name : "provider error"}).`,
    });
  }
}
