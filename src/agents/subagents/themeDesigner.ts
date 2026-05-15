import { Type, type Part } from '@google/genai';
import { ai, LIGHT_TEXT_MODEL } from '../gemini';
import { ALL_FONT_FAMILIES } from '../services/googleFonts';
import { logInfo, timed } from '../logger';
import { auditContrast, parseCssVars, WCAG_AA, type ContrastFailure } from '../contrast';
import type {
  AestheticBrief,
  MotionPreset,
  TextRevealStyle,
  ThemeSpec,
  WeatherIconAnimation,
} from '../types';

export interface DesignThemeArgs {
  mood: string;
  palette_hint?: string;
  typography_hint?: string;
  atmosphere_hint?: string;
  revisionNotes?: string;
}

// Optional context the orchestrator can pass in. `allowedFonts` constrains
// the response schema's enum so the model can only request fonts that
// either (a) live in the curated catalog, or (b) were surfaced by a recent
// `list_fonts` tool call this run.
export interface DesignThemeContext {
  allowedFonts?: string[];
}

const MAX_CONTRAST_RETRIES = 1;

const MOTION_PRESETS: MotionPreset[] = [
  'none',
  'scanlines',
  'drift',
  'rain',
  'ember',
  'dust',
];

const ICON_ANIMATIONS: WeatherIconAnimation[] = [
  'none',
  'pulse',
  'drift',
  'sway',
  'shake',
  'glitch',
  'spin',
  'tilt',
];

const TEXT_REVEAL_STYLES: TextRevealStyle[] = [
  'crossfade',
  'typewriter',
  'word-stagger',
  'scramble-decode',
  'slot-roll',
];

// CSS variables the dashboard understands. The model returns one
// semicolon-separated string; sub-agent doesn't validate names individually,
// but every var listed here has a corresponding rule in src/index.css.
const KNOWN_CSS_VARS: ReadonlyArray<{ name: string; description: string }> = [
  { name: '--bg-color', description: 'Page background color.' },
  { name: '--text-color', description: 'Primary text color. Must hit WCAG AA against --bg-color AND against the rendered backdrop (artwork muted by --backdrop-opacity).' },
  { name: '--card-bg', description: 'Dashboard card background. Translucent variants encouraged but body text on it must still hit AA.' },
  { name: '--accent-color', description: 'Primary accent (focus rings, highlights).' },
  { name: '--accent-color-2', description: 'Secondary accent for highlights / secondary CTAs.' },
  { name: '--btn-bg', description: 'Primary button background. May equal --accent-color but does not have to.' },
  { name: '--btn-text', description: 'Primary button label color. MUST hit WCAG AA against --btn-bg.' },
  { name: '--ui-radius', description: 'Card corner radius, e.g. "0", "4px", "24px".' },
  { name: '--card-border', description: 'Full CSS border shorthand for the card, e.g. "1px solid rgba(255,255,255,0.12)".' },
  { name: '--card-shadow', description: 'Full CSS box-shadow for the card. Use bigger/colored shadows for drama.' },
  { name: '--card-backdrop-filter', description: 'Card backdrop-filter, e.g. "blur(12px) saturate(1.4)" or "none".' },
  { name: '--card-rotation', description: 'Subtle rotation of the dashboard card, in degrees with unit. e.g. "-1.5deg" / "0.75deg" / "0deg". Stay under 3deg.' },
  { name: '--backdrop-opacity', description: 'How strongly the flat-color backdrop mutes the artwork. ALLOWED RANGE: 0.15 – 0.55. DEFAULT 0.35. Going above 0.55 hides the generative backdrop entirely — do not do that. For moodier looks, layer color via --bg-tint and darken edges via --bg-vignette instead of cranking this up.' },
  { name: '--bg-tint', description: 'Gradient or image layered on top of the artwork (e.g. "linear-gradient(...)" or "none"). This is the right tool for tinting the artwork warm/cool/dark without hiding it.' },
  { name: '--bg-vignette', description: 'Radial-gradient vignette layered above the backdrop, or "none". Use this to darken edges and focus the eye on the dashboard card.' },
  { name: '--bg-grain-opacity', description: 'Film-grain noise opacity, 0 to 0.4.' },
  { name: '--text-shadow', description: 'Text-shadow on large display text — use for neon glow, embossed feel, etc. "none" by default.' },
  { name: '--font-family', description: 'Body font stack. First entry MUST be a Google Font from the allowed list, then CSS-safe fallbacks.' },
  { name: '--display-font', description: 'Font stack for big numbers + headlines. Can be more dramatic than --font-family.' },
  { name: '--label-font', description: 'Font stack for small uppercase labels. Monospace recommended unless the universe rejects it.' },
];

