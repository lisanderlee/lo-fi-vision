import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

export async function generateNewMusic(style: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });

  const logId = logger.log("Music Agent", "Synthesizing new atmosphere...", style);
  
  try {
    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: `Generate a 30-second atmospheric soundtrack. Style: ${style}. Cinematic, Ghibli-esque, emotional.`,
      config: {
        responseModalities: ["AUDIO"]
      }
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          // Remove potential metadata or whitespace
          audioBase64 += part.inlineData.data.replace(/\s/g, "");
        }
      }
    }

    if (!audioBase64) throw new Error("No audio data generated");

    // Robust base64 decoding
    let binary = "";
    try {
      binary = atob(audioBase64);
    } catch (e) {
      console.error("Audio base64 decode failed:", e);
      // Fallback or retry logic if needed, but for now we throw more descriptively
      throw new Error("Failed to decode audio base64 data");
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const audioUrl = URL.createObjectURL(blob);

    const result = {
      tempo: "Moderato",
      mood: "Atmospheric",
      instruments: ["Soloist Piano", "Synth Pad", "Ambient Nature"],
      audioUrl,
      status: "Audio stream ready and synced"
    };
    
    logger.update(logId, { status: "done", result });
    return result;
  } catch (err) {
    logger.update(logId, { status: "failed", detail: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
