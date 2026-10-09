"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  fromMe?: boolean;
  fileName?: string;
  onDownload?: () => void;
}

// Pseudo waveform bar heights to simulate realistic voice note amplitudes
const WAVE_BARS = [
  30, 60, 45, 80, 100, 75, 40, 65, 85, 95, 55, 35, 70, 90, 100, 60, 40, 75,
  85, 95, 50, 65, 80, 45, 70, 90, 55, 30
];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function WhatsAppAudioPlayer({ src, fromMe = false, fileName, onDownload }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const toggleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const seekFraction = index / (WAVE_BARS.length - 1);
    audio.currentTime = seekFraction * duration;
    setCurrentTime(audio.currentTime);
  };

  const progressFraction = duration > 0 ? currentTime / duration : 0;
  const currentBarIndex = Math.floor(progressFraction * WAVE_BARS.length);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-2 rounded-xl transition-all select-none w-full max-w-[280px] sm:max-w-[320px]",
        fromMe ? "text-primary-foreground" : "text-foreground"
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Main player controls row */}
      <div className="flex items-center gap-2.5">
        {/* Play / Pause button */}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs cursor-pointer",
            fromMe
              ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
              : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500"
          )}
          title={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform visualizer */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
          <div
            className="flex items-center gap-0.5 sm:gap-[3px] h-7 cursor-pointer py-1"
            title="Clique para avançar"
          >
            {WAVE_BARS.map((height, i) => {
              const isPast = i <= currentBarIndex;
              return (
                <div
                  key={i}
                  onClick={() => handleSeek(i)}
                  className="flex-1 flex items-center h-full justify-center group/bar"
                >
                  <div
                    style={{ height: `${height}%` }}
                    className={cn(
                      "w-full max-w-[3.5px] rounded-full transition-colors duration-150",
                      fromMe
                        ? isPast
                          ? "bg-primary-foreground font-bold shadow-xs"
                          : "bg-primary-foreground/35 group-hover/bar:bg-primary-foreground/60"
                        : isPast
                        ? "bg-emerald-600 dark:bg-emerald-400 font-bold"
                        : "bg-muted-foreground/30 dark:bg-muted-foreground/40 group-hover/bar:bg-emerald-500/50"
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Time & speed controls */}
          <div className="flex items-center justify-between text-[11px] font-mono leading-none">
            <span
              className={cn(
                "tabular-nums",
                fromMe ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
            </span>

            <div className="flex items-center gap-2">
              {/* Playback speed toggle */}
              <button
                type="button"
                onClick={toggleSpeed}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer",
                  fromMe
                    ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
                title="Velocidade de reprodução"
              >
                {speed}x
              </button>

              {/* Mic Icon indicator */}
              <Mic
                className={cn(
                  "h-3 w-3",
                  fromMe
                    ? "text-primary-foreground/60"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              />

              {/* Download option */}
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className={cn(
                    "p-0.5 rounded hover:opacity-80 transition-opacity",
                    fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}
                  title="Baixar áudio"
                >
                  <Download className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
