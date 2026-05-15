import { GoogleGenAI } from '@google/genai';

// In local dev, GEMINI_API_KEY is loaded from .env.local by Vite's `loadEnv`
// and inlined into the client bundle via the `define` block in vite.config.ts.
// In AI Studio's deployed Cloud Run runtime, an auto-injected service worker
// intercepts calls to generativelanguage.googleapis.com and forwards them to
// /api-proxy, which overwrites the X-Goog-Api-Key header with the real secret
// from AI Studio Settings -> Secrets. The value baked into the bundle there is
// effectively a placeholder.

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error(
    'GEMINI_API_KEY is not set. Add it to .env.local locally, or to AI Studio Settings -> Secrets in production.',
  );
}

export const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });

// Separate client pinned to the v1alpha surface, where the experimental
// Lyria RealTime music streaming API lives (`live.music.connect`). Kept on
// its own instance so the rest of the app stays on the stable surface and
// only the music pipeline opts in to the experimental version axis.
export const liveAi = new GoogleGenAI({
  apiKey: apiKey ?? '',
  apiVersion: 'v1alpha',
});

// Pro model: reserved for the orchestrator's tool-calling loop, where
// thoughtSignature round-tripping and multi-turn planning quality matter.
export const TEXT_MODEL = 'ajax';

// Lite model: used by every single-turn sub-agent (themeDesigner,
// artDirector prompt writer, weatherPoet, critic, base-reality summary).
// Each of these returns structured JSON via responseSchema, so the schema
// (including enum constraints) still enforces shape/validity — Lite just
// finishes the task much faster.
export const LIGHT_TEXT_MODEL = 'ajax';

// Lyria RealTime model identifier. Streams 16-bit PCM 48 kHz stereo audio
// over a persistent WebSocket session. Marked experimental upstream — wrap
// usage in graceful fallbacks.
export const LIVE_MUSIC_MODEL = 'models/lyria-realtime-exp';

/**
 * Race a promise against a wall-clock timeout.
 * Rejects with an Error whose message includes the timeout duration so
 * callers can distinguish timeouts from other failures in their catch blocks.
 */
export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timed out after ${ms / 1000}s`)),
        ms,
      ),
    ),
  ]);
}
