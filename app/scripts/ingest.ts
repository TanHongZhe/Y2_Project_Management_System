/**
 * CLI seed tool — ingests every file in app/seed/ into Convex.
 *
 *   npx tsx scripts/ingest.ts
 *
 * Reads NEXT_PUBLIC_CONVEX_URL from .env.local. Idempotent: a file whose name
 * already exists as a document is skipped. The seed/ directory is gitignored.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

config({ path: ".env.local" });

const SEED_DIR = join(process.cwd(), "seed");
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

type DocType = "pdf" | "image" | "md" | "json" | "txt";

function inferType(name: string): DocType {
  const ext = extname(name).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".json") return "json";
  if (ext === ".txt") return "txt";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext)) return "image";
  return "txt";
}

function contentTypeFor(type: DocType, name: string): string {
  if (type === "pdf") return "application/pdf";
  if (type === "json") return "application/json";
  if (type === "md") return "text/markdown";
  if (type === "txt") return "text/plain";
  const ext = extname(name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  return "image/png";
}

async function main() {
  if (!CONVEX_URL) {
    console.error("✗ NEXT_PUBLIC_CONVEX_URL is not set. Add it to app/.env.local.");
    process.exit(1);
  }

  let entries: string[];
  try {
    entries = await readdir(SEED_DIR);
  } catch {
    console.error(`✗ No seed directory found at ${SEED_DIR}`);
    console.error("  Create app/seed/ and drop .pdf / .md / .json / .txt / image files in it.");
    process.exit(1);
  }

  const files = [];
  for (const entry of entries) {
    const full = join(SEED_DIR, entry);
    const s = await stat(full);
    if (s.isFile()) files.push({ name: entry, path: full, size: s.size });
  }

  if (files.length === 0) {
    console.log("Nothing to ingest — app/seed/ is empty.");
    return;
  }

  const convex = new ConvexHttpClient(CONVEX_URL);
  console.log(`Found ${files.length} file(s) in seed/. Ingesting into ${CONVEX_URL}\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const label = `[${done + skipped + failed + 1}/${files.length}] ${file.name}`;
    try {
      const existing = await convex.query(api.documents.findByName, { name: file.name });
      if (existing) {
        console.log(`${label} — already ingested, skipping`);
        skipped++;
        continue;
      }

      const type = inferType(file.name);
      const bytes = await readFile(file.path);

      process.stdout.write(`${label} — uploading… `);
      const uploadUrl = await convex.mutation(api.documents.generateUploadUrl, {});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentTypeFor(type, file.name) },
        body: bytes,
      });
      if (!uploadRes.ok) throw new Error(`upload failed (${uploadRes.status})`);
      const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };

      const documentId = await convex.mutation(api.documents.create, {
        name: file.name,
        type,
        storageId,
        size: file.size,
      });

      process.stdout.write("processing… ");
      const result = await convex.action(api.ingest.processDocument, { documentId });
      console.log(`✓ ${result.chunkCount} chunk(s)`);
      done++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone. ${done} ingested, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
