import { readFile } from "node:fs/promises";

import { selectCydetixTool } from "../dist/integrations/triggers.js";

const corpus = JSON.parse(await readFile("validation/agent-trigger-corpus.json", "utf8"));
let correct = 0;
let missed = 0;
let unwanted = 0;
for (const entry of corpus.cases) {
  const actual = selectCydetixTool(entry.prompt) ?? null;
  if (actual === entry.expected) correct += 1;
  else if (entry.expected === null) unwanted += 1;
  else missed += 1;
}
const result = {
  corpus: "validation/agent-trigger-corpus.json",
  kind: "deterministic descriptor-selection proxy",
  correct,
  missed,
  unwanted,
  total: corpus.cases.length,
  limitation: "Supported host agents make independent probabilistic invocation decisions.",
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (missed > 0 || unwanted > 0) process.exitCode = 1;
