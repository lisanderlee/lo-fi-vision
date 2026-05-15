import React, { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Music } from 'lucide-react';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function readDuration(a: HTMLAudioElement): number {
  const d = a.duration;
  if (Number.isFinite(d) && d > 0 && d !== Infinity) return d;
  try {
    if (a.seekable?.length) {
      const e = a.seekable.end(a.seekable.length - 1);
      if (Number.isFinite(e) && e > 0) return e;
    }
  } catch { /* ignore */ }
  return 0;
}

const FALLBACK_SECS = 30;

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrl: string | undefined;
  hasPlayableSource: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  musicLabel?: string;
  isLoading?: boolean;
};

export function ImageMusicPlayer({ audioRef, audioUrl, hasPlayableSource, isPlaying, onTogglePlay, musicLabel, isLoading = false }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const sync = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    const d = readDuration(a);
    if (d > 0) setDuration(prev => Math.max(prev, d));
  }, [audioRef]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    sync();
    const events = ['timeupdate', 'loadedmetadata', 'loadeddata', 'durationchange', 'progress', 'canplay', 'seeked'];
    events.forEach(ev => a.addEventListener(ev, sync));
    return () => events.forEach(ev => a.removeEventListener(ev, sync));
  }, [audioRef, audioUrl, sync]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => { sync(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, sync]);

  useEffect(() => { if (!audioUrl) { setCurrentTime(0); setDuration(0); } }, [audioUrl]);

  const hasTrack = Boolean(audioUrl);
  const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const endForUi = safeDur > 0 ? safeDur : (hasTrack ? FALLBACK_SECS : 0);
  const rangeMax = hasTrack ? Math.max(0.1, safeDur, currentTime, endForUi) : 1;
  const rangeVal = hasTrack ? Math.min(currentTime, rangeMax) : 0;
  const durLabel = hasTrack && endForUi > 0 ? formatTime(safeDur > 0 ? safeDur : endForUi) : '—:—';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
      <div className="bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-10 pb-3 px-3 sm:px-4">
        {musicLabel ? (
          <div className="ghibli-display flex items-center gap-1.5 text-white/85 text-[11px] sm:text-xs font-medium mb-2 line-clamp-1">
            <Music className="w-3.5 h-3.5 shrink-0 opacity-80" />
            <span className="truncate">{musicLabel}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!hasPlayableSource || isLoading}
            className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isLoading
              ? <Music className="w-5 h-5 opacity-60 animate-pulse" />
              : isPlaying
                ? <Pause className="w-5 h-5 fill-current" />
                : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className={`flex-1 min-w-0 flex flex-col gap-1.5 transition-opacity duration-300 ${isLoading ? 'opacity-40' : ''}`}>
            <input
              type="range"
              min={0} max={rangeMax} step={0.05} value={rangeVal}
              disabled={!hasTrack || isLoading}
              aria-label="Atmosphere progress"
              onChange={e => {
                const t = parseFloat(e.target.value);
                const el = audioRef.current;
                if (!el || !Number.isFinite(t)) return;
                el.currentTime = Math.min(Math.max(0, t), rangeMax);
                setCurrentTime(el.currentTime);
              }}
              className="w-full h-3 sm:h-2 rounded-full cursor-pointer accent-red-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white/20"
            />
            <div className="flex justify-between text-[10px] sm:text-xs tabular-nums text-white/75">
              <span>{formatTime(currentTime)}</span>
              <span>{durLabel}</span>
            </div>
          </div>
        </div>

        {!hasPlayableSource ? (
          <p className="text-[10px] text-white/50 mt-2">
            Generate a scene for Lyria audio and/or pick an ambience below, then press play.
          </p>
        ) : null}
      </div>
    </div>
  );
}
