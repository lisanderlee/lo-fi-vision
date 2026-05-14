/**
 * Ambient MP3s in `public/Mp3/` (served at `/Mp3/…` by Vite in dev and copied to `dist` on build).
 * File names must match on disk exactly (case-sensitive on Linux servers).
 */
export const ENVIRONMENT_SOUNDS = [
  {
    id: "rain",
    label: "Rain",
    src: "/Mp3/Rain.mp3",
  },
  {
    id: "forest",
    label: "Forest",
    src: "/Mp3/Forrest.mp3",
  },
  {
    id: "fireplace",
    label: "Fireplace",
    src: "/Mp3/Fireplace.mp3",
  },
] as const;

export type EnvironmentSoundId = (typeof ENVIRONMENT_SOUNDS)[number]["id"];
