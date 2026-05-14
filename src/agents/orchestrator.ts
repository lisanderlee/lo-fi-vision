import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";
import { MultiverseState } from "./types";
import { generateNewMusic } from "./music";
import { processMultiverseThemeCss } from "./themeContrast";

export async function orchestrateMultiverse(prompt: string, currentState: MultiverseState): Promise<MultiverseState> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in environment');
  const ai = new GoogleGenAI({ apiKey });
  
  const logId = logger.log("Orchestrator", "Analyzing multiverse shift...", prompt);
  
  try {
    const stateForPrompt: Partial<MultiverseState> = { ...currentState };
    delete (stateForPrompt as any).backgroundImage;
    delete (stateForPrompt as any).audioUrl;
    delete (stateForPrompt as any).cssVariables;

    const systemPrompt = `
You are a senior product UI designer and color-systems expert (Lyria Multiverse Orchestrator).
Translate the user's aesthetic into a complete **content-area** theme for "Lo-Fi Vision" (YouTube-like layout). Do not try to theme the global top bar or side intelligence panel—only the tokens below affect sidebar + main content.

You are **not** given the previous CSS variable string—each shift must produce a **fresh** palette and typography pairing from the user prompt and contrastCheck (do not assume fonts or colors stayed the same as last time).

Return a single JSON object with:
- cssVariables: A string of semicolon-terminated CSS custom properties for :root. MUST include every key below with valid values:
  --bg-color, --text-color, --card-bg, --accent-color, --accent-color-2, --btn-bg, --btn-text,
  --ui-radius (e.g. "12px"), --card-shadow (full box-shadow), --divider-color (rgba or hex for hairlines),
  --font-family, --display-font, --heading-font (see Typography section; use EXACT stack strings).
- theme (optional but recommended): an object with the same colors as hex/strings for repair:
  { "bg", "text", "cardBg", "accent", "accent2", "btnBg", "btnText", "uiRadius", "cardShadow", "dividerColor" }
  Keys map to the CSS names above. Hex must include #.

Typography (required — pick ONE full line for each variable; copy exactly, quotes included):

--font-family (UI / body):
  * 'Inter', ui-sans-serif, system-ui, sans-serif
  * 'DM Sans', ui-sans-serif, system-ui, sans-serif
  * 'Nunito', ui-sans-serif, system-ui, sans-serif
  * 'Manrope', ui-sans-serif, system-ui, sans-serif
  * 'Source Sans 3', ui-sans-serif, system-ui, sans-serif

--heading-font (titles, .ghibli-heading — choose a mood fit; pair with UI font):
  * 'Playfair Display', serif
  * 'Libre Baskerville', serif
  * 'Fraunces', serif
  * 'Cormorant Garamond', serif
  * 'Spectral', serif
  * 'Lora', serif
  * 'Crimson Pro', serif

--display-font (secondary / poetic labels — often a refined serif; may match heading-font):
  * 'Libre Baskerville', serif
  * 'Cormorant Garamond', serif
  * 'Spectral', serif
  * 'Lora', serif
  * (or same stack as --heading-font when appropriate)

Never invent font names outside this list. Prefer pairings that match the Ghibli-world mood.

Also include:
- motionPreset: one of ["none", "scanlines", "flicker", "drift", "rain", "ember", "dust"]
- tone: short poetic mood line
- musicStyle: soundtrack description for Lyria
- backgroundPrompt: detailed 16:9 Ghibli background art prompt
- contrastCheck: "light" or "dark" — expected brightness of that background art

Designer rules (non-negotiable):
1. contrastCheck === "light" → --text-color must read clearly on warm OR cool tinted backgrounds — use muted ink, deep plum-teal, forest, burnt umber, or blue-gray as fits the scene (not only brown). --card-bg should read as a distinct surface vs --bg-color.
2. contrastCheck === "dark" → --text-color can be moonlit ivory, pale sage, soft peach, or misty blue-white; --card-bg solid or high-opacity surfaces (#151822, #1a2332, rgba) so text never floats on glass alone.
3. Body text must stay readable (~4.5:1 vs --bg-color and vs --card-bg after any automation). Never put --text-color and --bg-color both at ~white or both at ~black.
4. --btn-text vs --btn-bg must be a bold, readable button pair.
5. **Color creativity:** vary hue families across worlds — twilight indigo + copper, dawn coral + slate, moss + ochre, sakura pink + charcoal, storm teal + sand, etc. Accents (--accent-color, --accent-color-2) should feel clearly different from each other and from the background.
6. Ghibli essence is mood and hand-crafted warmth, not "always beige + forest green" — borrow palette variety from Spirited Away markets, Mononoke forests, Ponyo seas, Howl's skies, etc.

Before returning JSON, mentally verify: text on bg OK, text on card OK, button pair OK, accents distinct.

Current State (abstract): ${JSON.stringify(stateForPrompt)}
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

    const repairedCss = processMultiverseThemeCss({
      cssVariables: typeof newState.cssVariables === "string" ? newState.cssVariables : "",
      theme: newState.theme,
    });
    newState.cssVariables = repairedCss;
    delete newState.theme;

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

