import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { Wind, ChevronDown, ChevronUp, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type BreathPhaseKind,
  type BreathingPreset,
  type BreathVizStyle,
  BREATHING_PRESETS,
  getPreset,
} from '../constants/breathingPatterns';

const SCALE_COLLAPSED = 0.92;
const SCALE_EXPANDED = 1.075;

function resolvePresetViz(preset: BreathingPreset): BreathVizStyle {
  if (preset.viz === 'box' && preset.segments.length === 4) return 'box';
  return 'orb';
}

function bloomScaleFromOrbScale(scale: number): number {
  const lo = SCALE_COLLAPSED * 1.06;
  const hi = SCALE_EXPANDED * 0.985;
  return lo + ((scale - SCALE_COLLAPSED) / (SCALE_EXPANDED - SCALE_COLLAPSED)) * (hi - lo);
}

function rippleScaleFromOrbScale(scale: number): number {
  return (
    SCALE_EXPANDED * 1.035 -
    ((scale - SCALE_COLLAPSED) / (SCALE_EXPANDED - SCALE_COLLAPSED)) *
      (SCALE_EXPANDED - SCALE_COLLAPSED) *
      0.11
  );
}

/** Dot travels bottom → right → top → left with phase rhythm. */
function boxDotPct(sideIdx: number, t: number): { xPct: number; yPct: number } {
  const u = Math.min(1, Math.max(0, t));
  const a = 18;
  const b = 82;
  const L = b - a;
  switch (sideIdx % 4) {
    case 0:
      return { xPct: a + L * u, yPct: b };
    case 1:
      return { xPct: b, yPct: b - L * u };
    case 2:
      return { xPct: b - L * u, yPct: a };
    default:
      return { xPct: a, yPct: a + L * u };
  }
}

interface OrbVisualProps {
  tickState: {
    phaseIndex: number;
    phase: BreathPhaseKind;
    segmentElapsedSec: number;
    segmentDurationSec: number;
  };
  circleScale: number;
  bloomScale: number;
  rippleScale: number;
  running: boolean;
  reducedMotion: boolean;
  textColorVar: string;
  remainingWhole: number;
}

