import { renderImage } from '../services/nanoBanana';
import { timed } from '../logger';
import type { AestheticBrief, ArtworkSpec } from '../types';

export interface GenerateArtworkArgs {
  scene: string;
  style: string;
  aspect_ratio?: '16:9' | '21:9' | '1:1' | '9:16';
  revisionNotes?: string;
}

// Composes a deterministic image prompt from the orchestrator's structured
// args, then renders it via Nano Banana. Earlier versions ran a separate
// Lite-LLM pass to "polish" the prompt, but the orchestrator already hands
// us scene + style + aesthetic, and dropping that pass shaves ~1.5s off
// every shift with no quality loss.
function composeImagePrompt(brief: AestheticBrief, args: GenerateArtworkArgs): string {
  const aestheticLine = brief.prompt
    ? `Aesthetic: ${brief.prompt}.`
    : 'Aesthetic: interpret directly from the attached reference moodboard image.';
  const moodboardLine = brief.userImage
    ? 'A reference moodboard image is attached. Use it as a visual REFERENCE for palette, materiality, lighting, and atmosphere — do NOT reproduce its subject or composition literally. Generate an original wide cinematic plate that feels like it belongs in the same visual world.'
    : '';
  const revisionLine = args.revisionNotes
    ? `PRIOR ATTEMPT WAS REJECTED BY CRITIC. Notes: ${args.revisionNotes}. Apply the fix and try again.`
    : '';
  return [
    args.scene,
    `Style: ${args.style}.`,
    aestheticLine,
    moodboardLine,
    revisionLine,
    'Wide cinematic background plate. Atmospheric environment. Full-bleed dashboard backdrop. No central subjects. No on-image text or typography. No watermarks. No people staring directly at camera.',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function generateArtwork(
  brief: AestheticBrief,
  args: GenerateArtworkArgs,
): Promise<ArtworkSpec> {
  return timed(
    'art',
    'ArtDirector',
    { args, hasMoodboard: Boolean(brief.userImage) },
    async () => {
      const imagePrompt = composeImagePrompt(brief, args);

      const rendered = await renderImage({
        prompt: imagePrompt,
        aspectRatio: args.aspect_ratio ?? '16:9',
        imageSize: '1K',
        referenceImage: brief.userImage
          ? { base64: brief.userImage.base64, mimeType: brief.userImage.mimeType }
          : undefined,
      });

      return {
        imageUrl: rendered.dataUrl,
        imagePrompt,
        imageBase64: rendered.base64,
        imageMimeType: rendered.mimeType,
      };
    },
    (art) => ({ imagePrompt: art.imagePrompt, mimeType: art.imageMimeType }),
  );
}
