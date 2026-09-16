export const PRODUCT = {
  id: "cydetix",
  displayName: "Cydetix",
  version: "1.0.0",
  reportSchemaVersion: "2.0.0",
  ruleSchemaVersion: "1.0.0",
} as const;

export const USER_AGENT = `${PRODUCT.id}/${PRODUCT.version}`;
