import React from "react";
import { CloudRain, Flame, TreePine, Volume2 } from "lucide-react";
import { ENVIRONMENT_SOUNDS, type EnvironmentSoundId } from "../constants/envSounds";

const ICONS = {
  rain: CloudRain,
  forest: TreePine,
  fireplace: Flame,
} as const;

type Props = {
  selectedId: EnvironmentSoundId | null;
  onSelectId: (id: EnvironmentSoundId) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
};

export function EnvironmentSoundPicker({ selectedId, onSelectId, volume, onVolumeChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 shrink-0 hidden sm:inline">
          Ambience
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {ENVIRONMENT_SOUNDS.map((track) => {
            const Icon = ICONS[track.id as keyof typeof ICONS];
            const sel = selectedId === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => onSelectId(track.id)}
                title={track.label}
                className={`flex items-center justify-center rounded-lg p-2 transition-colors shrink-0 ${
                  sel
                    ? "bg-[var(--accent-color)] text-white shadow-sm"
                    : "bg-black/5 hover:bg-black/10 text-current"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="sr-only">{track.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex items-center gap-2 flex-1 sm:max-w-xs sm:flex-none sm:w-56"
        title="Ambience volume. Lyria level is fixed lower in the app so beds can sit forward—raise this toward max if needed."
      >
        <Volume2 size={16} className="shrink-0 opacity-40" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Ambience volume"
          className="w-full h-2 accent-[var(--accent-color)] cursor-pointer"
        />
      </div>
    </div>
  );
}