function BreathOrbVisual({
  tickState,
  circleScale,
  bloomScale,
  rippleScale,
  running,
  reducedMotion,
  textColorVar,
  remainingWhole,
}: OrbVisualProps) {
  const { phase, segmentElapsedSec, segmentDurationSec } = tickState;
  const u =
    segmentDurationSec > 0
      ? Math.min(1, segmentElapsedSec / segmentDurationSec)
      : 0;

  /** Arc fills clockwise as the current inhale progresses; drains on exhale; holds breathe softly. */
  let arcFrac = 0.45;
  if (phase === 'inhale') arcFrac = 0.08 + u * 0.84;
  else if (phase === 'exhale') arcFrac = 0.92 - u * 0.84;
  else if (phase === 'holdIn') arcFrac = 0.92;
  else arcFrac = 0.08;

  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - arcFrac);

  const haloOpacity = reducedMotion
    ? phase === 'holdIn' || phase === 'inhale'
      ? 0.38
      : 0.22
    : 0.28 + arcFrac * 0.42;

  return (
    <div
      className="relative mx-auto mb-4 flex h-[11.25rem] w-[11.25rem] items-center justify-center [color:var(--accent-color)]"
      aria-hidden
    >
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{
          inset: '-12%',
          background: `radial-gradient(circle at 42% 36%, color-mix(in srgb, var(--accent-color) ${Math.round(haloOpacity * 100)}%, transparent) 0%, transparent 68%)`,
        }}
        animate={{ scale: bloomScale }}
        transition={{ duration: reducedMotion ? 0.36 : 0, ease: 'easeOut' }}
      />

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.2]"
          animate={{ rotate: running ? 360 : 0 }}
          transition={{
            duration: running ? 32 : 0.6,
            repeat: running ? Infinity : 0,
            ease: 'linear',
          }}
        >
          <svg width="180" height="180" viewBox="0 0 100 100" className="overflow-visible">
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.35"
              strokeDasharray="5 10"
              opacity="0.85"
            />
          </svg>
        </motion.div>
      )}

      {!reducedMotion && (
        <svg
          className="pointer-events-none absolute inset-1 overflow-visible opacity-55"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="breathOrbArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-color-2, var(--accent-color))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <g transform="rotate(-90 50 50)">
            <motion.circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="url(#breathOrbArcGrad)"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={false}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: reducedMotion ? 0 : 0.14, ease: 'easeOut' }}
              opacity={0.75}
            />
          </g>
        </svg>
      )}

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          animate={{ scale: rippleScale }}
          transition={{ duration: 0 }}
        >
          <svg width="146" height="146" viewBox="0 0 100 100" className="overflow-visible opacity-25">
            <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="14" opacity="0.35" />
          </svg>
        </motion.div>
      )}

      <motion.div
        className="relative flex h-[8.125rem] w-[8.125rem] shrink-0 items-center justify-center rounded-full border-[2px] shadow-inner"
        style={{
          borderColor:
            reducedMotion ?
              phase === 'exhale' || phase === 'holdOut'
                ? 'color-mix(in srgb, var(--accent-color) 32%, transparent)'
              : 'color-mix(in srgb, var(--accent-color-2, var(--accent-color)) 40%, transparent)'
            : 'color-mix(in srgb, var(--accent-color) 38%, transparent)',
          boxShadow:
            reducedMotion ?
              undefined
            : `
              inset 0 0 28px color-mix(in srgb, var(--accent-color) 16%, transparent),
              0 0 36px color-mix(in srgb, var(--accent-color) 16%, transparent)
            `,
          background: reducedMotion ?
            undefined
          : `
            radial-gradient(
              circle at 38% 32%,
              color-mix(in srgb, var(--accent-color) 26%, transparent) 0%,
              transparent 58%
            ),
            color-mix(in srgb, var(--accent-color) 13%, transparent)
          `,
          backgroundColor: reducedMotion ? 'color-mix(in srgb, var(--accent-color) 12%, transparent)' : undefined,
        }}
        animate={{
          scale: circleScale,
        }}
        transition={{ duration: reducedMotion ? 0.28 : 0, ease: 'easeOut' }}
      >
        <div className="px-4 text-center">
          <motion.p
            className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-80"
            style={{ color: textColorVar }}
            key={`${tickState.phaseIndex}-${tickState.phase}`}
            initial={reducedMotion ? false : { opacity: 0.45, y: 2 }}
            animate={{ opacity: 0.8, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
          >
            {phaseLabel(tickState.phase)}
          </motion.p>
          <p
            className="ghibli-heading text-4xl font-bold tracking-tight tabular-nums leading-none"
            style={{ color: 'var(--accent-color)' }}
          >
            {running ? remainingWhole : '–'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

interface BoxVisualProps {
  tickState: {
    phaseIndex: number;
    phase: BreathPhaseKind;
    segmentElapsedSec: number;
    segmentDurationSec: number;
  };
  circleScale: number;
  bloomScale: number;
  rippleScale: number;
  reducedMotion: boolean;
  textColorVar: string;
  remainingWhole: number;
  running: boolean;
}

const BOX_EDGE_PATHS = [
  'M18 82 L82 82',
  'M82 82 L82 18',
  'M82 18 L18 18',
  'M18 18 L18 82',
] as const;

function BreathBoxVisual({
  tickState,
  circleScale,
  bloomScale,
  rippleScale,
  reducedMotion,
  textColorVar,
  remainingWhole,
  running,
}: BoxVisualProps) {
  const filterId = React.useId().replace(/:/g, '');
  const { phaseIndex, segmentElapsedSec, segmentDurationSec } = tickState;
  const side = phaseIndex % 4;
  const u =
    segmentDurationSec > 0
      ? Math.min(1, segmentElapsedSec / segmentDurationSec)
      : 0;
  const dot = boxDotPct(side, u);

  const edgeOpacity = (i: number) =>
    reducedMotion
      ? i === side
        ? 0.76
        : 0.14
      : i === side
        ? 0.88 + u * 0.08
        : 0.1;

  return (
    <div
      className="relative mx-auto mb-4 flex h-[14rem] w-full max-w-[15.5rem] items-center justify-center [color:var(--accent-color)]"
      aria-hidden
    >
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{
          inset: '-14% 18%',
          background:
            'radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--accent-color) 42%, transparent) 0%, transparent 68%)',
        }}
        animate={{ scale: bloomScale }}
        transition={{ duration: reducedMotion ? 0.32 : 0 }}
      />

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-[2%]"
          animate={{ scale: rippleScale }}
          transition={{ duration: 0 }}
        >
          <svg viewBox="0 0 100 100" className="size-full opacity-35">
            <path
              d="M21 81 L81 81 L81 21 L21 21 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="3 11"
              transform="rotate(2 50 50)"
            />
          </svg>
        </motion.div>
      )}

      <div className="relative flex aspect-square w-full items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-[5%] size-[90%] overflow-visible opacity-95">
          <defs>
            <filter id={filterId} x="-55%" y="-55%" width="210%" height="210%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {BOX_EDGE_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={
                i === side
                  ? 'color-mix(in srgb, var(--accent-color-2, var(--accent-color)) 85%, transparent)'
                  : 'currentColor'
              }
              strokeWidth={i === side ? (reducedMotion ? 2.2 : 2.8 + u * 0.95) : 1.65}
              strokeLinecap="round"
              opacity={edgeOpacity(i)}
            />
          ))}
          <motion.circle
            fill="currentColor"
            stroke="color-mix(in srgb, var(--card-bg) 70%, transparent)"
            strokeWidth="0.6"
            filter={reducedMotion ? undefined : `url(#${filterId})`}
            initial={false}
            animate={{
              cx: dot.xPct,
              cy: dot.yPct,
              r: reducedMotion ? 5.2 : 5.65 + Math.sin(u * Math.PI) * 0.6,
              opacity: reducedMotion ? 0.92 : 0.94 + u * 0.05,
            }}
            transition={{ duration: reducedMotion ? 0 : 0.1, ease: 'easeOut' }}
          />
        </svg>

        <motion.div
          className="relative z-[1] flex h-[38%] min-h-[5.65rem] w-[38%] min-w-[5.65rem] flex-col items-center justify-center rounded-full border-[2px] px-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--accent-color) 42%, transparent)',
            boxShadow: reducedMotion
              ? undefined
              : `
                inset 0 0 20px color-mix(in srgb, var(--accent-color) 15%, transparent),
                0 0 26px color-mix(in srgb, var(--accent-color) 12%, transparent)
              `,
            background: `
              radial-gradient(
                circle at 38% 28%,
                color-mix(in srgb, var(--accent-color) 26%, transparent) 0%,
                transparent 55%
              ),
              color-mix(in srgb, var(--accent-color) 12%, transparent)
            `,
          }}
          animate={{ scale: circleScale }}
          transition={{ duration: reducedMotion ? 0.38 : 0, ease: 'easeOut' }}
        >
          <motion.p
            className="mb-0.5 text-center text-[10px] font-semibold uppercase leading-tight tracking-wider opacity-85 sm:text-[11px]"
            style={{ color: textColorVar }}
            key={`${phaseIndex}-${tickState.phase}`}
            initial={reducedMotion ? false : { opacity: 0.5 }}
            animate={{ opacity: 0.92 }}
          >
            {phaseLabel(tickState.phase)}
          </motion.p>
          <span
            className="ghibli-heading text-3xl font-bold tabular-nums leading-none tracking-tight"
            style={{ color: 'var(--accent-color)' }}
          >
            {running ? remainingWhole : '–'}
          </span>
        </motion.div>
      </div>
    </div>
  );
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );
}

