import React from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX, Radio, Loader2 } from 'lucide-react'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'

export default function NowPlayingBar() {
  const { isPlaying, volume, isMuted, isLoading, togglePlay, handleVolumeChange, toggleMute } = useAudioPlayer()

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.6, ease: 'easeOut' }}
      className="fixed bottom-0 left-0 right-0 z-50 glass-dark border-t border-glr-border shadow-[0_-4px_30px_rgba(147,51,234,0.2)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Station info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-glr-purple to-glr-gold flex-shrink-0 flex items-center justify-center">
            <Radio size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-glr-muted uppercase tracking-widest font-medium">Now Playing</p>
            <p className="text-sm font-semibold text-white truncate">Get Loose Radio — Live Stream</p>
          </div>
          {isPlaying && (
            <div className="hidden sm:flex items-end gap-0.5 h-5 flex-shrink-0 ml-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="equalizer-bar w-1 bg-glr-purple rounded-full"
                  style={{
                    height: '60%',
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: `${0.6 + i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
              ${isPlaying
                ? 'bg-glr-purple text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:bg-glr-purple-light'
                : 'bg-white/10 text-white hover:bg-white/20'
              } disabled:opacity-60`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading
              ? <Loader2 size={18} className="animate-spin" />
              : isPlaying
                ? <Pause size={18} />
                : <Play size={18} className="ml-0.5" />
            }
          </button>

          {/* Volume controls */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-glr-muted hover:text-white transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(e.target.value)}
              className="w-24"
              aria-label="Volume"
            />
          </div>
        </div>

        {/* Live badge */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-glr-red live-dot flex-shrink-0" />
          <span className="text-xs font-bold tracking-widest text-glr-red uppercase">Live</span>
        </div>
      </div>
    </motion.div>
  )
}
