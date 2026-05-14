export type EnvironmentSoundId = 'rain' | 'forest' | 'fireplace' | 'waves' | 'cafe';

export interface EnvironmentSound {
  id: EnvironmentSoundId;
  label: string;
  src: string;
}

export const ENVIRONMENT_SOUNDS: EnvironmentSound[] = [
  { id: 'rain', label: 'Rain', src: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3' },
  { id: 'forest', label: 'Forest', src: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-1210.mp3' },
  { id: 'fireplace', label: 'Fireplace', src: 'https://assets.mixkit.co/sfx/preview/mixkit-cracking-fireplace-754.mp3' },
];
