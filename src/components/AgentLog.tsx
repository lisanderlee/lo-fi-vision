import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Activity,
  Info
} from 'lucide-react';
import { LogEntry, AgentStatus } from '../agents/types';

interface AgentLogProps {
  logs: LogEntry[];
  onClose?: () => void;
  isOpen: boolean;
}

export function AgentLog({ logs, onClose, isOpen }: AgentLogProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className={`flex flex-col h-full bg-[#fdfbf7] border-l border-black/5 overflow-hidden transition-all duration-300 ${isOpen ? 'w-80' : 'w-0'}`}>
      <div className="p-4 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Terminal size={16} />
          <span>REAL-TIME INTELLIGENCE</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest opacity-40">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {logs.slice().reverse().map((log) => (
            <div 
              key={log.id} 
              className={`rounded-lg border border-black/5 transition-all ${
                log.status === 'running' ? 'bg-black/5' : 'bg-transparent'
              }`}
            >
              <button 
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full text-left p-3 flex items-start gap-3"
              >
                <div className="mt-1">
                  {log.status === 'running' && <Activity size={14} className="animate-spin text-green-600" />}
                  {log.status === 'done' && <CheckCircle2 size={14} className="text-green-600" />}
                  {log.status === 'failed' && <XCircle size={14} className="text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">{log.agent}</span>
                    <span className="text-[9px] opacity-30">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <h4 className="text-xs font-semibold mt-0.5 truncate">{log.headline}</h4>
                  {log.detail && (
                    <p className="text-[10px] opacity-60 mt-1 line-clamp-2">{log.detail}</p>
                  )}
                </div>
              </button>
              
              <AnimatePresence>
                {expandedId === log.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-black/5 border-t border-black/5"
                  >
                    <div className="p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
                      {log.args && (
                        <div className="mb-2">
                          <span className="opacity-40">INPUT:</span><br />
                          {JSON.stringify(log.args, null, 2)}
                        </div>
                      )}
                      {log.result && (
                        <div>
                          <span className="opacity-40">RESULT:</span><br />
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
