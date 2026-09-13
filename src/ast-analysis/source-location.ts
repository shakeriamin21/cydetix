import type { SourceFile } from "../repository-discovery/traverse.js";
import type { IrLocation } from "../security-ir/model.js";

const lineStartsByFile = new WeakMap<Pick<SourceFile, "text">, readonly number[]>();

/** Preserve the original UTF-16/LF coordinate contract without splitting every source prefix. */
export function sourcePoint(file: Pick<SourceFile, "text">, offset: number): IrLocation["start"] {
  let starts = lineStartsByFile.get(file);
  if (starts === undefined) {
    const indexed = [0];
    for (
      let index = file.text.indexOf("\n");
      index !== -1;
      index = file.text.indexOf("\n", index + 1)
    )
      indexed.push(index + 1);
    starts = indexed;
    lineStartsByFile.set(file, starts);
  }
  const safeOffset = Math.max(0, Math.min(offset, file.text.length));
  const index = Math.trunc(safeOffset) || 0;
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if ((starts[middle] ?? 0) <= index) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: index - (starts[low] ?? 0), offset: safeOffset };
}
