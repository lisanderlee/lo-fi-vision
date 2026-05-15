import { logger } from "./logger";
import { withTimeout } from "./gemini";
import { processMultiverseThemeCss } from "./themeContrast";
import { loadGoogleFonts } from "./services/googleFonts";
import { generateNewMusic } from "./music";
import { designTheme } from "./subagents/themeDesigner";
import { generateArtwork } from "./subagents/artDirector";
import { composeAudio } from "./subagents/composer";
import { writeAnnouncement } from "./subagents/weatherPoet";
import { critique } from "./subagents/critic";
import type {
  AestheticBrief,
  ArtworkSpec,
  ThemeSpec,
  Announcement,
  AudioSpec,
  Critique,
  MultiverseState,
  ToolName,
} from "./types";

interface ShiftBundle {
  theme: ThemeSpec;
  artwork: ArtworkSpec;
  audio: AudioSpec;
  announcement: Announcement;
}

async function reviseOnce(
  brief: AestheticBrief,
  bundle: ShiftBundle,
  verdict: Critique,
): Promise<ShiftBundle> {
  const notes = verdict.notes;
  const next = { ...bundle };

  await Promise.allSettled(
    verdict.revise.map(async (tool: ToolName) => {
      try {
        if (tool === "design_theme") {
          next.theme = await designTheme(brief, { mood: brief.prompt, revisionNotes: notes });
        } else if (tool === "generate_artwork") {
          next.artwork = await generateArtwork(brief, {
            scene: brief.prompt,
            style: "Studio Ghibli watercolor",
            revisionNotes: notes,
          });
        } else if (tool === "compose_audio") {
          next.audio = await composeAudio(brief, { mood: brief.prompt, revisionNotes: notes });
        } else if (tool === "write_announcement") {
          next.announcement = await writeAnnouncement(brief, {
            voice: "in-universe narrator",
            tone: brief.prompt,
            revisionNotes: notes,
          });
        }
      } catch (err) {
        // Revision failure is non-fatal — ship the original artifact.
        logger.log(
          "Director",
          `Revision of ${tool} failed, keeping original`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }),
  );

  return next;
}

/**
 * Retry a single named agent and return the slice of MultiverseState it
 * controls. Critic and System are not retryable (return null).
 * Director re-runs the full pipeline.
 */
export async function retryAgent(
  agentName: string,
  prompt: string,
  currentState: MultiverseState,
): Promise<Partial<MultiverseState> | null> {
  const brief: AestheticBrief = { prompt };

  switch (agentName) {
    case 'ThemeDesigner': {
      const theme = await designTheme(brief, { mood: prompt });
      const cssVariables = processMultiverseThemeCss({ cssVariables: theme.cssVariables });
      if (theme.googleFonts) loadGoogleFonts(theme.googleFonts);
      return {
        cssVariables,
        motionPreset:         theme.motionPreset,
        weatherIconAnimation: theme.weatherIconAnimation,
        textRevealStyle:      theme.textRevealStyle,
      };
    }

    case 'ArtDirector': {
      const artwork = await generateArtwork(brief, { scene: prompt, style: 'Studio Ghibli watercolor' });
      return { backgroundImage: artwork.imageUrl };
    }

    case 'Composer': {
      const audio      = await composeAudio(brief, { mood: prompt });
      const musicStyle = audio.vibe ?? prompt;
      const music      = await generateNewMusic(musicStyle);
      return { musicStyle, audioUrl: music?.audioUrl ?? currentState.audioUrl };
    }

    case 'ScenePoet': {
      const announcement = await writeAnnouncement(brief, { voice: 'in-universe narrator', tone: prompt });
      return { tone: announcement.text };
    }

    case 'Director': {
      return await orchestrateMultiverse(prompt, currentState);
    }

    default:
      return null;
  }
}

export async function orchestrateMultiverse(
  prompt: string,
  currentState: MultiverseState,
): Promise<MultiverseState> {
  const brief: AestheticBrief = { prompt };
  const orchestratorId = logger.log("Director", "Orchestrating scene shift…", prompt);

  try {
    // Stage 1: run all four specialists in parallel.
    // Timeouts are tuned per agent type: LLM agents settle in ~5s so 25s is
    // ample; image generation typically takes 10–20s so 35s gives headroom.
    const LLM_TIMEOUT_MS   = 25_000;
    const IMAGE_TIMEOUT_MS = 35_000;

    const results = await Promise.allSettled([
      withTimeout(LLM_TIMEOUT_MS,   designTheme(brief, { mood: prompt })),
      withTimeout(IMAGE_TIMEOUT_MS, generateArtwork(brief, { scene: prompt, style: "Studio Ghibli watercolor" })),
      withTimeout(LLM_TIMEOUT_MS,   composeAudio(brief, { mood: prompt })),
      withTimeout(LLM_TIMEOUT_MS,   writeAnnouncement(brief, { voice: "in-universe narrator", tone: prompt })),
    ]);

    // Extract settled values — each is independent; a failure in one never
    // blocks the others from being applied.
    const theme        = results[0].status === "fulfilled" ? results[0].value : null;
    const artwork      = results[1].status === "fulfilled" ? results[1].value : null;
    const audio        = results[2].status === "fulfilled" ? results[2].value : null;
    const announcement = results[3].status === "fulfilled" ? results[3].value : null;

    // Kick off Lyria immediately — it only needs the vibe string from
    // composeAudio (or the raw prompt as fallback). Running it in parallel
    // with the critique + revision cycle removes the entire Lyria round-trip
    // (~10–20s) from the critical path.
    const musicStyle  = audio?.vibe ?? prompt;
    const musicPromise = generateNewMusic(musicStyle, audio?.musicBrief);

    // Stage 2: critic — runs when at least 3 of 4 artifacts are available.
    // Missing artifacts are passed as undefined; the critic treats all four as optional.
    let finalTheme        = theme;
    let finalArtwork      = artwork;
    let finalAudio        = audio;
    let finalAnnouncement = announcement;

    const artifactCount = [theme, artwork, audio, announcement].filter(Boolean).length;
    if (artifactCount >= 3) {
      // Provide whatever succeeded; the critic accepts all four as optional.
      const fullBundle: ShiftBundle = {
        theme:        theme        ?? { cssVariables: '', rationale: '', motionPreset: 'none', weatherIconAnimation: 'none', textRevealStyle: 'crossfade', googleFonts: [] },
        artwork:      artwork      ?? { imageUrl: '', imagePrompt: '', imageBase64: '', imageMimeType: '' },
        audio:        audio        ?? { vibe: prompt },
        announcement: announcement ?? { text: '', voice: '' },
      };
      let verdict: Critique | null = null;
      try {
        verdict = await withTimeout(20_000, critique({
          brief,
          theme:        theme        ?? undefined,
          artwork:      artwork      ?? undefined,
          announcement: announcement ?? undefined,
          audio:        audio        ?? undefined,
        }));
      } catch {
        // Critic failure or timeout is non-fatal — skip the revise cycle.
      }

      // Stage 3: at most one revise cycle.
      // Only propagate revised values for artifacts that originally succeeded
      // (or that reviseOnce actually regenerated). A null artifact that wasn't
      // revised must stay null so Stage 4 falls back to currentState correctly.
      if (verdict && verdict.verdict === "revise" && verdict.revise.length > 0) {
        const revised = await reviseOnce(brief, fullBundle, verdict);
        if (theme        !== null || verdict.revise.includes('design_theme'))    finalTheme        = revised.theme;
        if (artwork      !== null || verdict.revise.includes('generate_artwork')) finalArtwork      = revised.artwork;
        if (audio        !== null || verdict.revise.includes('compose_audio'))    finalAudio        = revised.audio;
        if (announcement !== null || verdict.revise.includes('write_announcement')) finalAnnouncement = revised.announcement;
      }
    }

    // Stage 4: CSS processing is synchronous (fast); await the Lyria clip
    // that has been generating in parallel with the critique + revision cycle.
    if (finalTheme?.googleFonts) {
      loadGoogleFonts(finalTheme.googleFonts);
    }

    const cssVariables = finalTheme
      ? processMultiverseThemeCss({ cssVariables: finalTheme.cssVariables })
      : currentState.cssVariables;

    const musicResult = await musicPromise;

    logger.update(orchestratorId, { status: "done" });

    return {
      ...currentState,
      cssVariables,
      motionPreset:         finalTheme?.motionPreset         ?? currentState.motionPreset,
      weatherIconAnimation: finalTheme?.weatherIconAnimation ?? currentState.weatherIconAnimation,
      textRevealStyle:      finalTheme?.textRevealStyle      ?? currentState.textRevealStyle,
      tone:                 finalAnnouncement?.text          ?? currentState.tone,
      backgroundImage:      finalArtwork?.imageUrl           ?? currentState.backgroundImage,
      musicStyle,
      musicBrief:           finalAudio?.musicBrief           ?? currentState.musicBrief,
      audioUrl:             musicResult?.audioUrl            ?? currentState.audioUrl,
    };
  } catch (err) {
    logger.update(orchestratorId, {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
