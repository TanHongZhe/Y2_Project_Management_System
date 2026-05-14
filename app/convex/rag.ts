import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`embed query failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const emb = data.data[0]?.embedding;
  if (!emb || emb.length !== EMBED_DIM) {
    throw new Error(`unexpected embedding shape`);
  }
  return emb;
}

export type RagResult = {
  textChunks: Array<{
    text: string;
    documentName: string;
    heading?: string;
    chunkIndex: number;
    score: number;
  }>;
  imageChunks: Array<{
    description: string;
    documentName: string;
    url: string;
    chunkIndex: number;
    score: number;
  }>;
};

export const search = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query, limit }): Promise<RagResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { textChunks: [], imageChunks: [] };
    }
    if (!query.trim()) {
      return { textChunks: [], imageChunks: [] };
    }

    let vector: number[];
    try {
      vector = await embedQuery(apiKey, query);
    } catch (err) {
      console.error("rag.search embed error", err);
      return { textChunks: [], imageChunks: [] };
    }

    const hits = await ctx.vectorSearch("chunks", "by_embedding", {
      vector,
      limit: limit ?? 8,
    });
    if (hits.length === 0) return { textChunks: [], imageChunks: [] };

    const ids = hits.map((h) => h._id);
    const scoreById = new Map<string, number>(hits.map((h) => [h._id, h._score]));
    const chunks: Doc<"chunks">[] = await ctx.runQuery(internal.chunks.getByIds, { ids });

    const textChunks: RagResult["textChunks"] = [];
    const imageChunks: RagResult["imageChunks"] = [];

    for (const c of chunks) {
      const score = scoreById.get(c._id) ?? 0;
      if (c.sourceType === "image" && c.storageId) {
        const url = (await ctx.storage.getUrl(c.storageId)) ?? "";
        if (url) {
          imageChunks.push({
            description: c.text,
            documentName: c.documentName,
            url,
            chunkIndex: c.chunkIndex,
            score,
          });
        } else {
          textChunks.push({
            text: c.text,
            documentName: c.documentName,
            heading: c.heading,
            chunkIndex: c.chunkIndex,
            score,
          });
        }
      } else {
        textChunks.push({
          text: c.text,
          documentName: c.documentName,
          heading: c.heading,
          chunkIndex: c.chunkIndex,
          score,
        });
      }
    }

    textChunks.sort((a, b) => b.score - a.score);
    imageChunks.sort((a, b) => b.score - a.score);

    return { textChunks, imageChunks };
  },
});

export type ImageRef = { storageId: Id<"_storage">; url: string };
