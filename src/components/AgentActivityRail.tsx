import React, { useMemo } from 'react';
import {
  Loader2, Check, X, Minus, RotateCcw,
  Clapperboard, Palette, Frame, Music2, Feather, Glasses, Cpu,
} from 'lucide-react';
import type { LogEntry, AgentStatus } from '../agents/types';

const ROSTER: {
  id: string;
  agent: string;
  title: string;
  subtitle: string;
  Icon: typeof Loader2;
  accent: string;
  retryable: boolean;
}[] = [
  {
    id: 'director',
    agent: 'Director',
    title: 'Director',
    subtitle: 'Running the whole show',
    Icon: Clapperboard,
    accent: '#7c3aed',
    retryable: true,
  },
  {
    id: 'themedesigner',
    agent: 'ThemeDesigner',
    title: 'Theme',
    subtitle: 'Vibes & palettes',
    Icon: Palette,
    accent: '#db2777',
    retryable: true,
  },
  {
    id: 'artdirector',
    agent: 'ArtDirector',
    title: 'Art Director',
    subtitle: 'Painting the backdrop',
    Icon: Frame,
    accent: '#ea580c',
    retryable: true,
  },
  {
    id: 'composer',
    agent: 'Composer',
    title: 'Composer',
    subtitle: 'Writing the score',
    Icon: Music2,
    accent: '#059669',
    retryable: true,
  },
  {
    id: 'scenepoet',
    agent: 'ScenePoet',
    title: 'Scene Poet',
    subtitle: 'Finding the words',
    Icon: Feather,
    accent: '#0284c7',
    retryable: true,
  },
  {
    id: 'critic',
    agent: 'Critic',
    title: 'Critic',
    subtitle: 'Keeping it tight',
    Icon: Glasses,
    accent: '#d97706',
    retryable: false,
  },
  {
    id: 'system',
    agent: 'System',
    title: 'System',
    subtitle: 'Holding it together',
    Icon: Cpu,
    accent: '#64748b',
    retryable: false,
  },
];

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
  const currentLogs = useMemo(
    () => since > 0 ? logs.filter((l) => l.timestamp >= since) : logs,
    [logs, since],
  );

  const activeCount = useMemo(
    () => currentLogs.filter((l) => l.status === 'running').length,
    [currentLogs]
  );

  const rosterState = useMemo(() => {
    return ROSTER.map((def) => {
      const entry = latestLogForAgent(currentLogs, def.agent);
      const status: AgentStatus | 'pending' = entry?.status ?? 'pending';
      return { def, entry, status };
    });
  }, [currentLogs]);

  return (
    <div
      className="shrink-0 z-20 border-t backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] [font-family:var(--font-family)] [color:var(--text-color)]"
      style={{
        borderTopColor: 'var(--divider-color)',
        backgroundColor: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
      }}
    >
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
                      <p
                        className="text-xs font-bold leading-tight truncate"
                        style={{ color: 'var(--text-color)' }}
                      >
                        {def.title}
                      </p>
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
