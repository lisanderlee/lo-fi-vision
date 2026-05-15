import React from "react";
import { CloudRain, Flame, TreePine, Volume2, Music } from "lucide-react";
import { ENVIRONMENT_SOUNDS, type EnvironmentSoundId } from "../constants/envSounds";

const ICONS = {
  rain: CloudRain,
  forest: TreePine,
  fireplace: Flame,
} as const;

type Props = {
  selectedId: EnvironmentSoundId | null;
  onSelectId: (id: EnvironmentSoundId) => void;
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
  mixRatio: number;
  onMixRatioChange: (v: number) => void;
  disabled?: boolean;
};

export function EnvironmentSoundPicker({
  selectedId,
  onSelectId,
  masterVolume,
  onMasterVolumeChange,
  mixRatio,
  onMixRatioChange,
  disabled = false,
}: Props) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 transition-opacity duration-300 ${disabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
      {/* Ambience track icons */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 shrink-0 hidden sm:inline">
          Ambience
        </span>
        <div className="flex items-center gap-1.5">
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

      {/* Crossfader mixer */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0"
        title="Mix between ambience (left) and scene music (right)"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 shrink-0 flex items-center gap-0.5">
          <TreePine size={12} className="opacity-70" />
          <span className="hidden sm:inline">ENV</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={mixRatio}
          onChange={(e) => onMixRatioChange(parseFloat(e.target.value))}
          aria-label="Mix: environment vs music"
          className="flex-1 h-2 accent-[var(--accent-color)] cursor-pointer"
        />
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 shrink-0 flex items-center gap-0.5">
          <span className="hidden sm:inline">MUSIC</span>
          <Music size={12} className="opacity-70" />
        </span>
      </div>

      {/* Master volume */}
      <div
        className="flex items-center gap-2 shrink-0 sm:w-40"
        title="Master volume — scales both tracks together"
      >
        <Volume2 size={16} className="shrink-0 opacity-40" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={masterVolume}
          onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
          aria-label="Master volume"
          className="w-full h-2 accent-[var(--accent-color)] cursor-pointer"
        />
      </div>
    </div>
  );
}
