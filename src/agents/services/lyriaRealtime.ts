import type {
  LiveMusicGenerationConfig,
  LiveMusicServerMessage,
  LiveMusicSession,
  Scale,
  MusicGenerationMode,
} from '@google/genai';
import { liveAi, LIVE_MUSIC_MODEL } from '../gemini';
import type { MusicBrief } from '../types';

// Thin client wrapper around `liveAi.live.music.connect`. The orchestrator
// never touches this directly — the composer emits a `MusicBrief` and the
// React `useLyriaRealtime` hook drives the WebSocket lifecycle and audio
// playback. Keeping this layer means the hook isn't littered with SDK
// shapes, and the same wrapper can be reused elsewhere (CLI demos, tests).

export interface LyriaSessionCallbacks {
  // Called for every audio chunk the server emits. `data` is base64-encoded
  // raw 16-bit signed PCM, little-endian, interleaved L,R, at the documented
  // 48 kHz / stereo format.
  onAudioChunk: (data: string, mimeType?: string) => void;
  // Surface server-side prompt filtering so the UI can warn the user.
  onFilteredPrompt?: (text: string, reason?: string) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
}

export interface LyriaSessionHandle {
  // Tear down: stops generation and closes the underlying socket.
  close: () => void;
  // Update prompts mid-stream. Lyria crossfades automatically.
  updatePrompts: (prompts: MusicBrief['weightedPrompts']) => Promise<void>;
}

// Open a Lyria RealTime session, push the brief, start playback, and return
// a small handle the caller uses for teardown / live updates. Throws if the
// connect handshake fails — caller is responsible for catching and falling
// back to silence.
export async function openLyriaSession(
  brief: MusicBrief,
  callbacks: LyriaSessionCallbacks,
): Promise<LyriaSessionHandle> {
  const session: LiveMusicSession = await liveAi.live.music.connect({
    model: LIVE_MUSIC_MODEL,
    callbacks: {
      onmessage: (msg: LiveMusicServerMessage) => {
        if (msg.filteredPrompt?.text && callbacks.onFilteredPrompt) {
          callbacks.onFilteredPrompt(
            msg.filteredPrompt.text,
            msg.filteredPrompt.filteredReason,
          );
        }
        const chunks = msg.serverContent?.audioChunks ?? [];
        for (const chunk of chunks) {
          if (chunk.data) callbacks.onAudioChunk(chunk.data, chunk.mimeType);
        }
      },
      onerror: (err) => callbacks.onError?.(err),
      onclose: () => callbacks.onClose?.(),
    },
  });

  await session.setWeightedPrompts({
    weightedPrompts: brief.weightedPrompts.map((p) => ({
      text: p.text,
      weight: p.weight,
    })),
  });

  if (brief.config && Object.keys(brief.config).length > 0) {
    // The SDK's config type uses string-valued enums (Scale,
    // MusicGenerationMode). Our MusicBrief uses the same string literals so
    // a structural cast is safe — we keep the ergonomic JSON shape on our
    // side so it travels cleanly through Gemini's responseSchema.
    const sdkConfig: LiveMusicGenerationConfig = {
      ...brief.config,
      scale: brief.config.scale as Scale | undefined,
      musicGenerationMode: brief.config.musicGenerationMode as
        | MusicGenerationMode
        | undefined,
    };
    await session.setMusicGenerationConfig({ musicGenerationConfig: sdkConfig });
  }

  session.play();

  return {
    close: () => {
      try {
        session.stop();
      } catch {
        // Stop can throw if the socket already errored — best-effort.
      }
      try {
        session.close();
      } catch {
        // Same.
      }
    },
    updatePrompts: async (prompts) => {
      await session.setWeightedPrompts({
        weightedPrompts: prompts.map((p) => ({ text: p.text, weight: p.weight })),
      });
    },
  };
}
