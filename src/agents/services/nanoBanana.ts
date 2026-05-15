import { type Part } from '@google/genai';
import { ai } from '../gemini';
import { timed } from '../logger';

// Wrapper around Gemini's image generation model (Nano Banana Pro). Returns a
// data URL plus raw base64 + mime so downstream sub-agents (Stage 4 composer)
// can hand the image off as a multimodal reference.

export interface RenderImageOptions {
  prompt: string;
  aspectRatio?: '16:9' | '21:9' | '1:1' | '9:16';
  imageSize?: '1K' | '2K' | '4K';
  // Stage 3 plan calls this out as feature-flagged; off by default.
  useSearchGrounding?: boolean;
  // Optional user-provided moodboard image used as a visual reference. The
  // model is instructed (via the prompt) to read it for color / lighting /
  // texture cues rather than reproduce it literally.
  referenceImage?: { base64: string; mimeType: string };
}

export interface RenderedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

const MODEL = 'gemini-2.5-flash-image';

export async function renderImage(opts: RenderImageOptions): Promise<RenderedImage> {
  const aspectRatio = opts.aspectRatio ?? '16:9';
  // 1K is plenty for a backdrop that gets blurred + colored-overlay'd. 2K
  // roughly tripled wall-clock per shift with no perceptible quality gain.
  const imageSize = opts.imageSize ?? '1K';

  // Build parts: reference image first (when present), then the text
  // prompt. This mirrors Gemini's recommended order for image-grounded
  // tasks and lets us keep `contents` a single user message either way.
  const parts: Part[] = [];
  if (opts.referenceImage) {
    parts.push({
      inlineData: {
        mimeType: opts.referenceImage.mimeType,
        data: opts.referenceImage.base64,
      },
    });
  }
  parts.push({ text: opts.prompt });

  return timed(
    'service',
    'NanoBanana',
    {
      prompt: opts.prompt,
      aspectRatio,
      imageSize,
      hasReferenceImage: Boolean(opts.referenceImage),
    },
    async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio, imageSize },
          ...(opts.useSearchGrounding
            ? { tools: [{ googleSearch: {} }] }
            : {}),
        },
      });

      // Walk every part. Skip thought parts; keep the first inlineData image we
      // see. Models occasionally interleave reasoning before the actual image.
      const responseParts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of responseParts) {
        if (part.thought) continue;
        const inline = part.inlineData;
        if (inline?.data && inline.mimeType?.startsWith('image/')) {
          return {
            dataUrl: `data:${inline.mimeType};base64,${inline.data}`,
            base64: inline.data,
            mimeType: inline.mimeType,
          };
        }
      }

      throw new Error('nanoBanana: no image part returned (possibly safety-blocked).');
    },
    (img) => ({ mimeType: img.mimeType, sizeBytes: img.base64.length }),
  );
}
