'use client';

import { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AudioPlayerProps {
  audioUrl: string | null;
  className?: string;
}

export function AudioPlayer({ audioUrl, className }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!audioUrl) return null;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 border-border text-text-2 hover:text-amber"
        onClick={toggle}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 h-2 rounded bg-surface-2 overflow-hidden">
        <div className="h-full w-1/3 rounded bg-surface-3" />
      </div>
    </div>
  );
}
