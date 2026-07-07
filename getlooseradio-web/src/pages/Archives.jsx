import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, ExternalLink, Filter, Music, Calendar } from 'lucide-react'
import { archives } from '../data/index.js'
import PageTransition from '../components/PageTransition.jsx'

const genreColorMap = {
  Reggae: 'bg-green-900/50 text-green-300 border-green-700/30',
  Soul: 'bg-amber-900/50 text-amber-300 border-amber-700/30',
  House: 'bg-purple-900/50 text-purple-300 border-purple-700/30',
  'Old School': 'bg-orange-900/50 text-orange-300 border-orange-700/30',
  default: 'bg-white/5 text-glr-muted border-white/10',
}

function getGenreColor(genre) {
  const key = Object.keys(genreColorMap).find((k) => genre.includes(k))
  return genreColorMap[key] || genreColorMap.default
}

export default function Archives() {
  const allDJs = ['All', ...new Set(archives.map((a) => a.dj))]
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? archives : archives.filter((a) => a.dj === filter)

  return (
    <PageTransition>
      <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-purple/30 mb-6">
              <Archive size={14} className="text-glr-purple" />
              <span className="text-xs font-semibold uppercase tracking-widest text-glr-purple">Past Shows</span>
            </div>
            <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl text-white tracking-wider mb-4">ARCHIVES</h1>
            <p className="text-glr-muted max-w-lg mx-auto">
              Relive the best shows from Get Loose Radio. Filter by DJ and listen on Mixcloud.
            </p>
          </motion.div>

          {/* Filter bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-2 mb-8 flex-wrap"
          >
            <div className="flex items-center gap-1.5 text-glr-muted text-xs uppercase tracking-widest mr-2">
              <Filter size={13} />
              Filter
            </div>
            {allDJs.map((dj) => (
              <button
                key={dj}
                onClick={() => setFilter(dj)}
                className={`px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wider transition-all duration-200
                  ${filter === dj
                    ? 'bg-glr-purple text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                    : 'glass text-glr-muted hover:text-white border border-glr-border'
                  }`}
              >
                {dj}
              </button>
            ))}
          </motion.div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="glass rounded-2xl overflow-hidden border border-glr-border hover:border-glr-purple/50 hover:shadow-[0_8px_30px_rgba(147,51,234,0.2)] transition-all duration-300 group"
                >
                  {/* Thumbnail placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-[#1a0030] to-[#0a0a0a] relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(147,51,234,0.12)_0%,transparent_70%)]" />
                    <img
                      src={`https://ui-avatars.com/api/?name=${item.avatar}&background=7e22ce&color=fff&size=96&bold=true`}
                      alt={item.dj}
                      className="w-14 h-14 rounded-full ring-2 ring-glr-purple/40 relative z-10"
                      loading="lazy"
                    />
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-12 h-12 rounded-full bg-glr-purple flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.6)]">
                        <Music size={20} className="text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold leading-tight truncate">{item.title}</p>
                        <p className="text-glr-purple text-sm font-medium mt-0.5">{item.dj}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getGenreColor(item.genre)}`}>
                        {item.genre}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-glr-muted text-xs mb-4">
                      <Calendar size={12} />
                      <span>{item.date}</span>
                    </div>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                        bg-glr-purple/15 text-glr-purple border border-glr-purple/30 text-sm font-bold uppercase tracking-widest
                        hover:bg-glr-purple hover:text-white hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]
                        transition-all duration-200"
                    >
                      Listen on Mixcloud
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-glr-muted">
              <Archive size={40} className="mx-auto mb-4 opacity-30" />
              <p>No archives found for this DJ.</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
