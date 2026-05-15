import { Type } from '@google/genai';
import { ai, LIGHT_TEXT_MODEL, withTimeout } from '../gemini';
import { timed } from '../logger';
import type {
  AestheticBrief,
  AudioSpec,
  MusicBrief,
  MusicMode,
  MusicScale,
} from '../types';

// The composer plans a *music brief*
// — a set of weighted text prompts plus an optional generation config —
// that the UI feeds into a Lyria RealTime session for a continuous,
// never-looping ambient stream. Wrapped in a try/catch so safety-blocks
// or structured-output failures degrade to vibe-only (silence) rather
// than tanking the whole reality shift.

export interface ComposeAudioArgs {
  mood: string;
  tempo?: string;
  instrumentation?: string;
  revisionNotes?: string;
}

const SCALES: MusicScale[] = [
  'SCALE_UNSPECIFIED',
  'C_MAJOR_A_MINOR',
  'D_FLAT_MAJOR_B_FLAT_MINOR',
  'D_MAJOR_B_MINOR',
  'E_FLAT_MAJOR_C_MINOR',
  'E_MAJOR_D_FLAT_MINOR',
  'F_MAJOR_D_MINOR',
  'G_FLAT_MAJOR_E_FLAT_MINOR',
  'G_MAJOR_E_MINOR',
  'A_FLAT_MAJOR_F_MINOR',
  'A_MAJOR_G_FLAT_MINOR',
  'B_FLAT_MAJOR_G_MINOR',
  'B_MAJOR_A_FLAT_MINOR',
];

const MODES: MusicMode[] = ['QUALITY', 'DIVERSITY', 'VOCALIZATION'];

export async function composeAudio(
  brief: AestheticBrief,
  args: ComposeAudioArgs,
): Promise<AudioSpec> {
  return timed('audio', 'Composer', { args }, async () => {
    const vibe = [args.mood, args.tempo, args.instrumentation]
      .filter(Boolean)
      .join(', ');

    const plannerPrompt = buildPlannerPrompt(brief, args, vibe);

    const response = await withTimeout(30_000, ai.models.generateContent({
      model: LIGHT_TEXT_MODEL,
      contents: plannerPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weightedPrompts: {
              type: Type.ARRAY,
              description:
                'Exactly TWO short prompts: [0] a hyper-specific decade+region+genre tag (e.g. "1970s French Disco", "1990s Detroit Techno"), [1] a single instrument name. Both at weight 1.0 (Lyria normalizes; equal weights keep both signals at full strength).',
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  weight: { type: Type.NUMBER },
                },
                required: ['text', 'weight'],
              },
            },
            config: {
              type: Type.OBJECT,
              description:
                'Optional generation knobs. Omit any field you do not have a strong opinion about.',
              properties: {
                bpm: { type: Type.NUMBER },
                density: { type: Type.NUMBER },
                brightness: { type: Type.NUMBER },
                guidance: { type: Type.NUMBER },
                temperature: { type: Type.NUMBER },
                scale: { type: Type.STRING, enum: SCALES },
                musicGenerationMode: { type: Type.STRING, enum: MODES },
                muteBass: { type: Type.BOOLEAN },
                muteDrums: { type: Type.BOOLEAN },
                onlyBassAndDrums: { type: Type.BOOLEAN },
              },
            },
          },
          required: ['weightedPrompts'],
        },
      },
    }));

    if (!response.text) throw new Error('composer: empty plan response');
    const parsed = JSON.parse(response.text) as MusicBrief;
    const cleaned = sanitize(parsed);
    if (cleaned.weightedPrompts.length === 0) {
      throw new Error('composer: planner returned no usable prompts');
    }
    return { vibe, musicBrief: cleaned };
  });
}

// Curated phrase vocabularies that Lyria RealTime was trained on. Anchoring
// the planner to these strings is the single biggest quality win: Lyria has
// strong, specific embeddings for each phrase, so it produces music that
// recognizably matches the universe instead of an "abstract" interpolation.
// Sourced from https://ai.google.dev/gemini-api/docs/realtime-music-generation.
const LYRIA_GENRES = [
  'Acid Jazz', 'Afrobeat', 'Alternative Country', 'Baroque', 'Bengal Baul',
  'Bhangra', 'Bluegrass', 'Blues Rock', 'Bossa Nova', 'Breakbeat',
  'Celtic Folk', 'Chillout', 'Chiptune', 'Classic Rock', 'Contemporary R&B',
  'Cumbia', 'Deep House', 'Disco Funk', 'Drum & Bass', 'Dubstep', 'EDM',
  'Electro Swing', 'Funk Metal', 'G-funk', 'Garage Rock', 'Glitch Hop',
  'Grime', 'Hyperpop', 'Indian Classical', 'Indie Electronic', 'Indie Folk',
  'Indie Pop', 'Irish Folk', 'Jam Band', 'Jamaican Dub', 'Jazz Fusion',
  'Latin Jazz', 'Lo-Fi Hip Hop', 'Marching Band', 'Merengue',
  'New Jack Swing', 'Minimal Techno', 'Moombahton', 'Neo-Soul',
  'Orchestral Score', 'Piano Ballad', 'Polka', 'Post-Punk',
  '60s Psychedelic Rock', 'Psytrance', 'R&B', 'Reggae', 'Reggaeton',
  'Renaissance Music', 'Salsa', 'Shoegaze', 'Ska', 'Surf Rock', 'Synthpop',
  'Techno', 'Trance', 'Trap Beat', 'Trip Hop', 'Vaporwave', 'Witch House',
].join(', ');

