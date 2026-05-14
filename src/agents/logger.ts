import { LogEntry, AgentStatus } from './types';

export class Logger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(agent: string, headline: string, detail?: string, args?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      agent,
      status: 'running',
      headline,
      detail,
      args,
      timestamp: Date.now(),
    };
    this.logs.push(entry);
    this.notify();
    return entry.id;
  }

  update(id: string, updates: Partial<LogEntry>) {
    const index = this.logs.findIndex(l => l.id === id);
    if (index !== -1) {
      if (updates.status === 'done' || updates.status === 'failed') {
        updates.duration = Date.now() - this.logs[index].timestamp;
      }
      this.logs[index] = { ...this.logs[index], ...updates };
      this.notify();
    }
  }

  getLogs() {
    return [...this.logs];
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.logs]));
  }
}

export const logger = new Logger();
