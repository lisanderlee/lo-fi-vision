import React from 'react';
import { motion } from 'motion/react';

export function Waveform({ isPlaying }: { isPlaying: boolean }) {
  const bars = [1, 2, 3, 4, 5];
  
  return (
    <div className="flex items-center gap-[2px] h-4">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            scaleY: isPlaying ? [0.2, 1, 0.4, 1, 0.2] : 0.2
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
          className="w-0.5 h-full bg-current rounded-full origin-bottom"
        />
      ))}
    </div>
  );
}