function phaseLabel(kind: BreathPhaseKind): string {
  switch (kind) {
    case 'inhale':
      return 'Breathe in';
    case 'holdIn':
      return 'Hold';
    case 'exhale':
      return 'Breathe out';
    case 'holdOut':
      return 'Hold';
    default:
      return '';
  }
}

/** Drives phases with `requestAnimationFrame`; advances phases when elapsed exceeds segment duration. */
function useBreathCycle(
  running: boolean,
  preset: BreathingPreset,
  onTick: (info: {
    phaseIndex: number;
    phase: BreathPhaseKind;
    segmentElapsedSec: number;
    segmentDurationSec: number;
  }) => void
) {
  const presetRef = useRef(preset);
  presetRef.current = preset;

  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    let phaseIndex = 0;
    let segmentStartMs = performance.now();

    function advanceFromTime(nowMs: number) {
      const segs = presetRef.current.segments;
      if (!segs.length) return;

      let guard = 0;
      while (guard++ < segs.length * 4 + 16) {
        const seg = segs[phaseIndex % segs.length];
        const endMs = segmentStartMs + seg.durationSec * 1000;
        if (nowMs < endMs || seg.durationSec <= 0) {
          const elapsed = Math.min(
            seg.durationSec,
            Math.max(0, (nowMs - segmentStartMs) / 1000)
          );
          onTick({
            phaseIndex,
            phase: seg.kind,
            segmentElapsedSec: elapsed,
            segmentDurationSec: seg.durationSec,
          });
          return;
        }
        phaseIndex++;
        segmentStartMs = endMs;
      }
    }

    segmentStartMs = performance.now();

    let rafId = 0;
    function frame(now: number) {
      if (cancelled) return;
      advanceFromTime(now);
      rafId = requestAnimationFrame(frame);
    }

    phaseIndex = 0;
    segmentStartMs = performance.now();
    advanceFromTime(segmentStartMs);
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [running, preset.id, preset.segments, onTick]);
}

