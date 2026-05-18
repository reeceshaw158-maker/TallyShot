import React from 'react'
import { motion } from 'framer-motion'
import { Music as MusicIcon, ExternalLink, Play, ShoppingCart } from 'lucide-react'
import PageTransition from '../components/PageTransition.jsx'

const artists = [
  {
    id: 1,
    name: 'Lil Jeff',
    track: 'Groove Session Vol. 1',
    genre: 'Nu Disco / Soul',
    description: 'A deep journey through disco boogie, jazzy house, and soulful club funk.',
    avatar: 'Lil+Jeff',
  },
  {
    id: 2,
    name: 'Culture Mark',
    track: 'Deep Frequencies',
    genre: 'Deep House',
    description: 'Electronic and acoustic textures designed to uplift and inspire.',
    avatar: 'Culture+Mark',
  },
  {
    id: 3,
    name: 'Devon Live',
    track: 'Eclectic Voyage',
    genre: 'Soul / Funk / Jazz',
    description: 'Effortless eclectic sounds that cruise through genres with unforgettable ease.',
    avatar: 'Devon+Live',
  },
  {
    id: 4,
    name: 'E-MIX',
    track: 'Rare Roots Selection',
    genre: 'Reggae / Soca',
    description: 'The finest roots reggae and soca rhythms from the underground.',
    avatar: 'E-MIX',
  },
  {
    id: 5,
    name: 'Dean Masters',
    track: 'Soul Infinity EP',
    genre: 'Neo Soul',
    description: 'From classic cuts to contemporary gems — a thread of pure soulful excellence.',
    avatar: 'Dean+Masters',
  },
  {
    id: 6,
    name: 'Fonz',
    track: 'Raw Groove Sessions',
    genre: 'Reggae / House',
    description: 'Raw groove, reggae vibes, and soulful house from one of GLR\'s most prolific residents.',
    avatar: 'Fonz',
  },
  {
    id: 7,
    name: 'Floyd W',
    track: 'Rare Groove & More',
    genre: 'Soul / RnB',
    description: 'Deep crate digging through reggae, soul, and R&B — rare groove defined.',
    avatar: 'Floyd+W',
  },
  {
    id: 8,
    name: 'Miss Honey',
    track: 'Morning Blend',
    genre: 'House / Soul',
    description: 'The smoothest way to start your morning — house and soul perfection.',
    avatar: 'Miss+Honey',
  },
]

function MusicCard({ artist, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="glass rounded-2xl overflow-hidden border border-glr-border hover:border-glr-purple/50 hover:shadow-[0_10px_40px_rgba(147,51,234,0.2)] transition-all duration-300 group"
    >
      {/* Album art placeholder */}
      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-[#1a0030] to-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_30%,rgba(147,51,234,0.15)_0%,transparent_70%)]" />
        <img
          src={`https://ui-avatars.com/api/?name=${artist.avatar}&background=4a1d96&color=fff&size=256&bold=true`}
          alt={artist.name}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
          loading="lazy"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
          <div className="w-14 h-14 rounded-full bg-glr-purple shadow-[0_0_25px_rgba(147,51,234,0.7)] flex items-center justify-center">
            <Play size={22} className="text-white ml-1" />
          </div>
        </div>
        {/* Genre badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full bg-black/60 border border-glr-purple/30 text-glr-purple text-[10px] font-bold uppercase tracking-wider">
            {artist.genre}
          </span>
        </div>
      </div>

      <div className="p-5">
        <p className="text-glr-muted text-xs uppercase tracking-wider mb-1">{artist.name}</p>
        <h3 className="font-heading text-lg text-white tracking-wider leading-tight">{artist.track}</h3>
        <p className="text-glr-muted text-xs mt-2 leading-relaxed">{artist.description}</p>

        <div className="flex gap-2 mt-4">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-glr-purple/15 text-glr-purple border border-glr-purple/30 text-xs font-bold uppercase tracking-wider hover:bg-glr-purple hover:text-white transition-all duration-200">
            <Play size={13} />
            Preview
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg glass text-glr-gold border border-glr-gold/30 text-xs font-bold uppercase tracking-wider hover:bg-glr-gold hover:text-black transition-all duration-200">
            <ShoppingCart size={13} />
            Buy
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function Music() {
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-gold/30 mb-6">
              <MusicIcon size={14} className="text-glr-gold" />
              <span className="text-xs font-semibold uppercase tracking-widest text-glr-gold">The Tunes</span>
            </div>
            <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl text-white tracking-wider mb-4">MUSIC</h1>
            <p className="text-glr-muted max-w-xl mx-auto leading-relaxed">
              Get The Tunes — Listen and purchase music from Get Loose Radio artists.
            </p>
          </motion.div>

          {/* Artist grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {artists.map((artist, i) => (
              <MusicCard key={artist.id} artist={artist} index={i} />
            ))}
          </div>

          {/* Streaming links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 glass rounded-2xl p-8 border border-glr-border text-center"
          >
            <h2 className="font-heading text-3xl text-white tracking-wider mb-2">FIND US ON STREAMING</h2>
            <p className="text-glr-muted text-sm mb-6">Listen to Get Loose Radio shows and mixes on your favourite platform.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {['Mixcloud', 'SoundCloud', 'Spotify', 'Apple Music'].map((platform) => (
                <a
                  key={platform}
                  href="#"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl glass border border-glr-border text-glr-muted hover:text-white hover:border-glr-purple/50 transition-all duration-200 text-sm font-medium"
                >
                  {platform}
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}
