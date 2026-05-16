import type { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // Whisper 25 MB limit

function getExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const audio = formData.get("audio") as File | null;
  if (!audio) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  if (audio.size > MAX_SIZE) {
    return Response.json({ error: "Audio too large (max 25 MB)" }, { status: 413 });
  }

  const ext = getExtension(audio.type);
  // Whisper rejects MIME types with codec params (e.g. "audio/webm;codecs=opus")
  // even though webm is supported. Re-wrap with a clean MIME so the multipart
  // Content-Type matches a format Whisper accepts.
  const cleanMime = ext === "mp4" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : "audio/webm";
  const cleanBlob = new Blob([await audio.arrayBuffer()], { type: cleanMime });

  const whisperForm = new FormData();
  whisperForm.append("file", cleanBlob, `recording.${ext}`);
  whisperForm.append("model", "whisper-1");
  // Force English output — without this, Manglish/code-switching gets detected as Malay
  whisperForm.append("language", "en");

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });
  } catch (e) {
    return Response.json({ error: "Transcription request failed", detail: String(e) }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json({ error: "Transcription failed", detail }, { status: 502 });
  }

  const data = (await upstream.json()) as { text: string };
  return Response.json({ transcript: data.text });
}
