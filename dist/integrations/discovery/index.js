export function agentDetection(id, displayName, evidence, integration) {
    const detected = evidence.length > 0;
    return {
        id,
        displayName,
        detected,
        installation: detected ? "installed" : "not_installed",
        integration,
        evidence,
    };
}
export async function discoverAgents(adapters, context) {
    return Promise.all(adapters.map((adapter) => Promise.resolve(adapter.detect(context))));
}
export function needsConfiguration(detection) {
    return detection.detected && detection.integration !== "configured";
}
//# sourceMappingURL=index.js.map