export type BreathPhaseKind = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

/** One timed segment of a breathing cycle */
export interface BreathSegment {
  kind: BreathPhaseKind;
  durationSec: number;
}

/** `box` — square tracer tuned for classic four-phase box rhythms. `orb` — radial / ring visuals. */
export type BreathVizStyle = 'orb' | 'box';

export interface BreathingPreset {
  id: string;
  label: string;
  description: string;
  segments: BreathSegment[];
  /** Visualization style; defaults to `orb`. */
  viz?: BreathVizStyle;
}

export const BREATHING_PRESETS: BreathingPreset[] = [
  {
    id: 'coherent',
    label: 'Coherent · ~6 breaths/min',
    description:
      'Slow equal inhale and exhale (about 5.5s each). Many people find this steady rhythm relaxing — not medical advice.',
    segments: [
      { kind: 'inhale', durationSec: 5.5 },
      { kind: 'exhale', durationSec: 5.5 },
    ],
  },
  {
    id: 'coherent-quick',
    label: 'Coherent · 4-4 (shorter)',
    description:
      'Same idea as coherent breathing, faster cadence (~7.5 breaths/min).',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'exhale', durationSec: 4 },
    ],
  },
  {
    id: 'coherent-deep',
    label: 'Coherent · 6.5-6.5 (slower)',
    description:
      'Longer breaths (~4.5 breaths/min) for a mellower tempo.',
    segments: [
      { kind: 'inhale', durationSec: 6.5 },
      { kind: 'exhale', durationSec: 6.5 },
    ],
  },
  {
    id: 'box',
    label: 'Box · 4-4-4-4',
    description:
      'Equal inhale, hold, exhale, hold — often used for focus under stress.',
    viz: 'box',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'holdIn', durationSec: 4 },
      { kind: 'exhale', durationSec: 4 },
      { kind: 'holdOut', durationSec: 4 },
    ],
  },
  {
    id: 'box-gentle',
    label: 'Gentle box · 3-3-3-3',
    description:
      'A shorter box pattern if four-second phases feel long.',
    viz: 'box',
    segments: [
      { kind: 'inhale', durationSec: 3 },
      { kind: 'holdIn', durationSec: 3 },
      { kind: 'exhale', durationSec: 3 },
      { kind: 'holdOut', durationSec: 3 },
    ],
  },
  {
    id: 'box-5555',
    label: 'Box · 5-5-5-5',
    description:
      'Longer quadrants — more time on each edge of the square.',
    viz: 'box',
    segments: [
      { kind: 'inhale', durationSec: 5 },
      { kind: 'holdIn', durationSec: 5 },
      { kind: 'exhale', durationSec: 5 },
      { kind: 'holdOut', durationSec: 5 },
    ],
  },
  {
    id: 'box-6666',
    label: 'Box · 6-6-6-6',
    description:
      'Slow, heavy box — good when you want each side to feel spacious.',
    viz: 'box',
    segments: [
      { kind: 'inhale', durationSec: 6 },
      { kind: 'holdIn', durationSec: 6 },
      { kind: 'exhale', durationSec: 6 },
      { kind: 'holdOut', durationSec: 6 },
    ],
  },
  {
    id: 'triangle',
    label: 'Triangle · 4-4-6',
    description:
      'Inhale, hold at the top, longer exhale — a common “relaxing” triangle.',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'holdIn', durationSec: 4 },
      { kind: 'exhale', durationSec: 6 },
    ],
  },
  {
    id: 'exhale-long',
    label: 'Longer exhale · 4-6',
    description:
      'Slightly extended exhale; some people find a longer out-breath grounding.',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'exhale', durationSec: 6 },
    ],
  },
  {
    id: 'exhale-deep',
    label: 'Longer exhale · 4-8',
    description:
      'Even more time on the exhale; ease up if it feels like too much.',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'exhale', durationSec: 8 },
    ],
  },
  {
    id: 'cadence-55',
    label: 'Steady · 5-5 (no box holds)',
    description:
      'Ten-second cycle, equal in and out — simple metronome for the breath.',
    segments: [
      { kind: 'inhale', durationSec: 5 },
      { kind: 'exhale', durationSec: 5 },
    ],
  },
  {
    id: 'relax-478',
    label: 'Wind-down · 4-7-8',
    description:
      'Popular wind-down cue; holds can feel uncomfortable for some — pause anytime.',
    segments: [
      { kind: 'inhale', durationSec: 4 },
      { kind: 'holdIn', durationSec: 7 },
      { kind: 'exhale', durationSec: 8 },
    ],
  },
  {
    id: 'even-678',
    label: 'Even 6-7-8',
    description:
      'Like 4-7-8 but with a slightly longer inhale — still a wind-down shape.',
    segments: [
      { kind: 'inhale', durationSec: 6 },
      { kind: 'holdIn', durationSec: 7 },
      { kind: 'exhale', durationSec: 8 },
    ],
  },
];

export function getPreset(id: string): BreathingPreset {
  const p = BREATHING_PRESETS.find((x) => x.id === id);
  return p ?? BREATHING_PRESETS[0];
}
