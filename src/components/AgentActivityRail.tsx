import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2, Check, X, Minus, RotateCcw, CircleHelp,
} from 'lucide-react';
import type { LogEntry, AgentStatus } from '../agents/types';
import { AGENT_ROSTER } from '../constants/agentRoster';

function latestLogForAgent(logs: LogEntry[], agent: string): LogEntry | undefined {
  let best: LogEntry | undefined;
  for (const log of logs) {
    if (log.agent !== agent) continue;
    if (!best || log.timestamp > best.timestamp) best = log;
  }
  return best;
}

function statusLabel(status: AgentStatus | 'pending'): string {
  switch (status) {
    case 'running': return 'Cooking…';
    case 'done':    return 'Done!';
    case 'failed':  return 'Uh oh!';
    case 'idle':
    case 'pending':
    default:        return 'Snoozing';
  }
}

function StatusBadge({ status }: { status: AgentStatus | 'pending' }) {
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-color)' }} aria-hidden />;
  }
  if (status === 'done') {
    return <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.5} aria-hidden />;
  }
  if (status === 'failed') {
    return <X className="w-3.5 h-3.5 text-red-500" strokeWidth={2.5} aria-hidden />;
  }
  return <Minus className="w-3.5 h-3.5 opacity-35" style={{ color: 'var(--text-color)' }} strokeWidth={2} aria-hidden />;
}

export interface AgentActivityRailProps {
  logs: LogEntry[];
  onRetry?: (agentName: string) => void;
  /** Only show entries at or after this timestamp. 0 = show all. */
  since?: number;
}

