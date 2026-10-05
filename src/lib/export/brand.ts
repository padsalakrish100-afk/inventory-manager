import fs from "node:fs";
import path from "node:path";

// The Opulent Diam logo for PDFs, read once per server instance. The file
// is shipped with the PDF routes via outputFileTracingIncludes
// (next.config.ts). Null if it can't be read — PDFs then just omit it.
let cached: Buffer | null | undefined;

export function brandLogo(): Buffer | null {
  if (cached !== undefined) return cached;
  try {
    cached = fs.readFileSync(path.join(process.cwd(), "public", "brand", "logo.png"));
  } catch {
    cached = null;
  }
  return cached;
}