const LYRIA_INSTRUMENTS = [
  '303 Acid Bass', '808 Hip Hop Beat', 'Accordion', 'Alto Saxophone',
  'Bagpipes', 'Balalaika Ensemble', 'Banjo', 'Bass Clarinet', 'Bongos',
  'Boomy Bass', 'Bouzouki', 'Buchla Synths', 'Cello', 'Charango',
  'Clavichord', 'Conga Drums', 'Didgeridoo', 'Dirty Synths', 'Djembe',
  'Drumline', 'Dulcimer', 'Fiddle', 'Flamenco Guitar', 'Funk Drums',
  'Glockenspiel', 'Guitar', 'Hang Drum', 'Harmonica', 'Harp', 'Harpsichord',
  'Hurdy-gurdy', 'Kalimba', 'Koto', 'Lyre', 'Mandolin', 'Maracas', 'Marimba',
  'Mbira', 'Mellotron', 'Metallic Twang', 'Moog Oscillations', 'Ocarina',
  'Persian Tar', 'Pipa', 'Precision Bass', 'Ragtime Piano', 'Rhodes Piano',
  'Shamisen', 'Shredding Guitar', 'Sitar', 'Slide Guitar', 'Smooth Pianos',
  'Spacey Synths', 'Steel Drum', 'Synth Pads', 'Tabla', 'TR-909 Drum Machine',
  'Trumpet', 'Tuba', 'Vibraphone', 'Viola Ensemble', 'Warm Acoustic Guitar',
  'Woodwinds',
].join(', ');

const LYRIA_MOODS = [
  'Acoustic Instruments', 'Ambient', 'Bright Tones', 'Chill',
  'Crunchy Distortion', 'Danceable', 'Dreamy', 'Echo', 'Emotional',
  'Ethereal Ambience', 'Experimental', 'Fat Beats', 'Funky',
  'Glitchy Effects', 'Huge Drop', 'Live Performance', 'Lo-fi',
  'Ominous Drone', 'Psychedelic', 'Rich Orchestration', 'Saturated Tones',
  'Subdued Melody', 'Sustained Chords', 'Swirling Phasers', 'Tight Groove',
  'Unsettling', 'Upbeat', 'Virtuoso', 'Weird Noises',
].join(', ');

