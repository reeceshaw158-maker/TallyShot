import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Loader2 } from 'lucide-react'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'

export default function FloatingPlayButton() {
  const { isPlaying, isLoading, togglePlay } = useAudioPlayer()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={togglePlay}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
          className={`fixed right-5 bottom-24 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-300 disabled:opacity-60
            ${isPlaying
              ? 'bg-glr-purple shadow-[0_0_30px_rgba(147,51,234,0.6)] hover:bg-glr-purple-light'
              : 'bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20'
            }`}
          style={{ bottom: '88px' }}
        >
          {/* Pulse ring when playing */}
          {isPlaying && (
            <motion.span
              className="absolute inset-0 rounded-full bg-glr-purple"
              animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {isLoading
            ? <Loader2 size={22} className="animate-spin text-white relative z-10" />
            : isPlaying
              ? <Pause size={22} className="text-white relative z-10" />
              : <Play size={22} className="text-white relative z-10 ml-0.5" />
          }
        </motion.button>
      )}
    </AnimatePresence>
  )
}
