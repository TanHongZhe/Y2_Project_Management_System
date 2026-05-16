"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const EMBED_MODEL = "text-embedding-3-small";
const VISION_MODEL = "gpt-4o-mini";
const EMBED_DIM = 1536;
const TARGET_CHUNK_CHARS = 1400;
const OVERLAP_CHARS = 140;

type DocType = "pdf" | "image" | "md" | "json" | "txt";

interface Chunk {
  text: string;
  heading?: string;
  sourceType: "text" | "image";
  storageId?: Id<"_storage">;
}

function chunkText(text: string): Chunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const headingChunks: Chunk[] = [];
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const matches: { idx: number; heading: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(cleaned)) !== null) {
    matches.push({ idx: m.index, heading: m[2].trim() });
  }

  if (matches.length > 0) {
    const sections: { heading: string; body: string }[] = [];
    if (matches[0].idx > 0) {
      sections.push({ heading: "", body: cleaned.slice(0, matches[0].idx).trim() });
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].idx;
      const end = i + 1 < matches.length ? matches[i + 1].idx : cleaned.length;
      sections.push({ heading: matches[i].heading, body: cleaned.slice(start, end).trim() });
    }
    for (const s of sections) {
      if (!s.body) continue;
      for (const piece of splitToSize(s.body)) {
        headingChunks.push({ text: piece, heading: s.heading || undefined, sourceType: "text" });
      }
    }
    return headingChunks;
  }

  return splitToSize(cleaned).map((t) => ({ text: t, sourceType: "text" }));
}

function splitToSize(text: string): string[] {
  if (text.length <= TARGET_CHUNK_CHARS) return [text];

  const out: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let buf = "";

  for (const p of paragraphs) {
    if (buf.length + p.length + 2 <= TARGET_CHUNK_CHARS) {
      buf = buf ? `${buf}\n\n${p}` : p;
    } else {
      if (buf) out.push(buf);
      if (p.length > TARGET_CHUNK_CHARS) {
        for (let i = 0; i < p.length; i += TARGET_CHUNK_CHARS - OVERLAP_CHARS) {
          out.push(p.slice(i, i + TARGET_CHUNK_CHARS));
        }
        buf = "";
      } else {
        buf = p;
      }
    }
  }
  if (buf) out.push(buf);
  return out.filter((s) => s.trim().length > 0);
}

function buildEmbedInput(chunk: Chunk, docName: string): string {
  const prefix = chunk.heading ? `[${docName} > ${chunk.heading}]` : `[${docName}]`;
  return `${prefix}\n${chunk.text}`;
}

async function embedTexts(apiKey: string, inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`embeddings failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const out = data.data.map((d) => d.embedding);
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(`unexpected embedding dim ${v.length}`);
    }
  }
  return out;
}

async function captionImage(apiKey: string, dataUrl: string, name: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You describe engineering and hardware images for a project knowledge base. Be precise and factual. Note visible labels, part numbers, measurements, scopes traces, schematics, layouts, and any text. Keep to 5-10 sentences.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Describe this image (filename: ${name}) for retrieval.` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 700,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`vision failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

function inferType(name: string): DocType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".txt")) return "txt";
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(lower)) return "image";
  return "txt";
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  return result.text as string ?? "";
}

export const processDocument = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set in Convex environment");

    const doc = await ctx.runQuery(internal.documents.getInternal, { documentId });
    if (!doc) throw new Error(`document ${documentId} not found`);

    // Clear any previously-indexed chunks so re-ingestion doesn't leave duplicates
    await ctx.runMutation(internal.chunks.deleteByDocument, { documentId });

    await ctx.runMutation(internal.documents.setStatus, {
      documentId,
      status: "processing",
    });

    try {
      const blob = await ctx.storage.get(doc.storageId);
      if (!blob) throw new Error("file blob missing from storage");

      let chunks: Chunk[] = [];

      if (doc.type === "pdf") {
        const buf = Buffer.from(await blob.arrayBuffer());
        const raw = await parsePdf(buf);
        chunks = chunkText(raw);
      } else if (doc.type === "image") {
        const buf = Buffer.from(await blob.arrayBuffer());
        const mime = blob.type || "image/png";
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        const caption = await captionImage(apiKey, dataUrl, doc.name);
        if (caption) {
          chunks = [
            {
              text: caption,
              sourceType: "image",
              storageId: doc.storageId,
              heading: doc.name,
            },
          ];
        }
      } else if (doc.type === "md") {
        const raw = await blob.text();
        chunks = chunkText(raw);
      } else if (doc.type === "json") {
        const raw = await blob.text();
        let pretty = raw;
        try {
          pretty = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          // keep raw
        }
        chunks = chunkText(pretty);
      } else {
        const raw = await blob.text();
        chunks = chunkText(raw);
      }

      if (chunks.length === 0) {
        await ctx.runMutation(internal.documents.setStatus, {
          documentId,
          status: "ready",
          chunkCount: 0,
        });
        return { chunkCount: 0 };
      }

      const BATCH = 64;
      let inserted = 0;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const embeddings = await embedTexts(apiKey, slice.map((c) => buildEmbedInput(c, doc.name)));
        const records = slice.map((c, j) => ({
          documentId,
          documentName: doc.name,
          text: c.text,
          embedding: embeddings[j],
          chunkIndex: i + j,
          sourceType: c.sourceType,
          storageId: c.storageId,
          heading: c.heading,
        }));
        await ctx.runMutation(internal.chunks.insertBatch, { chunks: records });
        inserted += records.length;
      }

      await ctx.runMutation(internal.documents.setStatus, {
        documentId,
        status: "ready",
        chunkCount: inserted,
      });
      return { chunkCount: inserted };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.documents.setStatus, {
        documentId,
        status: "error",
        error: message.slice(0, 500),
      });
      throw err;
    }
  },
});

export { inferType };
