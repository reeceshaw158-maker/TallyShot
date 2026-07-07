import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Tv, Send, Clock, Radio } from 'lucide-react'
import { schedule } from '../data/index.js'
import PageTransition from '../components/PageTransition.jsx'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getUpcomingShows() {
  const all = DAYS.flatMap((day) => schedule[day].map((s) => ({ ...s, day })))
  return all.slice(0, 5)
}

export default function StudioLive() {
  const [messages, setMessages] = useState([
    { id: 1, user: 'GLR Fan', text: 'Loving this set! 🔥', time: '2:34 PM' },
    { id: 2, user: 'SoulGroove', text: 'Best station online!', time: '2:35 PM' },
    { id: 3, user: 'ReggaeVibes', text: 'That tune! 🎵', time: '2:37 PM' },
  ])
  const [input, setInput] = useState('')
  const { isPlaying, isLoading, togglePlay } = useAudioPlayer()

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: Date.now(), user: 'You', text: input.trim(), time: now }])
    setInput('')
  }

  const upcoming = getUpcomingShows()

  return (
    <PageTransition>
      <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="w-3 h-3 rounded-full bg-glr-red live-dot" />
              <span className="text-glr-red text-sm font-bold uppercase tracking-widest">Now On Air</span>
            </div>
            <h1 className="font-heading text-6xl sm:text-7xl text-white tracking-wider">STUDIO LIVE</h1>
            <p className="text-glr-muted mt-2">Watch & listen to Get Loose Radio live from the studio.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main stream area */}
            <div className="lg:col-span-2 space-y-4">
              {/* Video/Stream placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative aspect-video rounded-2xl overflow-hidden glass border border-glr-border"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#0d001a] to-[#0a0a0a] flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(147,51,234,0.12)_0%,transparent_70%)]" />

                  {/* Animated rings */}
                  {isPlaying && (
                    <>
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute rounded-full border border-glr-purple/20"
                          animate={{ scale: [1, 1.5 + i * 0.3], opacity: [0.6, 0] }}
                          transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
                          style={{ width: 80, height: 80 }}
                        />
                      ))}
                    </>
                  )}

                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-glr-purple to-glr-gold flex items-center justify-center shadow-[0_0_40px_rgba(147,51,234,0.5)]">
                      <Radio size={32} className="text-white" />
                    </div>
                    <div className="text-center">
                      <p className="font-heading text-3xl text-white tracking-widest">GET LOOSE RADIO</p>
                      <p className="text-glr-gold text-sm tracking-[0.3em] uppercase mt-1">Live Studio Feed</p>
                    </div>
                    <button
                      onClick={togglePlay}
                      className={`mt-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2 transition-all
                        ${isPlaying
                          ? 'bg-glr-red/80 hover:bg-glr-red text-white'
                          : 'bg-glr-purple hover:bg-glr-purple-light text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]'
                        }`}
                    >
                      {isLoading ? 'Loading...' : isPlaying ? 'Pause Stream' : 'Play Live Stream'}
                    </button>
                  </div>
                </div>

                {/* Live badge overlay */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-glr-red/40">
                  <span className="w-2 h-2 rounded-full bg-glr-red live-dot" />
                  <span className="text-glr-red text-xs font-bold uppercase tracking-widest">Live</span>
                </div>
              </motion.div>

              {/* Now on air info */}
              <div className="glass rounded-2xl p-5 border border-glr-border">
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={16} className="text-glr-purple" />
                  <span className="text-glr-purple text-xs font-bold uppercase tracking-widest">Currently On Air</span>
                </div>
                <p className="font-heading text-2xl text-white tracking-wider">Get Loose Radio</p>
                <p className="text-glr-muted text-sm mt-1">Broadcasting 24/7 — Music For Life</p>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Chat */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="glass rounded-2xl border border-glr-border flex flex-col h-80"
              >
                <div className="px-4 py-3 border-b border-glr-border flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-semibold text-white">Live Chat</span>
                  <span className="ml-auto text-xs text-glr-muted">{messages.length} messages</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-glr-purple to-glr-gold flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
                        {msg.user[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-glr-gold">{msg.user}</span>
                          <span className="text-[10px] text-glr-muted">{msg.time}</span>
                        </div>
                        <p className="text-xs text-white mt-0.5 leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={sendMessage} className="p-3 border-t border-glr-border flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Say something..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-glr-border text-xs text-white placeholder:text-glr-muted focus:outline-none focus:border-glr-purple transition-colors"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-lg bg-glr-purple hover:bg-glr-purple-light text-white transition-colors"
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </motion.div>

              {/* Upcoming shows */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="glass rounded-2xl border border-glr-border p-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={15} className="text-glr-purple" />
                  <span className="text-sm font-semibold text-white">Upcoming Shows</span>
                </div>
                <div className="space-y-3">
                  {upcoming.map((show, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-glr-purple/20 flex-shrink-0 flex items-center justify-center">
                        <Radio size={13} className="text-glr-purple" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold leading-tight truncate">{show.show}</p>
                        <p className="text-glr-muted text-[11px] mt-0.5">{show.dj} — {show.day}</p>
                        <p className="text-glr-gold text-[11px]">{show.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
