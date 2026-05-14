import type { NextRequest } from "next/server";

export const runtime = "edge";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }

  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const buffer = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return Response.json({ text, name: file.name });
    }
    const text = await file.text();
    return Response.json({ text, name: file.name });
  } catch (err) {
    console.error("[extract-text]", err);
    return Response.json(
      { error: "Extraction failed. Please try a different file." },
      { status: 500 },
    );
  }
}
