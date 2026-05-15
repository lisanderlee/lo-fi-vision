export type AgentStatus = 'idle' | 'running' | 'done' | 'failed';

export interface LogEntry {
  id: string;
  agent: string;
  category?: string;
  status: AgentStatus;
  headline: string;
  detail?: string;
  timestamp: number;
  duration?: number;
  args?: any;
  result?: any;
}

/** Optional structured palette from the model; merged into cssVariables during orchestration. */
export interface ThemePaletteHex {
  bg?: string;
  text?: string;
  cardBg?: string;
  accent?: string;
  accent2?: string;
  btnBg?: string;
  btnText?: string;
  uiRadius?: string;
  cardShadow?: string;
  dividerColor?: string;
}

export type MotionPreset = 'none' | 'scanlines' | 'flicker' | 'drift' | 'rain' | 'ember' | 'dust';
export type WeatherIconAnimation = 'none' | 'pulse' | 'drift' | 'sway' | 'shake' | 'glitch' | 'spin' | 'tilt';
export type TextRevealStyle = 'crossfade' | 'typewriter' | 'word-stagger' | 'scramble-decode' | 'slot-roll';
export type MusicScale =
  | 'SCALE_UNSPECIFIED' | 'C_MAJOR_A_MINOR' | 'D_FLAT_MAJOR_B_FLAT_MINOR'
  | 'D_MAJOR_B_MINOR' | 'E_FLAT_MAJOR_C_MINOR' | 'E_MAJOR_D_FLAT_MINOR'
  | 'F_MAJOR_D_MINOR' | 'G_FLAT_MAJOR_E_FLAT_MINOR' | 'G_MAJOR_E_MINOR'
  | 'A_FLAT_MAJOR_F_MINOR' | 'A_MAJOR_G_FLAT_MINOR' | 'B_FLAT_MAJOR_G_MINOR'
  | 'B_MAJOR_A_FLAT_MINOR';
export type MusicMode = 'QUALITY' | 'DIVERSITY' | 'VOCALIZATION';
export type ToolName = 'design_theme' | 'generate_artwork' | 'write_announcement' | 'compose_audio';

export interface GoogleFontReq {
  family: string;
  weights?: number[];
  italic?: boolean;
}

export interface AestheticBrief {
  prompt: string;
  userImage?: { base64: string; mimeType: string };
}

export interface ThemeSpec {
  cssVariables: string;
  rationale: string;
  motionPreset: MotionPreset;
  weatherIconAnimation: WeatherIconAnimation;
  textRevealStyle: TextRevealStyle;
  googleFonts: GoogleFontReq[];
}

export interface ArtworkSpec {
  imageUrl: string;
  imagePrompt: string;
  imageBase64: string;
  imageMimeType: string;
}

export interface Announcement {
  text: string;
  voice: string;
}

export interface MusicBrief {
  weightedPrompts: { text: string; weight: number }[];
  config?: {
    bpm?: number;
    density?: number;
    brightness?: number;
    guidance?: number;
    temperature?: number;
    scale?: MusicScale;
    musicGenerationMode?: MusicMode;
    muteBass?: boolean;
    muteDrums?: boolean;
    onlyBassAndDrums?: boolean;
  };
}

export interface AudioSpec {
  vibe: string;
  musicBrief?: MusicBrief;
}

export interface Critique {
  verdict: 'approve' | 'revise';
  notes: string;
  revise: ToolName[];
}

export interface MultiverseState {
  cssVariables: string;
  motionPreset: MotionPreset;
  weatherIconAnimation: WeatherIconAnimation;
  textRevealStyle?: TextRevealStyle;
  tone: string;
  layout?: any;
  musicStyle?: string;
  audioUrl?: string;
  musicBrief?: MusicBrief;
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
