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
  Sparkles,
  Loader2,
  Trash2,
  Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { LogEntry, MultiverseState } from './agents/types';
import { logger } from './agents/logger';
import { orchestrateMultiverse } from './agents/orchestrator';
import { critiqueScene } from './agents/summary';
import { AgentLog } from './components/AgentLog';
import { ImageMusicPlayer } from './components/ImageMusicPlayer';
import { EnvironmentSoundPicker } from './components/EnvironmentSoundPicker';
import { ENVIRONMENT_SOUNDS, type EnvironmentSoundId } from './constants/envSounds';

/**
 * When Lyria and ambience both play, ambience volume is scaled by this (0–1).
 * Set to 1 so the ambience slider is the only trim; balance against Lyria via {@link SCENE_MUSIC_VOLUME}.
 */
const AMBIENCE_LAYER_WITH_SCENE = 1;

/** Lyria / scene music output level (0–1). Kept conservative so ambience reads in the blend. */
const SCENE_MUSIC_VOLUME = 0.52;

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
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ghibli_history') : null;
      return saved ? JSON.parse(saved) : INITIAL_IMAGES;
    } catch (e) {
      console.error('History parse error:', e);
      return INITIAL_IMAGES;
    }
  });
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  useEffect(() => {
    if (history.length > 0 && !currentImage) {
      setCurrentImage(history[0]);
    }
  }, [history]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [multiverseState, setMultiverseState] = useState<MultiverseState>(DEFAULT_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const envAudioRef = useRef<HTMLAudioElement>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<EnvironmentSoundId | null>(null);
  const [envVolume, setEnvVolume] = useState(0.95);
  const previousBlobUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prev = previousBlobUrlRef.current;
    const next = multiverseState.audioUrl;
    if (prev && prev.startsWith('blob:') && prev !== next) {
      URL.revokeObjectURL(prev);
    }
    previousBlobUrlRef.current = next;
  }, [multiverseState.audioUrl]);

  // Sync history
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saveToLocalStorage = (data: GeneratedImage[]) => {
      try {
        localStorage.setItem('ghibli_history', JSON.stringify(data));
      } catch (e) {
        console.error('History save error, attempting recovery:', e);
        if (data.length > 1) {
          // Try with one less item recursively
          saveToLocalStorage(data.slice(0, -1));
        } else if (data.length === 1) {
          // If even one image is too big, try saving it without the image data (just prompt)
          // or just clear it to keep the app from crashing
          try {
            const lowResHistory = data.map(img => ({ ...img, url: '' }));
            localStorage.setItem('ghibli_history', JSON.stringify(lowResHistory));
          } catch (innerE) {
            localStorage.removeItem('ghibli_history');
          }
        }
      }
    };
    
    saveToLocalStorage(history);
  }, [history]);

  const applyAudioMix = useCallback(() => {
    const main = audioRef.current;
    const env = envAudioRef.current;

    if (main) main.volume = Math.min(1, Math.max(0, SCENE_MUSIC_VOLUME));

    if (!env) return;

    const url = multiverseState.audioUrl;
    const mainPlaying = Boolean(main && url && !main.paused);
    const envPlaying = Boolean(selectedEnvId && !env.paused);
    const layer =
      mainPlaying && envPlaying ? AMBIENCE_LAYER_WITH_SCENE : 1;
    env.volume = Math.min(1, Math.max(0, envVolume * layer));
  }, [envVolume, multiverseState.audioUrl, selectedEnvId]);

  const syncTransportPlaying = useCallback(() => {
    applyAudioMix();
    const m = audioRef.current;
    const e = envAudioRef.current;
    setIsPlaying(Boolean((m && !m.paused) || (e && !e.paused)));
  }, [applyAudioMix]);

  const syncTransportPlayingRef = useRef(syncTransportPlaying);
  syncTransportPlayingRef.current = syncTransportPlaying;

  useEffect(() => {
    applyAudioMix();
  }, [applyAudioMix]);

  /** New Lyria blob replaces the main track only; ambience keeps playing when selected. */
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
        env.pause();
        env.removeAttribute("src");
        env.load();
        syncTransportPlaying();
        return;
      }

      const track = ENVIRONMENT_SOUNDS.find((t) => t.id === next);
      if (!track) return;
      env.loop = true;
      env.src = track.src;
      env.load();

      const anyPlaying =
        Boolean(audioRef.current && !audioRef.current.paused) || !env.paused;
      if (anyPlaying) {
        void playMediaElementWhenReady(env).catch(() => syncTransportPlaying());
      }
      syncTransportPlaying();
    },
    [selectedEnvId, syncTransportPlaying]
  );

  const toggleAtmospherePlayback = useCallback(async () => {
    const main = audioRef.current;
    const env = envAudioRef.current;
    const url = multiverseState.audioUrl;

    const mainPlaying = main && !main.paused;
    const envPlaying = env && !env.paused;

    if (mainPlaying || envPlaying) {
      main?.pause();
      env?.pause();
      syncTransportPlaying();
      return;
    }

    if (!url && !selectedEnvId) return;

    const envTrack = selectedEnvId
      ? ENVIRONMENT_SOUNDS.find((t) => t.id === selectedEnvId)
      : undefined;

    if (envTrack && env) {
      env.loop = true;
      env.src = envTrack.src;
      env.load();
    }

    const pMain =
      url && main
        ? playMediaElementWhenReady(main).catch((err) => {
            logger.log(
              'System',
              'Scene music failed to play',
              err instanceof Error ? err.message : String(err)
            );
          })
        : Promise.resolve();

    const pEnv =
      envTrack && env
        ? playMediaElementWhenReady(env).catch((err) => {
            logger.log(
              'System',
              'Ambience failed to play',
              err instanceof Error ? err.message : String(err)
            );
          })
        : Promise.resolve();

    await Promise.all([pMain, pEnv]);

    syncTransportPlaying();
  }, [multiverseState.audioUrl, selectedEnvId, syncTransportPlaying]);

  // Sync logs
  useEffect(() => {
    const sub = logger.subscribe(setLogs);
    
    const globalErrorHandler = (event: ErrorEvent) => {
      logger.log("System", "Uncaught Error detected", event.message);
    };
    
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      logger.log("System", "Unhandled Promise Rejection", String(event.reason));
    };

    window.addEventListener('error', globalErrorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      sub();
      window.removeEventListener('error', globalErrorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);

  const handleVisionShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    // 1. Trigger Multiverse Orchestration (async, background)
    const redesignPromise = orchestrateMultiverse(prompt, multiverseState).then(newState => {
      if (newState) setMultiverseState(newState);
    }).catch(err => {
      console.error('Redesign error:', err);
      logger.log("System", "Redesign Error", String(err));
    });

    // 2. Main Image Generation
    const logId = logger.log("Artist Agent", "Painting your central masterpiece...", prompt);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in environment');
      
      const ai = new GoogleGenAI({ apiKey });
      const fullPrompt = `${prompt}${GHIBLI_STYLE_SUFFIX}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: { imageConfig: { aspectRatio: "16:9" } },
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
        setHistory(prev => [newImage, ...prev].slice(0, 2));
        setCurrentImage(newImage);
        setPrompt('');
        logger.update(logId, { status: "done" });
        
        // Trigger Critic Agent
        critiqueScene(prompt, imageUrl);
      } else {
        throw new Error('No image data received');
      }
    } catch (err) {
      console.error('Generation error:', err);
      logger.update(logId, { status: "failed", detail: String(err) });
    } finally {
      await redesignPromise; // Wait for the UI shift to complete before stopping loader if desired
      setIsGenerating(false);
    }
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(img => img.id !== id));
    if (currentImage?.id === id) setCurrentImage(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden transition-all duration-1000 relative text-[#0f0f0f]">
      <style dangerouslySetInnerHTML={{ __html: `:root { ${multiverseState.cssVariables} }` }} />
      
      {/* Multiverse Background System */}
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
        <div className="bg-backdrop opacity-70" />
      </div>

      <div className="flex flex-col h-full relative z-10">
        {/* Hidden Audio for Atmosphere */}
        <audio
          ref={audioRef}
          loop
          preload="auto"
          playsInline
          src={multiverseState.audioUrl}
          onPlay={syncTransportPlaying}
          onPause={syncTransportPlaying}
          onError={() => {
            setIsPlaying(false);
            logger.log('System', 'Scene music failed to load', audioRef.current?.src ?? '');
            syncTransportPlaying();
          }}
        />

        <audio
          ref={envAudioRef}
          loop
          playsInline
          preload="auto"
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
              <div
                className="p-1 rounded-md shrink-0"
                style={{ backgroundColor: YT.red }}
              >
                <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
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

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden text-[var(--text-color)] [font-family:var(--font-family)]">
        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 relative motion-layer ${multiverseState.motionPreset !== 'none' ? `motion-${multiverseState.motionPreset}` : ''}`}>
          <div className="max-w-screen-2xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              <div className="ghibli-card overflow-hidden shadow-2xl mb-6 bg-white border border-black/5 rounded-[var(--ui-radius)]">
                <div className="bg-black aspect-video relative">
                  <AnimatePresence mode="wait">
                    {currentImage && (
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
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 z-30">
                      <Loader2 className="w-12 h-12 animate-spin" />
                      <p className="font-medium tracking-wide">Painting the scene...</p>
                    </div>
                  )}
                  <ImageMusicPlayer
                    audioRef={audioRef}
                    audioUrl={multiverseState.audioUrl}
                    hasPlayableSource={Boolean(multiverseState.audioUrl || selectedEnvId)}
                    isPlaying={isPlaying}
                    onTogglePlay={() => void toggleAtmospherePlayback()}
                    musicLabel={multiverseState.musicStyle}
                  />
                </div>
                <div className="border-t border-black/5 px-4 py-3 bg-black/[0.04]">
                  <EnvironmentSoundPicker
                    selectedId={selectedEnvId}
                    onSelectId={handleEnvSelect}
                    volume={envVolume}
                    onVolumeChange={setEnvVolume}
                  />
                </div>
                <div className="p-6">
                  <h1 className="text-2xl font-bold mb-4 ghibli-heading">{currentImage?.prompt || 'Imagination Engine'}</h1>
                  <div className="flex items-center gap-3 py-4 border-t border-black/5">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold">Lo-Fi Vision</p>
                      <p className="text-xs opacity-50 ghibli-display">{multiverseState.tone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid (Mobile friendly) */}
              <div className="lg:hidden">
                <ThumbnailGrid items={history} onSelect={setCurrentImage} onDelete={deleteImage} />
              </div>
            </div>

            {/* Desktop Recommendations */}
            <div className="hidden lg:block w-72 xl:w-80 shrink-0">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <History size={18} /> History
              </h2>
              <div className="space-y-4">
                {history.map(img => (
                  <div key={img.id} onClick={() => setCurrentImage(img)} className="flex gap-3 group cursor-pointer">
                    <div className="w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/5 relative">
                      <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <button onClick={(e) => deleteImage(img.id, e)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">{img.prompt}</h3>
                      <p className="text-[10px] opacity-40 mt-1 ghibli-display">Lo-Fi Vision</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
          </div>

        {/* Agent Log — fixed chrome, outside themed wrapper */}
        <AgentLog logs={logs} isOpen={isLogOpen} />
      </div>
    </div>
  </div>
);
}

function ThumbnailGrid({ items, onSelect, onDelete }: any) {
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
          <h3 className="mt-2 font-bold text-sm truncate">{img.prompt}</h3>
        </div>
      ))}
    </div>
  );
}