export async function designTheme(
  brief: AestheticBrief,
  args: DesignThemeArgs,
  ctx: DesignThemeContext = {},
): Promise<ThemeSpec> {
  const allowedFonts = (ctx.allowedFonts && ctx.allowedFonts.length > 0
    ? ctx.allowedFonts
    : ALL_FONT_FAMILIES);

  return timed(
    'theme',
    'ThemeDesigner',
    { args, allowedFontsCount: allowedFonts.length },
    async () => {
      let attempt = 0;
      let contrastFeedback: ContrastFailure[] = [];
      let lastTheme: ThemeSpec | null = null;

      while (attempt <= MAX_CONTRAST_RETRIES) {
        const prompt = buildPrompt(brief, args, contrastFeedback);

        // Multipart user turn: when the user attached a moodboard image,
        // include it as an inlineData Part BEFORE the text so the model
        // grounds palette / materiality extraction in the image first,
        // then reads the instructions. Otherwise it's text-only.
        const userParts: Part[] = [];
        if (brief.userImage) {
          userParts.push({
            inlineData: {
              mimeType: brief.userImage.mimeType,
              data: brief.userImage.base64,
            },
          });
        }
        userParts.push({ text: prompt });

        const response = await ai.models.generateContent({
          model: LIGHT_TEXT_MODEL,
          contents: [{ role: 'user', parts: userParts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
              cssVariables: { type: Type.STRING },
              rationale: { type: Type.STRING },
              motionPreset: { type: Type.STRING, enum: MOTION_PRESETS },
              weatherIconAnimation: { type: Type.STRING, enum: ICON_ANIMATIONS },
              textRevealStyle: { type: Type.STRING, enum: TEXT_REVEAL_STYLES },
              googleFonts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      family: { type: Type.STRING, enum: allowedFonts },
                      weights: {
                        type: Type.ARRAY,
                        items: { type: Type.NUMBER },
                      },
                      italic: { type: Type.BOOLEAN },
                    },
                    required: ['family'],
                  },
                },
              },
              required: [
                'cssVariables',
                'rationale',
                'googleFonts',
                'motionPreset',
                'weatherIconAnimation',
                'textRevealStyle',
              ],
            },
          },
        });

        if (!response.text) throw new Error('themeDesigner: empty response');
        const theme = JSON.parse(response.text) as ThemeSpec;
        lastTheme = theme;

        const vars = parseCssVars(theme.cssVariables);
        const failures = auditContrast(vars);

        if (failures.length === 0) {
          return theme;
        }

        contrastFeedback = failures;
        logInfo(
          'theme',
          'ThemeDesigner',
          `attempt ${attempt + 1}: ${failures.length} contrast failure(s); retrying with feedback`,
          undefined,
          failures,
        );
        attempt += 1;
      }

      // Out of retries — return the last theme but log loudly so we know.
      logInfo(
        'theme',
        'ThemeDesigner',
        `giving up after ${MAX_CONTRAST_RETRIES + 1} attempts; shipping last theme with contrast failures`,
        undefined,
        contrastFeedback,
      );
      return lastTheme as ThemeSpec;
    },
    (theme) => ({
      rationale: theme.rationale,
      motionPreset: theme.motionPreset,
      weatherIconAnimation: theme.weatherIconAnimation,
      textRevealStyle: theme.textRevealStyle,
      fonts: theme.googleFonts?.map((f) => f.family),
      cssVariablesPreview: theme.cssVariables.slice(0, 200),
    }),
  );
}