function buildPlannerPrompt(
  brief: AestheticBrief,
  args: ComposeAudioArgs,
  vibe: string,
): string {
  const tempo = args.tempo ? ` ${args.tempo}` : '';
  const instr = args.instrumentation ? `, ${args.instrumentation}` : '';
  const revisionBlock = args.revisionNotes
    ? `\nPRIOR ATTEMPT WAS REJECTED BY CRITIC. Notes: ${args.revisionNotes}. Apply the fix and try again.\n`
    : '';
  return `You are scoring a continuously-streamed soundtrack for a
Lo-Fi Vision scene using Lyria RealTime.

Aesthetic universe: ${brief.prompt}.
Director's vibe brief — Mood:${tempo} ${args.mood}${instr}.
One-line vibe summary: ${vibe}.${revisionBlock}

Plan a Lyria RealTime "music brief" that the UI will stream while the
user explores this universe.

# Composition — exactly TWO prompts, both at weight 1.0

Emit exactly TWO weightedPrompts, both with weight 1.0. Lyria normalizes,
so equal weights keep both signals at full strength — a co-equal pair
sounds dramatically more on-brand than a weighted lead/supporting mix.

[0] GENRE TAG — be HYPER-SPECIFIC. Combine decade + region/scene + genre
    into a single phrase. Lyria's training has strong embeddings for
    these specific era-tagged tags, much stronger than for generic genre
    names. Examples of the shape you want:
      "1970s French Disco"
      "1990s Detroit Techno"
      "1985 Memphis Hi-NRG"
      "Late 60s Lounge Bossa Nova"
      "1982 Vangelis-style Synthwave Score"
      "Contemporary Reykjavík Ambient"
      "1930s Parisian Cabaret"
      "Early 2000s Berlin Minimal Techno"
      "1960s Ethio-Jazz"
      "1990s Bristol Trip-Hop"
    The fallback list below is a SAFETY NET. Only fall back to a generic
    tag from it if no specific era+region+genre construction fits.

[1] INSTRUMENT NAME — a single instrument. Be specific when you can
    ("Roland TR-808" rather than "Drum Machine"; "Fender Rhodes" rather
    than "Rhodes Piano"; "Roland Juno-60" for vintage synth). The
    INSTRUMENTS list below is a strong starting point.

# Hard rules

- No vocals. The dashboard plays an in-universe announcement; competing
  vocals would clash.
- No sound effects, foley, or field recordings. Lyria RealTime is a
  music model, not an SFX engine — it has no embedding for "rain",
  "thunder", "wind", "footsteps", "crowd noise", etc. Reach for a
  musical genre or instrument that EVOKES the atmosphere instead.

# Fallback vocabulary (use only when the specific-tag approach fails)

GENRES: ${LYRIA_GENRES}.

INSTRUMENTS: ${LYRIA_INSTRUMENTS}.

MOODS / DESCRIPTIONS: ${LYRIA_MOODS}.

# Generation config

- guidance (0.0–6.0, DEFAULT 5.5): keep prompt adherence high so the
  music recognizably matches the universe. Push to 6.0 for universes
  with a sharp single-genre identity (cyberpunk, noir, vaporwave,
  baroque, surf rock, techno, reggae, …). Drop to 4.0 ONLY for
  genuinely formless / abstract / experimental universes where you
  want Lyria to wander.
- temperature (0.0–3.0, DEFAULT 1.0): 1.0 for coherent, on-brand output.
  Only push to 1.3+ for chaotic / glitchy / experimental universes that
  should sound unstable. Drop to 0.7 for deliberate, ritualistic
  minimalism.
- bpm (60–200): OMIT BY DEFAULT — Lyria picks an authentic tempo per
  genre, which usually beats anything you'd derive from a vibe cue.
  Only set bpm when the director's tempo cue is EXPLICIT (e.g. "slow",
  "frantic") AND it would meaningfully disagree with the genre's
  natural cadence. When in doubt, omit.
- scale: omit unless the universe has a clear tonal home. Pick a
  minor-leaning scale (A_MAJOR_G_FLAT_MINOR, D_MAJOR_B_MINOR,
  G_MAJOR_E_MINOR) for dark / noir / dystopian; a major-leaning scale
  (C_MAJOR_A_MINOR, F_MAJOR_D_MINOR) for sunny / utopian; otherwise
  SCALE_UNSPECIFIED.
- density / brightness: OMIT BY DEFAULT. Only set for genuine extremes
  (density ≈ 0.85 for frantic, ≈ 0.2 for sparse; brightness ≈ 0.85 for
  sun-drenched, ≈ 0.2 for submerged).
- musicGenerationMode: "QUALITY" unless diversity matters.

Return JSON only.`;
}

// Defensive cleanup before we hand the brief off to the live session:
// drop empty/zero-weight prompts, cap to 4, clamp config ranges to the
// values Lyria RealTime actually accepts.
function sanitize(brief: MusicBrief): MusicBrief {
  const prompts = (brief.weightedPrompts ?? [])
    .filter((p) => p && typeof p.text === 'string' && p.text.trim().length > 0)
    .map((p) => ({
      text: p.text.trim(),
      weight: Number.isFinite(p.weight) && p.weight > 0 ? p.weight : 1.0,
    }))
    .slice(0, 4);

  const cfg = brief.config;
  const cleanedConfig =
    cfg && Object.keys(cfg).length > 0
      ? {
          bpm: clamp(cfg.bpm, 60, 200),
          density: clamp(cfg.density, 0, 1),
          brightness: clamp(cfg.brightness, 0, 1),
          guidance: clamp(cfg.guidance, 0, 6),
          temperature: clamp(cfg.temperature, 0, 3),
          scale: SCALES.includes(cfg.scale as MusicScale) ? cfg.scale : undefined,
          musicGenerationMode: MODES.includes(cfg.musicGenerationMode as MusicMode)
            ? cfg.musicGenerationMode
            : undefined,
          muteBass: typeof cfg.muteBass === 'boolean' ? cfg.muteBass : undefined,
          muteDrums: typeof cfg.muteDrums === 'boolean' ? cfg.muteDrums : undefined,
          onlyBassAndDrums:
            typeof cfg.onlyBassAndDrums === 'boolean' ? cfg.onlyBassAndDrums : undefined,
        }
      : undefined;

  // Drop undefined config fields so we don't ship a noisy object.
  const compactConfig = cleanedConfig
    ? Object.fromEntries(Object.entries(cleanedConfig).filter(([, v]) => v !== undefined))
    : undefined;

  return {
    weightedPrompts: prompts,
    config: compactConfig && Object.keys(compactConfig).length > 0 ? compactConfig : undefined,
  };
}

function clamp(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}
