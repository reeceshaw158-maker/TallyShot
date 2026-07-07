import { useState, useRef, useEffect, useCallback } from 'react'
import { STREAM_URL } from '../data/index.js'

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audioRef.current = audio

    audio.addEventListener('waiting', () => setIsLoading(true))
    audio.addEventListener('playing', () => { setIsLoading(false); setIsPlaying(true) })
    audio.addEventListener('pause', () => setIsPlaying(false))
    audio.addEventListener('error', () => { setIsLoading(false); setIsPlaying(false) })

    audio.volume = 0.7

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      audio.src = ''
    } else {
      setIsLoading(true)
      audio.src = STREAM_URL
      audio.load()
      audio.play().catch(() => {
        setIsLoading(false)
        setIsPlaying(false)
      })
    }
  }, [isPlaying])

  const handleVolumeChange = useCallback((val) => {
    const audio = audioRef.current
    const v = parseFloat(val)
    setVolume(v)
    if (audio) audio.volume = v
    if (v > 0) setIsMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const next = !isMuted
    setIsMuted(next)
    audio.muted = next
  }, [isMuted])

  return { isPlaying, volume, isMuted, isLoading, togglePlay, handleVolumeChange, toggleMute }
}
