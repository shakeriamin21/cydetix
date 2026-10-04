import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeContentAddressedSubject(directory, content) {
  const bytes = Buffer.from(content, "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const file = path.join(path.resolve(directory), digest + ".json");
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(file, bytes, { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(file);
    if (!existing.equals(bytes))
      throw new Error("Content-addressed evidence subject was changed after creation.", {
        cause: error,
      });
  }
  return file;
}

export async function verifyBoundFileSubject(record) {
  if (record.subject.kind !== "FILE") return;
  if (record.subject.sha256 === undefined || record.subject.bytes === undefined)
    throw new Error("Evidence " + record.evidenceType + " has an incomplete subject binding.");
  const bytes = await readFile(path.resolve(record.subject.identity));
  if (
    createHash("sha256").update(bytes).digest("hex") !== record.subject.sha256 ||
    bytes.length !== record.subject.bytes
  )
    throw new Error("Evidence subject hash mismatch for " + record.evidenceType + ".");
}
