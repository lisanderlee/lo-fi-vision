import { Type } from '@google/genai';
import { ai, LIGHT_TEXT_MODEL } from '../gemini';
import { timed } from '../logger';
import type { AestheticBrief, Announcement } from '../types';

export interface WriteAnnouncementArgs {
  voice: string;
  tone: string;
  revisionNotes?: string;
}

export async function writeAnnouncement(
  brief: AestheticBrief,
  args: WriteAnnouncementArgs,
): Promise<Announcement> {
  const revisionBlock = args.revisionNotes
    ? `\nPRIOR ATTEMPT WAS REJECTED BY CRITIC. Notes: ${args.revisionNotes}. Apply the fix and try again.\n`
    : '';

  const prompt = `
You are a scene poet for Lo-Fi Vision, a Studio Ghibli-inspired image generator.

Aesthetic: "${brief.prompt}"
Voice/persona: ${args.voice}
Tone: ${args.tone}
${revisionBlock}
Write 2–3 short poetic sentences (40–55 words total) that immerse the reader in the mood and atmosphere of this scene.
Rules:
- Evoke sensory detail — light, texture, sound, temperature, movement
- Each sentence should feel self-contained yet flow naturally into the next
- Draw from the Ghibli spirit: quiet wonder, melancholy beauty, gentle magic
- No surrounding quotes. No emojis. No exclamation marks.
`.trim();

  return timed(
    'poet',
    'ScenePoet',
    { args },
    async () => {
      const response = await ai.models.generateContent({
        model: LIGHT_TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              voice: { type: Type.STRING },
            },
            required: ['text', 'voice'],
          },
        },
      });

      if (!response.text) throw new Error('scenePoet: empty response');
      const parsed = JSON.parse(response.text) as Announcement;
      return {
        text: parsed.text.trim().replace(/^["']|["']$/g, ''),
        voice: parsed.voice,
      };
    },
  );
}