export interface BreathingGuideProps {
  /** When session is active and ducking enabled, parent lowers scene + ambience volumes. */
  onDuckingActiveChange?: (duckActive: boolean) => void;
}

export function BreathingGuide({ onDuckingActiveChange }: BreathingGuideProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [panelOpen, setPanelOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [presetId, setPresetId] = useState<string>(BREATHING_PRESETS[0].id);
  const [duckWhileGuiding, setDuckWhileGuiding] = useState(false);

  const preset = useMemo(() => getPreset(presetId), [presetId]);

  const tickRef = useRef<
    (info: {
      phaseIndex: number;
      phase: BreathPhaseKind;
      segmentElapsedSec: number;
      segmentDurationSec: number;
    }) => void
  >(() => {});

  const [tickState, setTickState] = useState<{
    phaseIndex: number;
    phase: BreathPhaseKind;
    segmentElapsedSec: number;
    segmentDurationSec: number;
  }>(() => ({
    phaseIndex: 0,
    phase: preset.segments[0].kind,
    segmentElapsedSec: 0,
    segmentDurationSec: preset.segments[0].durationSec,
  }));

  tickRef.current = (info) => setTickState(info);

  const stableTick = useCallback(
    (
      info: Parameters<NonNullable<(typeof tickRef)['current']>>[0]
    ) => {
      tickRef.current(info);
    },
    []
  );

  useBreathCycle(running, preset, stableTick);

  useEffect(() => {
    if (running) return;
    const p = getPreset(presetId);
    const first = p.segments[0];
    if (!first) return;
    setTickState({
      phaseIndex: 0,
      phase: first.kind,
      segmentElapsedSec: 0,
      segmentDurationSec: first.durationSec,
    });
  }, [running, presetId]);

  useEffect(() => {
    const duckActive = Boolean(running && duckWhileGuiding);
    onDuckingActiveChange?.(duckActive);
    return () => {
      onDuckingActiveChange?.(false);
    };
  }, [running, duckWhileGuiding, onDuckingActiveChange]);

  const remainingWhole = Math.max(
    0,
    Math.ceil(tickState.segmentDurationSec - tickState.segmentElapsedSec)
  );

  const circleScale = useMemo(() => {
    if (reducedMotion) {
      if (tickState.phase === 'inhale') return SCALE_EXPANDED;
      if (tickState.phase === 'exhale') return SCALE_COLLAPSED;
      if (tickState.phase === 'holdIn') return SCALE_EXPANDED;
      return SCALE_COLLAPSED;
    }
    const { phase, segmentElapsedSec, segmentDurationSec } = tickState;
    const u =
      segmentDurationSec > 0
        ? Math.min(1, segmentElapsedSec / segmentDurationSec)
        : 0;
    if (phase === 'inhale')
      return SCALE_COLLAPSED + (SCALE_EXPANDED - SCALE_COLLAPSED) * u;
    if (phase === 'exhale')
      return SCALE_EXPANDED + (SCALE_COLLAPSED - SCALE_EXPANDED) * u;
    if (phase === 'holdIn') return SCALE_EXPANDED;
    return SCALE_COLLAPSED;
  }, [tickState, reducedMotion]);

  const bloomScale = useMemo(
    () => bloomScaleFromOrbScale(circleScale),
    [circleScale]
  );
  const rippleScale = useMemo(
    () => rippleScaleFromOrbScale(circleScale),
    [circleScale]
  );

  const viz = resolvePresetViz(preset);

  const vizContent =
    viz === 'box' ? (
      <BreathBoxVisual
        tickState={tickState}
        circleScale={circleScale}
        bloomScale={bloomScale}
        rippleScale={rippleScale}
        reducedMotion={reducedMotion}
        textColorVar="var(--text-color)"
        remainingWhole={remainingWhole}
        running={running}
      />
    ) : (
      <BreathOrbVisual
        tickState={tickState}
        circleScale={circleScale}
        bloomScale={bloomScale}
        rippleScale={rippleScale}
        reducedMotion={reducedMotion}
        running={running}
        textColorVar="var(--text-color)"
        remainingWhole={remainingWhole}
      />
    );

  return (
    <div
      className="fixed z-[42] pointer-events-none"
      style={{
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom:
          'max(13rem, calc(12rem + env(safe-area-inset-bottom)))',
      }}
      aria-live="polite"
    >
      <div className="pointer-events-auto ml-auto flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2">
        {!panelOpen ? (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="ghibli-card flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border border-black/[0.08] hover:opacity-90 transition-opacity"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--card-bg) 95%, transparent)',
              color: 'var(--text-color)',
            }}
            aria-expanded={false}
            aria-controls="breathing-guide-panel"
          >
            <Wind
              className="w-5 h-5 shrink-0 opacity-85"
              style={{ color: 'var(--accent-color)' }}
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-sm font-semibold">Breathing guide</span>
            <ChevronUp className="w-4 h-4 opacity-50 shrink-0" aria-hidden />
          </button>
        ) : (
          <AnimatePresence>
            <motion.div
              id="breathing-guide-panel"
              key="panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={
                reducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }
              }
              className="ghibli-card p-4 shadow-xl border border-black/[0.08] rounded-[var(--ui-radius)] w-full backdrop-blur-sm"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--card-bg) 96%, transparent)',
                color: 'var(--text-color)',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <Wind
                    className="w-5 h-5 shrink-0"
                    style={{ color: 'var(--accent-color)' }}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-sm font-bold ghibli-heading">
                    Breathing guide
                  </span>
                </div>
                <button
                  type="button"
                  className="p-1 rounded-lg hover:bg-black/[0.05] shrink-0 -mr-1 -mt-0.5 opacity-75"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Collapse breathing guide"
                >
                  <ChevronDown className="w-5 h-5" aria-hidden />
                </button>
              </div>

              <p className="text-[10px] leading-snug opacity-65 mb-3">
                Relaxation cues only — not medical advice; stop if you feel
                dizzy.
              </p>

              <label className="block text-[10px] uppercase tracking-wide font-semibold opacity-65 mb-1.5">
                Pattern
              </label>
              <select
                value={presetId}
                disabled={running}
                onChange={(e) => {
                  const next = getPreset(e.target.value);
                  setPresetId(next.id);
                  setTickState({
                    phaseIndex: 0,
                    phase: next.segments[0].kind,
                    segmentElapsedSec: 0,
                    segmentDurationSec: next.segments[0].durationSec,
                  });
                }}
                className="w-full text-sm rounded-xl border px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/35 cursor-pointer bg-white/[0.6]"
                style={{ borderColor: 'var(--divider-color)', color: 'var(--text-color)' }}
              >
                {BREATHING_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <p className="text-[11px] leading-snug opacity-75 mb-3">
                {preset.description}
              </p>

              {vizContent}

              <label className="flex items-center gap-2 text-xs cursor-pointer mb-4 select-none">
                <input
                  type="checkbox"
                  checked={duckWhileGuiding}
                  disabled={running}
                  onChange={(e) => setDuckWhileGuiding(e.target.checked)}
                  className="rounded border-[var(--divider-color)] accent-[var(--accent-color)]"
                />
                <span className="opacity-90">Lower music &amp; ambience while guiding</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRunning((r) => !r);
                    if (!running) {
                      const p = getPreset(presetId);
                      setTickState({
                        phaseIndex: 0,
                        phase: p.segments[0].kind,
                        segmentElapsedSec: 0,
                        segmentDurationSec: p.segments[0].durationSec,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  {running ? (
                    <>
                      <Pause className="w-4 h-4" strokeWidth={2.5} />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" strokeWidth={2.5} />
                      Start
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
