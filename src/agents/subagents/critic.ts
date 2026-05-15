import { Type } from '@google/genai';
import { ai, LIGHT_TEXT_MODEL, withTimeout } from '../gemini';
import { timed } from '../logger';
import type {
  AestheticBrief,
  Announcement,
  ArtworkSpec,
  AudioSpec,
  Critique,
  ThemeSpec,
  ToolName,
} from '../types';

export interface CritiqueInputs {
  brief: AestheticBrief;
  theme?: ThemeSpec;
  artwork?: ArtworkSpec;
  announcement?: Announcement;
  audio?: AudioSpec;
}

const REVISABLE: ToolName[] = [
  'design_theme',
  'generate_artwork',
  'write_announcement',
  'compose_audio',
];

export async function critique(inputs: CritiqueInputs): Promise<Critique> {
  // Strip large binary payloads before stringifying. The artwork's
  // imageBase64 alone could push the prompt past Gemini's 1,048,576-token
  // input cap; the audio side is now a small MusicBrief (no PCM bytes), so
  // we can hand the whole thing to the critic — it's actually richer signal
  // than the old "vibe string" was, since the brief lists the weighted
  // prompts the live session will be steered with.
  const present = {
    theme:        !!inputs.theme,
    artwork:      !!inputs.artwork,
    announcement: !!inputs.announcement,
    audio:        !!inputs.audio,
  };
  const missingKeys = (Object.keys(present) as (keyof typeof present)[]).filter(k => !present[k]);

  const summary = JSON.stringify(
    {
      prompt: inputs.brief.prompt,
      theme: inputs.theme,
      artwork: inputs.artwork
        ? { imagePrompt: inputs.artwork.imagePrompt }
        : undefined,
      announcement: inputs.announcement,
      audio: inputs.audio
        ? {
            vibe: inputs.audio.vibe,
            musicBrief: inputs.audio.musicBrief,
          }
        : undefined,
    },
    null,
    2,
  );

  const missingNote = missingKeys.length
    ? `\nNOTE: The following artifacts failed to generate and are absent from the summary: ${missingKeys.join(', ')}. Skip any axis that depends solely on an absent artifact — do not penalise the composition for it.\n`
    : '';

  const prompt = `
You are the critic for a Lo-Fi Vision scene composition.

Brief and produced artifacts:
${summary}
${missingNote}
Score the composition on FOUR axes. Be specific in \`notes\` about which axis (if any) is failing.

1. TONE MATCH — does the composition honor the user's prompt?

2. CROSS-ARTIFACT COHESION — do the theme, artwork, tagline, and audio feel like the same universe? (e.g. if the tagline is noir, the theme shouldn't be utopian pastel.)

3. THEME / ARTWORK HARMONY — this is the most common failure mode. The scene renders the artwork at the back, then stacks (in order): --bg-tint (gradient wash), --bg-backdrop (a flat --bg-color sheet with opacity --backdrop-opacity + 16px blur), --bg-vignette, and a grain layer. Concretely:
   - If --backdrop-opacity is above ~0.55, the artwork is effectively invisible. That's a fail unless the theme literally intends a flat-color universe (rare).
   - If --bg-color is tonally OPPOSED to the artwork's imagePrompt (e.g. theme picks a near-black --bg-color but the imagePrompt describes a bright pastel morning sky, or vice versa), the two will fight even at lower opacities. That's a fail.
   - Reading the imagePrompt is enough to estimate the artwork's tone (light/dark, warm/cool, saturated/muted). Read the cssVariables to get --bg-color and --backdrop-opacity.
   - If THEME / ARTWORK HARMONY is failing, recommend revising design_theme (not generate_artwork) — the theme is cheaper to redo and the orchestrator can hint the right tonal direction.

4. ACCESSIBILITY — does the theme look like it would meet WCAG AA contrast (4.5:1) for body text on background and button label on button?

Decide:
- "approve" if all four axes are reasonable. The bar is "ship it, this works," not "this is perfect."
- "revise" if at most one or two focused revisions would clearly fix a real problem. Cap your revise list at TWO entries.

Allowed revise entries: ${REVISABLE.join(', ')}.

Return JSON only.
`.trim();

  return timed(
    'critic',
    'Critic',
    { brief: inputs.brief.prompt, hasArtifacts: present },
    async () => {
      // Inner timeout slightly tighter than the orchestrator's outer 20 s so
      // `timed` always resolves (done/failed) before the outer race fires and
      // leaves the log entry stuck in "running".
      const response = await withTimeout(17_000, ai.models.generateContent({
        model: LIGHT_TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING, enum: ['approve', 'revise'] },
              notes: { type: Type.STRING },
              revise: {
                type: Type.ARRAY,
                items: { type: Type.STRING, enum: REVISABLE },
              },
            },
            required: ['verdict', 'notes', 'revise'],
          },
        },
      }));

      if (!response.text) throw new Error('critic: empty response');
      const parsed = JSON.parse(response.text) as Critique;
      // Defensive filter: keep only known tool names even though the schema
      // has an enum constraint — guards against model schema drift.
      const safeRevise = (parsed.revise ?? [])
        .filter((t): t is ToolName => (REVISABLE as string[]).includes(t))
        .slice(0, 2);
      return {
        verdict: parsed.verdict,
        notes: parsed.notes,
        revise: parsed.verdict === 'approve' ? [] : safeRevise,
      };
    },
  );
}
