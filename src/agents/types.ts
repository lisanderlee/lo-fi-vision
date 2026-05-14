export type AgentStatus = 'idle' | 'running' | 'done' | 'failed';

export interface LogEntry {
  id: string;
  agent: string;
  status: AgentStatus;
  headline: string;
  detail?: string;
  timestamp: number;
  duration?: number;
  args?: any;
  result?: any;
}

export interface MultiverseState {
  cssVariables: string;
  motionPreset: 'none' | 'scanlines' | 'flicker' | 'drift' | 'rain' | 'ember' | 'dust';
  weatherIconAnimation: 'none' | 'pulse' | 'drift' | 'sway' | 'shake' | 'glitch' | 'spin' | 'tilt';
  tone: string;
  layout?: any; // The LayoutNode tree
  musicStyle?: string;
  audioUrl?: string;
  backgroundImage?: string;
}

export type LayoutNode = {
  id: string;
  type: 'container' | 'widget';
  direction?: 'horizontal' | 'vertical' | 'grid';
  gap?: 'none' | 'small' | 'medium' | 'large';
  padding?: 'none' | 'small' | 'medium' | 'large';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'stretch';
  gridCols?: number;
  hasCardBackground?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'double' | 'none' | 'thick';
  rotation?: number;
  children?: LayoutNode[];
  widgetType?: string;
};