export function AgentActivityRail({ logs, onRetry, since = 0 }: AgentActivityRailProps) {
  const [openAboutId, setOpenAboutId] = useState<string | null>(null);
  /** Ignore backdrop dismiss right after open (avoids iOS synthetic click hitting the overlay). */
  const suppressBackdropCloseUntilRef = useRef(0);

  const closeAbout = useCallback(() => setOpenAboutId(null), []);

  useEffect(() => {
    if (!openAboutId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAbout();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openAboutId, closeAbout]);

  const currentLogs = useMemo(
    () => since > 0 ? logs.filter((l) => l.timestamp >= since) : logs,
    [logs, since],
  );

  const activeCount = useMemo(
    () => currentLogs.filter((l) => l.status === 'running').length,
    [currentLogs]
  );

  const rosterState = useMemo(() => {
    return AGENT_ROSTER.map((def) => {
      const entry = latestLogForAgent(currentLogs, def.agent);
      const status: AgentStatus | 'pending' = entry?.status ?? 'pending';
      return { def, entry, status };
    });
  }, [currentLogs]);

  const openDef = openAboutId ? AGENT_ROSTER.find((d) => d.id === openAboutId) : undefined;

  const aboutPortal =
    openAboutId &&
    openDef &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        {/* pointerdown (not click) avoids open-then-close when the same click would hit the overlay after commit */}
        <div
          className="fixed inset-0 z-[100]"
          style={{ zIndex: 10000, backgroundColor: 'rgba(15, 15, 15, 0.35)' }}
          aria-hidden
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (typeof performance !== 'undefined' &&
                performance.now() < suppressBackdropCloseUntilRef.current) {
              return;
            }
            closeAbout();
          }}
        />
        <div
          id="agent-about-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-about-panel-title"
          className="fixed z-[110] rounded-[var(--ui-radius)] border overflow-y-auto text-left [font-family:var(--font-family)] w-[min(92vw,32rem)] max-h-[min(78vh,36rem)] p-6 sm:p-8 box-border"
          style={{
            zIndex: 10001,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            borderColor: 'var(--divider-color)',
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-color)',
            boxShadow: '0 24px 64px -16px rgba(0,0,0,0.45)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
            <p
              id="agent-about-panel-title"
              className="text-lg sm:text-xl font-bold leading-tight"
              style={{ color: 'var(--text-color)' }}
            >
              {openDef.title}
            </p>
            <p
              className="text-sm sm:text-[15px] mt-4 leading-relaxed opacity-92"
              style={{ color: 'var(--text-color)' }}
            >
              {openDef.about}
            </p>
        </div>
      </>,
      document.body,
    );

  return (
    <div
      className="shrink-0 z-20 border-t backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] [font-family:var(--font-family)] [color:var(--text-color)]"
      style={{
        borderTopColor: 'var(--divider-color)',
        backgroundColor: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
      }}
    >
      {aboutPortal}
      <div className="px-3 sm:px-4 pt-2.5 pb-1">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--accent-color)' }}
              aria-hidden
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-wider truncate opacity-75"
              style={{ color: 'var(--text-color)' }}
            >
              AI crew
            </span>
            {activeCount > 0 && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                style={{
                  color: 'var(--accent-color)',
                  backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, var(--card-bg))',
                }}
              >
                {activeCount} active
              </span>
            )}
          </div>
          <p
            className="text-[10px] hidden sm:block truncate opacity-60"
            style={{ color: 'var(--text-color)' }}
          >
            Specialists light up as your scene is built
          </p>
        </div>

        <div
          className="flex flex-wrap justify-center gap-2 pb-2 px-1"
          role="list"
          aria-label="Agent activity"
        >
          {rosterState.map(({ def, entry, status }) => {
            const isLive = status === 'running';
            const isDone = status === 'done';
            const isFailed = status === 'failed';
            const { Icon } = def;

            return (
              <div
                key={def.id}
                role="listitem"
                className="w-[200px] sm:w-[236px] shrink-0 rounded-[var(--ui-radius)] border px-3 py-2.5"
                style={{
                  borderColor: isLive
                    ? `${def.accent}66`
                    : isDone
                    ? `${def.accent}33`
                    : 'var(--divider-color)',
                  boxShadow: isLive ? `0 4px 14px -4px ${def.accent}40` : undefined,
                  backgroundColor: isLive
                    ? `color-mix(in srgb, ${def.accent} 10%, var(--card-bg))`
                    : 'color-mix(in srgb, var(--bg-color) 35%, var(--card-bg))',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${def.accent}22`,
                      border: `1.5px solid ${def.accent}55`,
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: def.accent }}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-0.5 min-w-0 flex-1">
                        <p
                          className="text-xs font-bold leading-tight truncate"
                          style={{ color: 'var(--text-color)' }}
                        >
                          {def.title}
                        </p>
                        <button
                          type="button"
                          id={`agent-about-trigger-${def.id}`}
                          aria-label={`What ${def.title} does`}
                          aria-expanded={openAboutId === def.id}
                          aria-controls="agent-about-panel"
                          onClick={(e) => {
                            e.stopPropagation();
                            queueMicrotask(() => {
                              setOpenAboutId((prev) => {
                                if (prev === def.id) return null;
                                if (typeof performance !== 'undefined') {
                                  suppressBackdropCloseUntilRef.current = performance.now() + 320;
                                }
                                return def.id;
                              });
                            });
                          }}
                          className="shrink-0 rounded-full p-0.5 opacity-55 hover:opacity-100 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                          style={{
                            color: 'var(--text-color)',
                            outlineColor: def.accent,
                          }}
                        >
                          <CircleHelp className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                      <span className="shrink-0 flex items-center" title={statusLabel(status)}>
                        <StatusBadge status={status} />
                      </span>
                    </div>

                    <p
                      className="text-[10px] mt-0.5 leading-snug opacity-55"
                      style={{ color: 'var(--text-color)' }}
                    >
                      {def.subtitle}
                    </p>

                    <p
                      className="text-[10px] mt-1.5 leading-snug break-words opacity-90"
                      style={{ color: 'var(--text-color)' }}
                      title={entry?.headline}
                    >
                      {entry ? (
                        <>
                          <span className="font-semibold opacity-100">{statusLabel(status)}</span>{' '}
                          {entry.headline}
                        </>
                      ) : (
                        <span className="opacity-40 italic">Waiting for a vision shift…</span>
                      )}
                    </p>

                    {isFailed && def.retryable && onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(def.agent)}
                        className="mt-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 active:scale-95"
                        style={{
                          color: def.accent,
                          backgroundColor: `${def.accent}20`,
                          border: `1px solid ${def.accent}44`,
                        }}
                      >
                        <RotateCcw className="w-2.5 h-2.5" strokeWidth={2.5} />
                        Run
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {rosterState
          .filter(({ status }) => status === 'running')
          .map(({ def }) => def.title)
          .join(', ') || 'No agents busy'}
      </span>
    </div>
  );
}
