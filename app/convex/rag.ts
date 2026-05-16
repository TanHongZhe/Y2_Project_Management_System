import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const SCORE_THRESHOLD = 0.32;

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
  allCandidates: Array<{
    documentName: string;
    heading?: string;
    score: number;
    sent: boolean;
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
      return { textChunks: [], imageChunks: [], allCandidates: [] };
    }
    if (!query.trim()) {
      return { textChunks: [], imageChunks: [], allCandidates: [] };
    }

    let vector: number[];
    try {
      vector = await embedQuery(apiKey, query);
    } catch (err) {
      console.error("rag.search embed error", err);
      return { textChunks: [], imageChunks: [], allCandidates: [] };
    }

    const [hits, textHits] = await Promise.all([
      ctx.vectorSearch("chunks", "by_embedding", {
        vector,
        limit: limit ?? 16,
      }),
      ctx.runQuery(internal.chunks.searchByText, { query, limit: 5 }),
    ]);
    if (hits.length === 0 && textHits.length === 0) return { textChunks: [], imageChunks: [], allCandidates: [] };

    // --- RRF (Reciprocal Rank Fusion) ---
    // Combines vector-search rank and full-text-search rank into a single score.
    // RRF_K=60 is the standard constant; chunks in both result sets score highest.
    const RRF_K = 60;
    const cosineById = new Map<string, number>(hits.map((h) => [h._id, h._score]));
    const vectorRankById = new Map<string, number>(hits.map((h, i) => [h._id, i]));
    const textRankById = new Map<string, number>(
      (textHits as Doc<"chunks">[]).map((c, i) => [String(c._id), i])
    );

    const rrfScore = (id: string): number => {
      const vRank = vectorRankById.get(id);
      const tRank = textRankById.get(id);
      return (vRank !== undefined ? 1 / (RRF_K + vRank) : 0) +
             (tRank !== undefined ? 1 / (RRF_K + tRank) : 0);
    };

    // Fetch vector-result docs + any text-only hits not already in vector results
    const vectorIds = new Set(hits.map((h) => h._id));
    const ids = hits.map((h) => h._id);
    const vectorChunks: Doc<"chunks">[] = await ctx.runQuery(internal.chunks.getByIds, { ids });
    const extraTextHits = (textHits as Doc<"chunks">[]).filter(
      (c) => !vectorIds.has(c._id)
    );
    const allChunkDocs = [...vectorChunks, ...extraTextHits];

    // Build unified pools keyed by _id so we can filter cleanly later
    type ScoredTextChunk = RagResult["textChunks"][number] & { _id: string };
    type ScoredImageChunk = RagResult["imageChunks"][number] & { _id: string };

    const seenIds = new Set<string>();
    const mergedText: ScoredTextChunk[] = [];
    const mergedImages: ScoredImageChunk[] = [];

    for (const c of allChunkDocs) {
      const cid = String(c._id);
      if (seenIds.has(cid)) continue;
      seenIds.add(cid);
      const rrf = rrfScore(cid);

      if (c.sourceType === "image" && c.storageId) {
        const url = (await ctx.storage.getUrl(c.storageId)) ?? "";
        if (url) {
          mergedImages.push({ _id: cid, description: c.text, documentName: c.documentName, url, chunkIndex: c.chunkIndex, score: rrf });
        } else {
          mergedText.push({ _id: cid, text: c.text, documentName: c.documentName, heading: c.heading, chunkIndex: c.chunkIndex, score: rrf });
        }
      } else {
        mergedText.push({ _id: cid, text: c.text, documentName: c.documentName, heading: c.heading, chunkIndex: c.chunkIndex, score: rrf });
      }
    }

    mergedText.sort((a, b) => b.score - a.score);
    mergedImages.sort((a, b) => b.score - a.score);

    // --- Threshold filter ---
    // Keep a chunk if its vector cosine is above threshold OR it had a text hit
    // (text hits are exact-term matches and always trustworthy regardless of cosine).
    let filteredText = mergedText.filter(
      (c) => (cosineById.get(c._id) ?? 0) >= SCORE_THRESHOLD || textRankById.has(c._id)
    );
    let filteredImages = mergedImages.filter(
      (c) => (cosineById.get(c._id) ?? 0) >= SCORE_THRESHOLD
    );

    // Enforce minimum of 1 result
    if (filteredText.length === 0 && filteredImages.length === 0) {
      if (mergedText[0]) filteredText = [mergedText[0]];
      else if (mergedImages[0]) filteredImages = [mergedImages[0]];
    }

    // --- Adjacent chunk deduplication ---
    // Chunks from the same document with consecutive chunkIndex values share overlap
    // content. Keep only the higher-RRF-scored one (list is already sorted desc).
    const dedupedText: ScoredTextChunk[] = [];
    for (const c of filteredText) {
      const hasNeighbour = dedupedText.some(
        (d) => d.documentName === c.documentName && Math.abs(d.chunkIndex - c.chunkIndex) <= 1
      );
      if (!hasNeighbour) dedupedText.push(c);
    }

    // Build debug candidates list (strip internal _id before returning)
    const sentKeys = new Set([
      ...dedupedText.map((c) => `${c.documentName}:${c.chunkIndex}`),
      ...filteredImages.map((c) => `${c.documentName}:${c.chunkIndex}`),
    ]);
    // allCandidates is a debug/display list — use cosine scores so the UI shows
    // familiar 0.32+ values. Text-only hits (not in vector results) get 0.68
    // to match the previous artificial score convention.
    const allCandidates = allChunkDocs
      .filter((c, i, arr) => arr.findIndex((d) => d._id === c._id) === i)
      .map((c) => {
        const cid = String(c._id);
        const cosine = cosineById.get(cid);
        const displayScore = cosine !== undefined ? cosine : (textRankById.has(cid) ? 0.68 : 0);
        return {
          documentName: c.documentName,
          heading: c.heading,
          score: displayScore,
          sent: sentKeys.has(`${c.documentName}:${c.chunkIndex}`),
        };
      })
      .sort((a, b) => b.score - a.score);

    // Hard cap: send at most 8 text chunks and 4 image chunks to the LLM.
    // Fetching 16 from vector search gives a wider candidate pool for the
    // threshold + dedup filters to work with, but we don't want to bloat context.
    const finalText = dedupedText.slice(0, 8).map(({ _id: _dropped, ...rest }) => rest);
    const finalImages = filteredImages.slice(0, 4).map(({ _id: _dropped, ...rest }) => rest);

    return { textChunks: finalText, imageChunks: finalImages, allCandidates };
  },
});

export type ImageRef = { storageId: Id<"_storage">; url: string };