function buildPrompt(
  brief: AestheticBrief,
  args: DesignThemeArgs,
  contrastFeedback: ContrastFailure[],
): string {
  const cssVarsList = KNOWN_CSS_VARS.map((v) => `- ${v.name} — ${v.description}`).join('\n');
  const motionList = MOTION_PRESETS.join(' | ');
  const iconAnimList = ICON_ANIMATIONS.join(' | ');
  const textRevealList = TEXT_REVEAL_STYLES.join(' | ');

  const feedbackBlock = contrastFeedback.length === 0
    ? ''
    : `
PRIOR ATTEMPT FAILED WCAG CONTRAST. Fix these pairs and try again:
${contrastFeedback
  .map(
    (f) =>
      `- ${f.label}: ${f.fgVar} (${f.fgValue}) on ${f.bgVar} (${f.bgValue}) only reached ${f.ratio.toFixed(2)}:1 (need ${WCAG_AA}:1).`,
  )
  .join('\n')}
Adjust those colors specifically — don't redo unrelated parts of the theme.
`.trim();

  const criticBlock = args.revisionNotes
    ? `\nPRIOR ATTEMPT WAS REJECTED BY CRITIC. Notes: ${args.revisionNotes}. Apply the fix and try again.\n`
    : '';

  const moodboardBlock = brief.userImage
    ? `
A reference moodboard image is attached above. Treat it as a PRIMARY signal:
extract the dominant palette, material qualities (matte / glossy / textured
/ grainy), lighting (warm / cool / high-contrast / soft), and overall mood
directly from the pixels. Let it override generic interpretations of the
prompt — if the prompt says "cozy" but the image is icy and brutalist, lean
the image. The art director sees the same image when generating the backdrop,
so your job is to extract a palette that will HARMONIZE with an artwork made
in the moodboard's visual register.
`.trim()
    : '';

  return `
You are the theme designer for a Lo-Fi Vision scene.

Aesthetic prompt from the user: ${brief.prompt ? `"${brief.prompt}"` : '(none — infer from the attached moodboard image)'}
Mood from creative director: "${args.mood}"
${args.palette_hint ? `Palette hint: ${args.palette_hint}` : ''}
${args.typography_hint ? `Typography hint: ${args.typography_hint}` : ''}
${args.atmosphere_hint ? `Atmosphere hint: ${args.atmosphere_hint}` : ''}
${moodboardBlock}
${criticBlock}

Produce a single string of CSS variable declarations (semicolon separated, no \`:root {}\` wrapper) covering ALL of these variables:

${cssVarsList}

The dashboard renders these foreground/background pairs that ALL must hit WCAG AA contrast (4.5:1):
- --text-color on --bg-color (body text on page)
- --text-color on --card-bg (text inside dashboard card)
- --btn-text on --btn-bg (button label on primary button)

The "Return to Base Reality" button uses --btn-bg / --btn-text — pick those colors so the label reads clearly. They do NOT have to match the rest of the palette.

Also pick a motionPreset from: ${motionList}.
Each preset adds an ambient BACKGROUND animation behind the dashboard:
- "scanlines" — animated horizontal CRT scan lines
- "flicker" — subtle neon-sign flicker
- "drift" — gentle floating motion
- "rain" — animated diagonal rain streaks
- "ember" — slow-rising glowing particles
- "dust" — slow-drifting dust motes
- "none" — no ambient motion
Pair the preset to the universe by feel, not by obvious match.

ALSO pick a weatherIconAnimation from: ${iconAnimList}.
This is a FOREGROUND character tic applied to the small weather glyph
(cloud / sun / rain icon) in the dashboard header — it's a personality
moment, separate from motionPreset's background effect. Both compose, so
you can have e.g. "scanlines" stage + "glitch" icon, or "ember" stage +
"pulse" icon.
- "pulse" — gentle scale-breathing (ambient, sci-fi, AI, meditative)
- "drift" — slow vertical float (dreamy, Ghibli, underwater, soft)
- "sway" — pendulum rotation (cinematic, melancholic, folk, nautical)
- "shake" — tight jitter (noir, horror, urgent, dystopian)
- "glitch" — discrete jumps + flickers (cyberpunk, glitch-pop, broken)
- "spin" — slow continuous rotation (psychedelic, hyperpop, surreal)
- "tilt" — playful held-tilt return (Wes Anderson, cartoon, kawaii)
- "none" — static (editorial, minimalist, brutalist)

ALSO pick a textRevealStyle from: ${textRevealList}.
This controls how the multiverse weather-summary paragraph PERFORMS its
arrival on screen. It's the headline narrative beat of the shift, so a
matching cadence sells the universe more than any other detail.
- "crossfade" — plain fade-in (clean, editorial, minimalist)
- "typewriter" — character-by-character reveal with a blinking caret
   (terminal, sci-fi, noir, hacker, command-line)
- "word-stagger" — words ease in one-after-another (literary, Wes
   Anderson, NYT magazine, romantic, dreamy)
- "scramble-decode" — chars cycle through random glyphs and settle into
   place (cyberpunk, glitch, hacker-thriller, codebreaking, alien)
- "slot-roll" — characters fall in vertically like slot reels landing
   (hyperpop, retro Vegas, game-show, playful, kinetic-typography)
Pick the reveal style that fits the universe's RHYTHM — fast and jittery
universes deserve scramble or slot-roll; slow, atmospheric ones deserve
typewriter or word-stagger; minimalist ones deserve crossfade.

Rules:
- --font-family, --display-font, and --label-font must each begin with one of the allowed Google Fonts, followed by CSS-safe fallbacks (e.g. "ui-sans-serif, system-ui, sans-serif" / "ui-serif, Georgia, serif" / "ui-monospace, SFMono-Regular, monospace").
- Be opinionated. Pick atmospheric overlays + a motion preset that reinforce the universe. Don't default everything to "none" unless it really fits.
- Subtle card-rotation (e.g. "-1.5deg") adds character for skewed/playful universes; keep it 0 for editorial / serious ones.
- CRITICAL — preserve the artwork. The ArtDirector is generating a backdrop image in parallel with you, and the dashboard layers your color overlays on top of it. KEEP --backdrop-opacity between 0.15 and 0.55. The user paid compute for that image; never erase it. If you need a darker / moodier look, that's what --bg-tint (color wash) and --bg-vignette (edge darkening) are for. Pick a --bg-color that will HARMONIZE with the artwork visible behind it, not fight it.

Then list each Google Font you used in \`googleFonts\`, with weights you actually need (default [400, 700] is fine).

Also produce a one-sentence rationale for your overall direction.

${feedbackBlock}
`.trim();

}
