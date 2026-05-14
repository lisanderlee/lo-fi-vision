import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { LogEntry } from '../agents/types';

interface AgentLogProps {
  logs: LogEntry[];
  onClose?: () => void;
  isOpen: boolean;
}

/** YouTube-style fixed panel: never inherits multiverse theme. */
export function AgentLog({ logs, isOpen }: AgentLogProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div
      className={`flex flex-col h-full shrink-0 border-l overflow-hidden transition-all duration-300 bg-white text-[#0f0f0f] ${isOpen ? 'w-80' : 'w-0'}`}
      style={{ borderLeftColor: '#e5e5e5' }}
    >
      <div
        className="p-4 flex items-center justify-between border-b shrink-0"
        style={{ borderBottomColor: '#e5e5e5' }}
      >
        <div className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <Terminal size={16} className="text-[#0f0f0f]" strokeWidth={1.5} />
          <span className="uppercase text-xs letter-spacing-wide">Real-time intelligence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-[10px] uppercase tracking-widest text-[#606060]">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="space-y-2">
          {logs.slice().reverse().map((log) => (
            <div
              key={log.id}
              className={`rounded-lg border transition-all ${
                log.status === 'running' ? 'bg-[#f1f1f1]' : 'bg-transparent'
              }`}
              style={{ borderColor: '#e5e5e5' }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full text-left p-3 flex items-start gap-3 text-[#0f0f0f]"
              >
                <div className="mt-1 shrink-0">
                  {log.status === 'running' && <Activity size={14} className="animate-spin text-[#065efd]" />}
                  {log.status === 'done' && <CheckCircle2 size={14} className="text-[#065efd]" />}
                  {log.status === 'failed' && <XCircle size={14} className="text-[#cc0000]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#606060]">
                      {log.agent}
                    </span>
                    <span className="text-[9px] text-[#606060] tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold mt-0.5 truncate text-[#0f0f0f]">{log.headline}</h4>
                  {log.detail && <p className="text-[10px] text-[#606060] mt-1 line-clamp-2">{log.detail}</p>}
                </div>
              </button>

              <AnimatePresence>
                {expandedId === log.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t"
                    style={{ borderTopColor: '#e5e5e5', backgroundColor: '#f9f9f9' }}
                  >
                    <div className="p-3 text-[10px] font-mono whitespace-pre-wrap break-all text-[#0f0f0f]">
                      {log.args && (
                        <div className="mb-2">
                          <span className="text-[#606060]">INPUT:</span>
                          <br />
                          {JSON.stringify(log.args, null, 2)}
                        </div>
                      )}
                      {log.result && (
                        <div>
                          <span className="text-[#606060]">RESULT:</span>
                          <br />
                          {JSON.stringify(log.result, null, 2)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

