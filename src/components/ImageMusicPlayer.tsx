import React, { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Music } from 'lucide-react';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function readMediaDurationSeconds(a: HTMLAudioElement): number {
  const d = a.duration;
  if (Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY) {
    return d;
  }
  try {
    if (a.seekable?.length) {
      const end = a.seekable.end(a.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function readSeekableEnd(a: HTMLAudioElement): number {
  try {
    if (a.seekable?.length) {
      const end = a.seekable.end(a.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Lyria prompt targets ~30s; used until real duration metadata is available. */
const FALLBACK_TRACK_SECONDS = 30;

type ImageMusicPlayerProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrl: string | undefined;
  /** True when Lyria URL or an ambience clip is selected — main play applies to both. */
  hasPlayableSource: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  musicLabel?: string;
};

export function ImageMusicPlayer({
  audioRef,
  audioUrl,
  hasPlayableSource,
  isPlaying,
  onTogglePlay,
  musicLabel,
}: ImageMusicPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const syncFromAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    const d = readMediaDurationSeconds(a);
    if (d > 0) setDuration(d);
  }, [audioRef]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const refresh = () => {
      setCurrentTime(a.currentTime);
      const d = readMediaDurationSeconds(a);
      if (d > 0) setDuration((prev) => (d > prev ? d : prev));
    };

    const onMeta = () => {
      const d = readMediaDurationSeconds(a);
      if (d > 0) setDuration(d);
    };

    refresh();
    onMeta();

    a.addEventListener('timeupdate', refresh);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('loadeddata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('progress', onMeta);
    a.addEventListener('canplay', onMeta);
    a.addEventListener('seeked', syncFromAudio);

    return () => {
      a.removeEventListener('timeupdate', refresh);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('loadeddata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('progress', onMeta);
      a.removeEventListener('canplay', onMeta);
      a.removeEventListener('seeked', syncFromAudio);
    };
  }, [audioRef, audioUrl, syncFromAudio]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        setCurrentTime(a.currentTime);
        const d = readMediaDurationSeconds(a);
        if (d > 0) setDuration((prev) => Math.max(prev, d));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, audioRef]);

  useEffect(() => {
    if (!audioUrl) {
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

  const hasTrack = Boolean(audioUrl);
  const a = audioRef.current;
  const seekableEnd = a && hasTrack ? readSeekableEnd(a) : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const knownEnd = Math.max(safeDuration, seekableEnd);
  const endForUi =
    knownEnd > 0 ? knownEnd : hasTrack ? FALLBACK_TRACK_SECONDS : 0;
  const rangeMax = hasTrack ? Math.max(0.1, knownEnd, currentTime, endForUi) : 1;
  const rangeValue = hasTrack ? Math.min(currentTime, rangeMax) : 0;
  const canScrub = hasTrack;
  const durationLabel = hasTrack && endForUi > 0 ? formatTime(knownEnd > 0 ? knownEnd : endForUi) : '—:—';

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
            disabled={!hasPlayableSource}
            className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <input
              type="range"
              min={0}
              max={rangeMax}
              step={0.05}
              value={rangeValue}
              disabled={!canScrub}
              aria-label="Atmosphere progress"
              onChange={(e) => {
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
              <span>{durationLabel}</span>
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
