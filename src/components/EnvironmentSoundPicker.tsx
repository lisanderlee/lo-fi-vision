import React from 'react';
import { CloudRain, Trees, Flame, Music, Volume2 } from 'lucide-react';
import { ENVIRONMENT_SOUNDS, EnvironmentSoundId } from '../constants/envSounds';

interface EnvironmentSoundPickerProps {
  selectedId: EnvironmentSoundId | null;
  onSelectId: (id: EnvironmentSoundId) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
}

const ICON_MAP: Record<EnvironmentSoundId, React.ReactNode> = {
  rain: <CloudRain size={18} />,
  forest: <Trees size={18} />,
  fireplace: <Flame size={18} />,
  waves: <Music size={18} />, // Fallback
  cafe: <Music size={18} />, // Fallback
};

export const EnvironmentSoundPicker: React.FC<EnvironmentSoundPickerProps> = ({
  selectedId,
  onSelectId,
  volume,
  onVolumeChange,
}) => {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        {ENVIRONMENT_SOUNDS.map((sound) => (
          <button
            key={sound.id}
            onClick={() => onSelectId(sound.id)}
            className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
              selectedId === sound.id
                ? 'bg-black text-white shadow-md'
                : 'bg-white/50 hover:bg-white/80 text-black/60'
            }`}
            title={sound.label}
          >
            {ICON_MAP[sound.id] || <Music size={18} />}
            <span className="text-xs font-semibold hidden sm:inline">{sound.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center gap-3 bg-white/50 px-4 py-2 rounded-lg">
        <Volume2 size={16} className="text-black/40" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 accent-black h-1 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};
