import { GoogleGenAI, Modality } from "@google/genai";
import { logger } from "./logger";
import type { MusicBrief } from "./types";

const LYRIA_MODEL = "lyria-3-clip-preview";

function base64ToUint8Array(b64: string): Uint8Array {
  const normalized = b64.replace(/\s/g, "");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function extractMime(parts: unknown[] | undefined, fallback: string): string {
  if (!parts) return fallback;
  for (const p of parts as { inlineData?: { mimeType?: string } }[]) {
    if (p.inlineData?.mimeType) return p.inlineData.mimeType;
  }
  return fallback;
}

async function collectFromStream(stream: AsyncIterable<any>): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  let acc = "";
  let mimeType = "audio/wav";
  for await (const chunk of stream) {
    // Always walk `parts` directly — avoids the SDK `.data` getter which logs
    // a noisy warning when the response contains mixed text + audio parts.
    const parts = chunk.candidates?.[0]?.content?.parts as { inlineData?: { data?: string; mimeType?: string } }[] | undefined;
    mimeType = extractMime(parts, mimeType);
    if (parts) {
      for (const p of parts) {
        if (p.inlineData?.data) acc += p.inlineData.data.replace(/\s/g, "");
        if (p.inlineData?.mimeType) mimeType = p.inlineData.mimeType;
      }
    }
  }
  if (acc) return { bytes: base64ToUint8Array(acc), mimeType };
  return null;
}

async function collectFromSingle(response: any): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  // Walk `parts` directly — same reason as collectFromStream above.
  const parts = response.candidates?.[0]?.content?.parts as { inlineData?: { data?: string; mimeType?: string } }[] | undefined;
  let mimeType = extractMime(parts, "audio/wav");
  let acc = "";
  if (parts) for (const p of parts) {
    if (p.inlineData?.data) acc += p.inlineData.data.replace(/\s/g, "");
    if (p.inlineData?.mimeType) mimeType = p.inlineData.mimeType;
  }
  if (acc) return { bytes: base64ToUint8Array(acc), mimeType };
  return null;
}

const MODALITIES = [Modality.TEXT, Modality.AUDIO];

function buildMusicPrompt(style: string, brief?: MusicBrief): string {
  if (brief?.weightedPrompts.length) {
    const tags = brief.weightedPrompts.map((p) => p.text).join(', ');
    const configHints: string[] = [];
    if (brief.config?.bpm) configHints.push(`${brief.config.bpm} BPM`);
    if (brief.config?.scale && brief.config.scale !== 'SCALE_UNSPECIFIED') {
      configHints.push(brief.config.scale.replace(/_/g, ' ').toLowerCase());
    }
    const configStr = configHints.length ? ` (${configHints.join(', ')})` : '';
    return `Generate a 30-second atmospheric soundtrack. Genre and instrumentation: ${tags}${configStr}. Context: ${style}. Instrumental only, no vocals.`;
  }
  return `Generate a 30-second atmospheric soundtrack. Style: ${style}. Cinematic, lo-fi, emotional, instrumental.`;
}

export async function generateNewMusic(style: string, brief?: MusicBrief): Promise<{ audioUrl: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });

  const logId = logger.log("Composer", "Synthesizing 30s atmosphere…", style);

  try {
    const contents = [{
      role: "user" as const,
      parts: [{ text: buildMusicPrompt(style, brief) }],
    }];
    const config = { responseModalities: MODALITIES };

    const stream = await ai.models.generateContentStream({ model: LYRIA_MODEL, contents, config });
    let collected = await collectFromStream(stream);

    if (!collected || collected.bytes.length === 0) {
      const response = await ai.models.generateContent({ model: LYRIA_MODEL, contents, config });
      collected = await collectFromSingle(response);
    }

    if (!collected || collected.bytes.length === 0) throw new Error("No audio data generated");

    const blob = new Blob([collected.bytes.slice()], { type: collected.mimeType });
    const audioUrl = URL.createObjectURL(blob);

    logger.update(logId, { status: "done", result: { status: "30s clip ready" } });
    return { audioUrl };
  } catch (err) {
    logger.update(logId, { status: "failed", detail: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
