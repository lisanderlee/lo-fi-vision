import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";
import { MultiverseState } from "./types";
import { generateNewMusic } from "./music";

export async function orchestrateMultiverse(prompt: string, currentState: MultiverseState): Promise<MultiverseState> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in environment');
  const ai = new GoogleGenAI({ apiKey });
  
  const logId = logger.log("Orchestrator", "Analyzing multiverse shift...", prompt);
  
  try {
    const stateForPrompt = { ...currentState };
    delete (stateForPrompt as any).backgroundImage;
    delete (stateForPrompt as any).audioUrl;

    const systemPrompt = `
      You are the Lyria Multiverse Orchestrator. 
      Your job is to translate a user's aesthetic prompt into a complete UI redesign for "Ghibli Vision", a YouTube-style app.
      
      You must return a JSON object with:
      - cssVariables: A string of CSS variables to inject into :root. Focus on:
        --bg-color: main background
        --text-color: main text
        --accent-color: primary buttons and icons
        --accent-color-2: secondary highlights
        --card-bg: container backgrounds
        --ui-radius: e.g. "8px" or "24px"
        --card-shadow: e.g. "0 4px 12px rgba(0,0,0,0.1)"
      - motionPreset: one of ["none", "scanlines", "flicker", "drift", "rain", "ember", "dust"]
      - tone: A poetic description of the current reality's mood.
      - musicStyle: Description of the "generated" soundtrack (e.g. "Lo-fi Ghibli beats with heavy rain").
      - backgroundPrompt: A detailed image generation prompt for a wide (16:9) background artwork that matches the vibe.
      - contrastCheck: One of ["light", "dark"] indicating the brightness of the generated background so the UI can adjust.

      Multiverse Rules:
      1. Contrast Intelligence: If the background is dark/busy, ensure --text-color is light and containers are semi-transparent.
      2. Ghibli Essence: Every redesign must feel like a specific Ghibli world (Laputa, Totoro, Mononoke, Howl).

      Current State (Abstract): ${JSON.stringify(stateForPrompt)}
      User Prompt: "${prompt}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
    });
    
    let text = "";
    try {
      text = response.text;
    } catch (e) {
      if (response.candidates && response.candidates[0].content.parts[0].text) {
        text = response.candidates[0].content.parts[0].text;
      }
    }
    
    if (!text) throw new Error("No text returned from Gemini");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response: " + text);
    
    let newState = JSON.parse(jsonMatch[0]);

    // Handle Background Generation
    if (newState.backgroundPrompt) {
      const bgImageId = logger.log("Artist Agent", "Painting background atmosphere...", newState.backgroundPrompt);
      try {
        const bgResult = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [{ parts: [{ text: newState.backgroundPrompt + ", Studio Ghibli style, ultra wide, cinematic background, soft focus" }] }],
          config: { imageConfig: { aspectRatio: "16:9" } },
        });

        const bgCandidates = bgResult.candidates;
        if (bgCandidates && bgCandidates.length > 0) {
          for (const part of bgCandidates[0].content.parts) {
            if (part.inlineData) {
              newState.backgroundImage = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }
        if (!newState.backgroundImage) throw new Error("Artist returned no image data.");
        logger.update(bgImageId, { status: "done" });
      } catch (e) {
        logger.update(bgImageId, { status: "failed", detail: "Artist was unavailable: " + String(e) });
      }
    }
    
    // Trigger music agent
    if (newState.musicStyle) {
      const musicResult = await generateNewMusic(newState.musicStyle);
      if (musicResult?.audioUrl) {
        newState.audioUrl = musicResult.audioUrl;
      }
    }

    logger.update(logId, { status: "done", result: newState });
    return { ...currentState, ...newState };
  } catch (err) {
    logger.update(logId, { status: "failed", detail: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
