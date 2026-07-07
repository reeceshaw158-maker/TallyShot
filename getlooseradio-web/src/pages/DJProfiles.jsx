import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ExternalLink, Music, ChevronDown } from 'lucide-react'
import { djs } from '../data/index.js'
import PageTransition from '../components/PageTransition.jsx'

const genreColorMap = {
  Reggae: 'bg-green-900/50 text-green-300 border-green-700/30',
  Soul: 'bg-amber-900/50 text-amber-300 border-amber-700/30',
  'Hip Hop': 'bg-blue-900/50 text-blue-300 border-blue-700/30',
  House: 'bg-purple-900/50 text-purple-300 border-purple-700/30',
  Jazz: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/30',
  Funk: 'bg-orange-900/50 text-orange-300 border-orange-700/30',
  Afrobeat: 'bg-red-900/50 text-red-300 border-red-700/30',
  Electronic: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/30',
  Dancehall: 'bg-lime-900/50 text-lime-300 border-lime-700/30',
  RnB: 'bg-pink-900/50 text-pink-300 border-pink-700/30',
  Soca: 'bg-teal-900/50 text-teal-300 border-teal-700/30',
  default: 'bg-white/5 text-glr-muted border-white/10',
}

function getGenreColor(genre) {
  const key = Object.keys(genreColorMap).find((k) => genre.includes(k))
  return genreColorMap[key] || genreColorMap.default
}

function DJCard({ dj }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="relative h-80 perspective-1000 cursor-pointer group"
      onClick={() => setFlipped(!flipped)}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 glass rounded-2xl p-6 flex flex-col items-center text-center border border-glr-border hover:border-glr-purple/50 hover:shadow-[0_8px_40px_rgba(147,51,234,0.3)] transition-all duration-300 overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Glow blob */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-glr-purple/15 blur-2xl rounded-full" />

          <img
            src={`https://ui-avatars.com/api/?name=${dj.avatar}&background=7e22ce&color=fff&size=128&bold=true`}
            alt={dj.name}
            className="w-20 h-20 rounded-full ring-2 ring-glr-purple/60 ring-offset-2 ring-offset-[#0a0a0a] mb-4 relative z-10"
            loading="lazy"
          />
          <h3 className="font-heading text-xl text-white tracking-wider leading-tight relative z-10">{dj.name}</h3>
          <p className="text-glr-muted text-xs mt-1 relative z-10">{dj.show}</p>

          <div className="flex flex-wrap gap-1.5 mt-3 justify-center relative z-10">
            {dj.genres?.map((g) => (
              <span
                key={g}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getGenreColor(g)}`}
              >
                {g}
              </span>
            ))}
          </div>

          <div className="mt-auto pt-4 flex items-center gap-1.5 text-glr-muted text-xs relative z-10">
            <Clock size={12} />
            <span className="truncate leading-snug text-center">{dj.schedule.split('|')[0]}</span>
          </div>

          <div className="absolute bottom-3 right-3 text-glr-purple/40 text-xs flex items-center gap-1">
            <ChevronDown size={12} className="rotate-[-90deg]" />
            <span className="text-[10px]">flip</span>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 glass rounded-2xl p-6 flex flex-col border border-glr-purple/40 overflow-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-glr-purple/10 to-transparent pointer-events-none" />

          <h3 className="font-heading text-lg text-glr-gold tracking-wider mb-3">{dj.name}</h3>

          {dj.bio && (
            <p className="text-glr-muted text-xs leading-relaxed mb-4 flex-1">"{dj.bio}"</p>
          )}

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Clock size={13} className="text-glr-purple mt-0.5 flex-shrink-0" />
              <p className="text-white text-xs leading-relaxed">{dj.schedule}</p>
            </div>

            {dj.mixcloud && (
              <a
                href={dj.mixcloud}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg glass border border-glr-purple/30 text-glr-purple hover:text-white hover:bg-glr-purple/20 transition-all text-xs font-semibold uppercase tracking-wider"
              >
                <Music size={13} />
                Mixcloud
                <ExternalLink size={11} className="ml-auto" />
              </a>
            )}
          </div>

          <div className="absolute bottom-3 right-3 text-glr-purple/40 text-xs flex items-center gap-1">
            <ChevronDown size={12} className="rotate-[-90deg]" />
            <span className="text-[10px]">flip</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function DJProfiles() {
  return (
    <PageTransition>
      <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-purple/30 mb-6">
              <Music size={14} className="text-glr-purple" />
              <span className="text-xs font-semibold uppercase tracking-widest text-glr-purple">The Residents</span>
            </div>
            <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl text-white tracking-wider mb-4">
              DJ PROFILES
            </h1>
            <p className="text-glr-muted max-w-xl mx-auto leading-relaxed">
              Meet the talented DJs who bring Get Loose Radio to life. Click any card to learn more.
            </p>
          </motion.div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {djs.map((dj, i) => (
              <motion.div
                key={dj.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
              >
                <DJCard dj={dj} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
