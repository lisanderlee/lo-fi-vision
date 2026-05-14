import React from 'react';
import { Play, Pause, Music } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageMusicPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  audioUrl?: string;
  hasPlayableSource: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  musicLabel?: string;
}

export const ImageMusicPlayer: React.FC<ImageMusicPlayerProps> = ({
  audioUrl,
  hasPlayableSource,
  isPlaying,
  onTogglePlay,
  musicLabel,
}) => {
  if (!hasPlayableSource) return null;

  return (
    <div className="absolute top-4 left-4 z-40">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 p-2 pr-4 rounded-full text-white shadow-lg"
      >
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Music size={12} className={isPlaying ? 'animate-pulse' : ''} />
            <span className="text-xs font-medium uppercase tracking-wider opacity-70">Atmosphere</span>
          </div>
          <span className="text-sm font-bold truncate max-w-[140px]">
            {musicLabel || (audioUrl ? 'Lo-Fi Chill' : 'Ambient Mix')}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
