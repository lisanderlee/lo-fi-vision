import { GoogleGenAI, Modality } from "@google/genai";
import { logger } from "./logger";

const LYRIA_MODEL = "lyria-3-clip-preview";

function base64ToUint8Array(b64: string): Uint8Array {
  const normalized = b64.replace(/\s/g, "");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function extractMimeFromParts(parts: unknown[] | undefined, fallback: string): string {
  if (!parts) return fallback;
  for (const part of parts as { inlineData?: { mimeType?: string } }[]) {
    if (part.inlineData?.mimeType) return part.inlineData.mimeType;
  }
  return fallback;
}

async function collectAudioFromStream(
  stream: AsyncIterable<any>
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const binaryPieces: Uint8Array[] = [];
  let base64Accumulator = "";
  let mimeType = "audio/wav";

  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts as
      | { inlineData?: { data?: string; mimeType?: string } }[]
      | undefined;
    mimeType = extractMimeFromParts(parts, mimeType);

    // Prefer SDK helper per chunk: aggregates inline audio for this SSE message.
    if (chunk.data) {
      binaryPieces.push(base64ToUint8Array(chunk.data));
    } else if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          base64Accumulator += part.inlineData.data.replace(/\s/g, "");
        }
      }
    }
  }

  if (binaryPieces.length > 0) {
    return { bytes: concatUint8(binaryPieces), mimeType };
  }
  if (base64Accumulator) {
    return { bytes: base64ToUint8Array(base64Accumulator), mimeType };
  }
  return null;
}

async function collectAudioFromSingleResponse(response: any): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const parts = response.candidates?.[0]?.content?.parts as
    | { inlineData?: { data?: string; mimeType?: string } }[]
    | undefined;
  let mimeType = extractMimeFromParts(parts, "audio/wav");

  if (response.data) {
    return { bytes: base64ToUint8Array(response.data), mimeType };
  }

  let acc = "";
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) acc += part.inlineData.data.replace(/\s/g, "");
      if (part.inlineData?.mimeType) mimeType = part.inlineData.mimeType;
    }
  }
  if (acc) {
    return { bytes: base64ToUint8Array(acc), mimeType };
  }
  return null;
}

/** Lyria often requires at least TEXT alongside AUDIO on the Gemini API. */
const LYRIA_RESPONSE_MODALITIES = [Modality.TEXT, Modality.AUDIO];

function buildContents(style: string) {
  const text = `Generate a 30-second atmospheric soundtrack. Style: ${style}. Cinematic, lo-fi, emotional, instrumental.`;
  return [
    {
      role: "user" as const,
      parts: [{ text }],
    },
  ];
}

export async function generateNewMusic(style: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });

  const logId = logger.log("Music Agent", "Synthesizing new atmosphere...", style);

  try {
    const contents = buildContents(style);
    const config = { responseModalities: LYRIA_RESPONSE_MODALITIES };

    const stream = await ai.models.generateContentStream({
      model: LYRIA_MODEL,
      contents,
      config,
    });

    let collected = await collectAudioFromStream(stream);

    if (!collected || collected.bytes.length === 0) {
      const response = await ai.models.generateContent({
        model: LYRIA_MODEL,
        contents,
        config,
      });
      collected = await collectAudioFromSingleResponse(response);
    }

    if (!collected || collected.bytes.length === 0) {
      throw new Error("No audio data generated");
    }

    const blob = new Blob([collected.bytes.slice()], { type: collected.mimeType });
    const audioUrl = URL.createObjectURL(blob);

    const result = {
      tempo: "Moderato",
      mood: "Atmospheric",
      instruments: ["Soloist Piano", "Synth Pad", "Ambient Nature"],
      audioUrl,
      status: "Audio stream ready and synced",
    };

    logger.update(logId, { status: "done", result });
    return result;
  } catch (err) {
    logger.update(logId, {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
