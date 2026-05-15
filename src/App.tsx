import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from 'react';
import {
  Search,
  History,
  Headphones,
  Sparkles,
  Loader2,
  Trash2,
  Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { LogEntry, MultiverseState } from './agents/types';
import { logger } from './agents/logger';
import { orchestrateMultiverse, retryAgent } from './agents/orchestrator';
import { AgentActivityRail } from './components/AgentActivityRail';
import { AgentLog } from './components/AgentLog';
import { ImageMusicPlayer } from './components/ImageMusicPlayer';
import { EnvironmentSoundPicker } from './components/EnvironmentSoundPicker';
import { ENVIRONMENT_SOUNDS, type EnvironmentSoundId } from './constants/envSounds';
import {
  SkeletonHero,
  SkeletonSidebarItem,
  SkeletonGridItem,
  SkeletonTitle,
  SkeletonTone,
} from './components/Skeleton';

/**
 * Ensures an `<audio>` element can play after `src` / `load()` (blobs and network both need `canplay` sometimes).
 */
async function playMediaElementWhenReady(el: HTMLAudioElement): Promise<void> {
  if (el.error) {
    throw new Error(el.error.message || 'Audio media error');
  }
  if (el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    await new Promise<void>((resolve, reject) => {
      if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve();
        return;
      }
      el.addEventListener('canplay', () => resolve(), { once: true });
      el.addEventListener(
        'error',
        () => reject(new Error(el.error?.message || 'Audio failed to load')),
        { once: true }
      );
    });
  }
  await el.play();
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

const GHIBLI_STYLE_SUFFIX = ", Studio Ghibli style, hand-drawn aesthetic, soft watercolor textures, whimsical atmosphere, high detail, masterpiece, Hayao Miyazaki inspiration";

const INITIAL_IMAGES: GeneratedImage[] = [
  {
    id: 'init-1',
    url: 'https://images.unsplash.com/photo-1541512416146-3cf58d6b27cc?auto=format&fit=crop&q=80&w=1080',
    prompt: 'A tiny rain-washed train carriage crossing a shallow sea under a violet twilight sky',
    timestamp: Date.now() - 100000,
  },
  {
    id: 'init-2',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1080',
    prompt: 'A lush hidden flower garden inside an ancient stone ruin with floating dust motes',
    timestamp: Date.now() - 200000,
  },
  {
    id: 'init-3',
    url: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1080',
    prompt: 'A giant fluffy forest spirit napping under an enormous camphor tree',
    timestamp: Date.now() - 300000,
  }
];

/** Fixed YouTube-style chrome (never uses multiverse cssVariables). */
const YT = {
  text: '#0f0f0f',
  border: '#e5e5e5',
  searchBg: '#f1f1f1',
  red: '#ff0000',
  btnDark: '#0f0f0f',
} as const;

const DEFAULT_STATE: MultiverseState = {
  cssVariables: `--bg-color: #fdfbf7; --text-color: #2d2a26; --card-bg: #ffffff; --accent-color: #1a4d2e; --accent-color-2: #d4a373; --btn-bg: #1a4d2e; --btn-text: #fdfbf7; --ui-radius: 12px; --card-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.12); --divider-color: rgba(15, 15, 15, 0.08); --font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; --display-font: 'Libre Baskerville', serif; --heading-font: 'Playfair Display', serif;`,
  motionPreset: 'none',
  weatherIconAnimation: 'none',
  tone: 'Whimsical and peaceful.',
  musicStyle: 'Ambient piano with soft nature sounds.',
};

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  // History always starts empty each session — no stale entries from previous
  // sessions are shown. localStorage is still written so the data is available
  // if needed, but we never read it back into the visible history.
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [multiverseState, setMultiverseState] = useState<MultiverseState>(DEFAULT_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationEpoch, setGenerationEpoch] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const envAudioRef = useRef<HTMLAudioElement>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<EnvironmentSoundId | null>(null);
  const [masterVolume, setMasterVolume] = useState(0.75);
  const [mixRatio, setMixRatio] = useState(0.5);
  const previousBlobUrlRef = useRef<string | undefined>(undefined);
  const lastPromptRef = useRef<string>('');

  // Revoke previous blob URL when a new clip arrives
  useEffect(() => {
    const prev = previousBlobUrlRef.current;
    const next = multiverseState.audioUrl;
    if (prev && prev.startsWith('blob:') && prev !== next) URL.revokeObjectURL(prev);
    previousBlobUrlRef.current = next;
  }, [multiverseState.audioUrl]);

  // Sync history
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Base64 data URLs can be 2–5 MB each and blow the ~5 MB localStorage
    // quota. Strip them before persisting — only keep external URLs (unsplash,
    // https://…) which are tiny strings. Prompts + timestamps are preserved so
    // history labels survive a reload even without the image thumbnail.
    const serializable = history.map(img => ({
      ...img,
      url: img.url.startsWith('data:') ? '' : img.url,
    }));
    try {
      localStorage.setItem('ghibli_history', JSON.stringify(serializable));
    } catch {
      localStorage.removeItem('ghibli_history');
    }
  }, [history]);

  const applyAudioMix = useCallback(() => {
    const main = audioRef.current;
    const env  = envAudioRef.current;
    const envLevel   = masterVolume * Math.cos(mixRatio * Math.PI / 2);
    const musicLevel = masterVolume * Math.sin(mixRatio * Math.PI / 2);
    if (main) main.volume = Math.min(1, Math.max(0, musicLevel));
    if (env)  env.volume  = Math.min(1, Math.max(0, envLevel));
  }, [masterVolume, mixRatio]);

  const syncTransportPlaying = useCallback(() => {
    applyAudioMix();
    const m = audioRef.current;
    const e = envAudioRef.current;
    setIsPlaying(Boolean((m && !m.paused) || (e && !e.paused)));
  }, [applyAudioMix]);

  const syncTransportPlayingRef = useRef(syncTransportPlaying);
  syncTransportPlayingRef.current = syncTransportPlaying;

  useEffect(() => { applyAudioMix(); }, [applyAudioMix]);

  // New clip arrives — pause old track so App re-plays on next user gesture
  useEffect(() => {
    audioRef.current?.pause();
    syncTransportPlayingRef.current();
  }, [multiverseState.audioUrl]);

  const handleEnvSelect = useCallback(
    (id: EnvironmentSoundId) => {
      const next = id === selectedEnvId ? null : id;
      setSelectedEnvId(next);
      const env = envAudioRef.current;
      if (!env) return;
      if (next === null) {
        env.pause(); env.removeAttribute("src"); env.load();
        syncTransportPlaying(); return;
      }
      const track = ENVIRONMENT_SOUNDS.find((t) => t.id === next);
      if (!track) return;
      env.loop = true; env.src = track.src; env.load();
      if (Boolean(audioRef.current && !audioRef.current.paused) || !env.paused) {
        void playMediaElementWhenReady(env).catch(() => syncTransportPlaying());
      }
      syncTransportPlaying();
    },
    [selectedEnvId, syncTransportPlaying]
  );

  const toggleAtmospherePlayback = useCallback(async () => {
    const main = audioRef.current;
    const env  = envAudioRef.current;
    const url  = multiverseState.audioUrl;

    if (main && !main.paused || env && !env.paused) {
      main?.pause(); env?.pause(); syncTransportPlaying(); return;
    }

    if (!url && !selectedEnvId) return;

    const envTrack = selectedEnvId ? ENVIRONMENT_SOUNDS.find((t) => t.id === selectedEnvId) : undefined;
    if (envTrack && env) { env.loop = true; env.src = envTrack.src; env.load(); }

    const pMain = url && main
      ? playMediaElementWhenReady(main).catch(err =>
          logger.log('System', 'Scene music failed to play', err instanceof Error ? err.message : String(err)))
      : Promise.resolve();
    const pEnv = envTrack && env
      ? playMediaElementWhenReady(env).catch(err =>
          logger.log('System', 'Ambience failed to play', err instanceof Error ? err.message : String(err)))
      : Promise.resolve();

    await Promise.all([pMain, pEnv]);
    syncTransportPlaying();
  }, [multiverseState.audioUrl, selectedEnvId, syncTransportPlaying]);

  // Sync logs
  useEffect(() => {
    const sub = logger.subscribe(setLogs);
    
    const globalErrorHandler = (event: ErrorEvent) => {
      // ResizeObserver fires this benign browser warning when animation frames
      // cause layout changes inside observer callbacks — safe to suppress.
      if (event.message?.includes('ResizeObserver')) return;
      const loc = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno})` : '';
      logger.log("System", "Uncaught Error detected", `${event.message}${loc}`);
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason);
      // Browser-extension messaging noise — not our code.
      if (msg.includes('message channel closed') || msg.includes('asynchronous response')) return;
      logger.log("System", "Unhandled Promise Rejection", msg);
    };

    window.addEventListener('error', globalErrorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      sub();
      window.removeEventListener('error', globalErrorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);

  const handleRetryAgent = useCallback(async (agentName: string) => {
    const p = lastPromptRef.current;
    if (!p) return;
    try {
      const patch = await retryAgent(agentName, p, multiverseState);
      if (patch) setMultiverseState(prev => ({ ...prev, ...patch }));
    } catch (err) {
      console.error(`Retry ${agentName} error:`, err);
    }
  }, [multiverseState]);

  const handleVisionShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setHasStarted(true);
    setIsGenerating(true);
    lastPromptRef.current = prompt;

    // Stamp the start of this generation. AgentActivityRail filters to entries
    // created at or after this epoch, so stale entries from the previous run
    // (e.g. Critic "done") don't bleed into the new generation's view.
    setGenerationEpoch(Date.now());

    // Pause both audio tracks and clear the old clip so the player shows as
    // muted until the Composer returns a new loop for this generation.
    audioRef.current?.pause();
    envAudioRef.current?.pause();
    setMultiverseState(prev => ({ ...prev, audioUrl: undefined }));
    syncTransportPlaying();

    // Fire orchestration in the background — it runs independently and
    // applies the theme/backdrop/music when it settles. We do NOT await it
    // here so the hero image spinner reflects only the image generation.
    setIsOrchestrating(true);
    orchestrateMultiverse(prompt, multiverseState)
      .then(newState => {
        if (newState) setMultiverseState(newState);
      })
      .catch(err => {
        console.error('Orchestration error:', err);
        logger.log("System", "Orchestration Error", String(err));
      })
      .finally(() => setIsOrchestrating(false));

    // Hero image generation — spinner lives and dies with this request only
    const logId = logger.log("Artist Agent", "Painting your central masterpiece...", prompt);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in environment');

      const ai = new GoogleGenAI({ apiKey });
      const fullPrompt = `${prompt}${GHIBLI_STYLE_SUFFIX}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: "16:9" },
        },
      });

      let imageUrl = '';
      const candidates = response.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        const newImage: GeneratedImage = {
          id: `gen-${Date.now()}`,
          url: imageUrl,
          prompt: prompt,
          timestamp: Date.now(),
        };
        setHistory(prev => [newImage, ...prev].slice(0, 6));
        setCurrentImage(newImage);
        setPrompt('');
        logger.update(logId, { status: "done" });
      } else {
        throw new Error('No image data received');
      }
    } catch (err) {
      console.error('Generation error:', err);
      logger.update(logId, { status: "failed", detail: String(err) });
    } finally {
      // Hero image done (success or failure) — unlock the input immediately.
      // Orchestration continues in the background and updates the theme when ready.
      setIsGenerating(false);
    }
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(img => img.id !== id));
    if (currentImage?.id === id) setCurrentImage(null);
  };

  if (!hasStarted) {
    return (
      <LandingScreen
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleVisionShift}
        isGenerating={isGenerating}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col h-screen overflow-hidden transition-all duration-1000 relative text-[#0f0f0f]"
    >
      <style dangerouslySetInnerHTML={{ __html: `:root { ${multiverseState.cssVariables} }` }} />
      
      {/* Multiverse Background System — layers: image → backdrop → tint → vignette → grain */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatePresence>
          {multiverseState.backgroundImage && (
            <motion.div
              key={multiverseState.backgroundImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
              className="bg-overlay"
              style={{ backgroundImage: `url(${multiverseState.backgroundImage})` }}
            />
          )}
        </AnimatePresence>
        <div className="bg-backdrop" />
        <div className="bg-tint" />
        <div className="bg-vignette" />
        <div className="bg-grain" />
      </div>

      <div className="flex flex-col h-full relative z-10">
        {/* Scene music — 30s Lyria clip, loops */}
        <audio
          ref={audioRef}
          loop preload="auto" playsInline
          src={multiverseState.audioUrl}
          onPlay={syncTransportPlaying}
          onPause={syncTransportPlaying}
          onError={() => {
            setIsPlaying(false);
            logger.log('System', 'Scene music failed to load', audioRef.current?.src ?? '');
            syncTransportPlaying();
          }}
        />
        {/* Ambience layer */}
        <audio
          ref={envAudioRef}
          loop playsInline preload="auto"
          onPlay={syncTransportPlaying}
          onPause={syncTransportPlaying}
          onError={() => {
            logger.log('System', 'Ambience audio failed to load', envAudioRef.current?.src ?? '');
            syncTransportPlaying();
          }}
        />

        {/* Header — fixed YouTube-style chrome, never themed */}
        <header className="yt-header h-16 flex items-center justify-between px-4 z-30 shrink-0">
          <div className="flex items-center gap-4 text-[#0f0f0f]">
            <div className="flex items-center gap-1 cursor-pointer select-none">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0f0f0f] shrink-0">
                <Headphones className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <span className="text-xl font-bold tracking-tight hidden sm:block" style={{ fontFamily: 'var(--font-family)' }}>
                Lo-Fi Vision
              </span>
            </div>
          </div>

          <form onSubmit={handleVisionShift} className="flex-1 max-w-2xl px-4 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a scene to shift realities..."
                className="w-full h-10 pr-10 rounded-full border px-4 text-sm outline-none transition-shadow placeholder:text-[#606060] focus:border-[#065fd4] focus:ring-2 focus:ring-[#065fd4]/30"
                style={{
                  backgroundColor: YT.searchBg,
                  borderColor: YT.border,
                  color: YT.text,
                }}
                disabled={isGenerating}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060]">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="h-10 flex items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
              style={{ backgroundColor: YT.btnDark }}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="hidden md:inline">Generate</span>
            </button>
          </form>

          <div className="flex items-center gap-2 sm:gap-4 ml-4 text-[#0f0f0f]">
            <button
              type="button"
              onClick={() => setIsLogOpen(!isLogOpen)}
              className={`p-2 rounded-full transition-colors ${
                isLogOpen ? 'bg-[#0f0f0f] text-white' : 'hover:bg-[#f2f2f2] text-[#0f0f0f]'
              }`}
            >
              <Terminal className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden flex-col">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden text-[var(--text-color)] [font-family:var(--font-family)]">
        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 relative motion-layer ${multiverseState.motionPreset !== 'none' ? `motion-${multiverseState.motionPreset}` : ''}`}>
          <div className="max-w-screen-2xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              <div className="ghibli-card overflow-hidden shadow-2xl mb-6 bg-white border border-black/5 rounded-[var(--ui-radius)]">
                <div className="bg-black aspect-video relative">
                  <AnimatePresence mode="wait">
                    {currentImage && !isGenerating && (
                      <motion.img
                        key={currentImage.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        src={currentImage.url}
                        alt={currentImage.prompt}
                        className="w-full h-full object-cover pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </AnimatePresence>
                  {(isGenerating || !currentImage) && <SkeletonHero />}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 z-30">
                      <Loader2 className="w-12 h-12 animate-spin" />
                      <p className="ghibli-heading text-lg font-bold tracking-wide" style={{ fontSize: '1.1rem' }}>Painting the scene…</p>
                    </div>
                  )}
                  <ImageMusicPlayer
                    audioRef={audioRef}
                    audioUrl={multiverseState.audioUrl}
                    hasPlayableSource={Boolean(multiverseState.audioUrl || selectedEnvId)}
                    isPlaying={isPlaying}
                    onTogglePlay={() => void toggleAtmospherePlayback()}
                    musicLabel={multiverseState.musicStyle}
                    isLoading={isOrchestrating}
                  />
                </div>
                <div className="border-t border-black/5 px-4 py-3 bg-black/[0.04]">
                  <EnvironmentSoundPicker
                    selectedId={selectedEnvId}
                    onSelectId={handleEnvSelect}
                    masterVolume={masterVolume}
                    onMasterVolumeChange={setMasterVolume}
                    mixRatio={mixRatio}
                    onMixRatioChange={setMixRatio}
                    disabled={isGenerating || isOrchestrating}
                  />
                </div>
                <div className="px-6 pt-6 pb-5">
                  {/* Scene title — skeleton while image loading, real title once image arrives */}
                  {isGenerating || !currentImage ? (
                    <SkeletonTitle />
                  ) : (
                    <h1
                      className="ghibli-heading leading-tight mb-3"
                      style={{
                        fontSize: 'clamp(1.6rem, 3.5vw, 2.75rem)',
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        color: 'var(--text-color)',
                      }}
                    >
                      {currentImage.prompt}
                    </h1>
                  )}

                  {/* Scene poem — skeleton until the ScenePoet/orchestrator resolves */}
                  {isGenerating || !currentImage || isOrchestrating ? (
                    <SkeletonTone />
                  ) : (
                    multiverseState.tone && (
                      <p
                        className="ghibli-display mb-5"
                        style={{
                          fontSize: 'clamp(1rem, 1.6vw, 1.2rem)',
                          fontStyle: 'italic',
                          opacity: 0.7,
                          lineHeight: 1.75,
                          color: 'var(--text-color)',
                          maxWidth: '68ch',
                        }}
                      >
                        {multiverseState.tone}
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* Grid (Mobile friendly) */}
              <div className="lg:hidden">
                <ThumbnailGrid items={history} onSelect={setCurrentImage} onDelete={deleteImage} isGenerating={isGenerating} />
              </div>
            </div>

            {/* Desktop History Sidebar */}
            <div className="hidden lg:block w-72 xl:w-80 shrink-0">
              <h2
                className="ghibli-heading mb-5 flex items-center gap-2"
                style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-color)' }}
              >
                <History size={16} className="opacity-60" /> History
              </h2>
              <div className="space-y-5">
                {history.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonSidebarItem key={i} />
                  ))
                ) : (
                  history.map(img => (
                    <div key={img.id} onClick={() => setCurrentImage(img)} className="flex gap-3 group cursor-pointer">
                      <div className="w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/5 relative">
                        <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                        <button onClick={(e) => deleteImage(img.id, e)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="min-w-0 flex flex-col justify-center gap-1">
                        <h3
                          className="font-bold leading-snug line-clamp-2"
                          style={{ fontSize: '0.8rem', color: 'var(--text-color)' }}
                        >
                          {img.prompt}
                        </h3>
                        <p className="text-[10px] opacity-35 ghibli-display">Lo-Fi Vision</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
            </div>

            {/* Agent Log — fixed chrome, outside themed wrapper */}
            <AgentLog logs={logs} isOpen={isLogOpen} />
          </div>
          <AgentActivityRail logs={logs} onRetry={handleRetryAgent} since={generationEpoch} />
        </div>
      </div>
    </motion.div>
);
}

interface LandingScreenProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  isGenerating: boolean;
}

function LandingScreen({ prompt, onPromptChange, onSubmit, isGenerating }: LandingScreenProps) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-color: #ffffff;
          --text-color: #0f0f0f;
          --accent-color: #0f0f0f;
          --font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          --bg-grain-opacity: 0;
          --bg-tint: none;
          --bg-vignette: none;
          --backdrop-opacity: 0;
        }
        body { background-color: #ffffff; }
      `}} />
      {/* Wordmark */}
      <div className="flex items-center gap-3 mb-12 select-none">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#0f0f0f] shrink-0">
          <Headphones className="w-7 h-7 text-white" strokeWidth={1.75} />
        </div>
        <span className="text-4xl font-black tracking-tight text-[#0f0f0f]" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
          Lo-Fi Vision
        </span>
      </div>

      {/* Tagline */}
      <p className="text-[#606060] text-lg mb-10 text-center max-w-md">
        Describe a scene and step into a living, breathing world.
      </p>

      {/* Big form */}
      <form onSubmit={onSubmit} className="w-full max-w-2xl flex flex-col items-center gap-4">
        <div className="relative w-full">
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe a scene to shift realities…"
            autoFocus
            className="w-full h-16 pl-6 pr-14 rounded-full border-2 text-xl outline-none transition-shadow placeholder:text-[#aaaaaa] focus:border-[#065fd4] focus:ring-4 focus:ring-[#065fd4]/20"
            style={{
              backgroundColor: '#f8f8f8',
              borderColor: '#e5e5e5',
              color: '#0f0f0f',
            }}
            disabled={isGenerating}
          />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[#aaaaaa]">
            <Search className="w-6 h-6" />
          </div>
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="h-14 flex items-center justify-center gap-3 rounded-full px-10 text-base font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          style={{ backgroundColor: '#0f0f0f' }}
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Generate
        </button>
      </form>
    </div>
  );
}

function ThumbnailGrid({ items, onSelect, onDelete, isGenerating }: any) {
  if (items.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonGridItem key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((img: any) => (
        <div key={img.id} onClick={() => onSelect(img)} className="group cursor-pointer">
          <div className="aspect-video bg-black/5 rounded-xl overflow-hidden relative">
            <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
            <button onClick={(e) => onDelete(img.id, e)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={14} />
            </button>
          </div>
          <h3 className="mt-2 font-bold leading-snug line-clamp-2 ghibli-heading" style={{ fontSize: '0.9rem' }}>{img.prompt}</h3>
        </div>
      ))}
    </div>
  );
}
