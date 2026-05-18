import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play, Pause, Calendar, ChevronRight, ShoppingBag, Radio, Loader2, Volume2 } from 'lucide-react'
import { schedule, djs, merchandise, MERCH_URL, STREAM_URL } from '../data/index.js'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const genreColors = {
  Reggae: 'bg-green-900/60 text-green-300 border-green-700/40',
  Soul: 'bg-amber-900/60 text-amber-300 border-amber-700/40',
  'Hip Hop': 'bg-blue-900/60 text-blue-300 border-blue-700/40',
  House: 'bg-purple-900/60 text-purple-300 border-purple-700/40',
  default: 'bg-white/5 text-glr-muted border-white/10',
}

function GenreTag({ genre }) {
  const cls = Object.entries(genreColors).find(([k]) => genre.includes(k))?.[1] || genreColors.default
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${cls}`}>
      {genre}
    </span>
  )
}

function HeroAudioPlayer() {
  const { isPlaying, isLoading, togglePlay } = useAudioPlayer()

  return (
    <div className="flex items-center gap-4 glass rounded-2xl px-6 py-4 w-full max-w-lg border border-glr-purple/30">
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0
          ${isPlaying
            ? 'bg-glr-purple shadow-[0_0_20px_rgba(147,51,234,0.6)] hover:bg-glr-purple-light'
            : 'bg-white/10 hover:bg-white/20'
          } disabled:opacity-60`}
        aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
      >
        {isLoading ? <Loader2 size={20} className="animate-spin text-white" /> : isPlaying ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
      </button>
      <div className="min-w-0">
        <p className="text-xs text-glr-muted uppercase tracking-widest">Live Stream</p>
        <p className="text-sm font-semibold text-white truncate">
          {isPlaying ? 'Get Loose Radio — On Air' : 'Click to tune in'}
        </p>
      </div>
      {isPlaying && (
        <div className="flex items-end gap-0.5 h-5 ml-auto flex-shrink-0">
          {[1, 2, 3, 4, 3].map((h, i) => (
            <div
              key={i}
              className="equalizer-bar w-1 bg-glr-purple rounded-full"
              style={{ height: `${h * 20}%`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleGrid() {
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  const [activeDay, setActiveDay] = useState(today)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Calendar size={20} className="text-glr-purple" />
          <span className="text-glr-purple text-sm font-semibold uppercase tracking-widest">Weekly Schedule</span>
        </div>
        <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">ON AIR THIS WEEK</h2>
      </motion.div>

      {/* Day tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-8 scrollbar-hide justify-start md:justify-center">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wider transition-all duration-200
              ${activeDay === day
                ? 'bg-glr-purple text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'glass text-glr-muted hover:text-white border border-glr-border'
              }`}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Schedule rows */}
      <motion.div
        key={activeDay}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        {schedule[activeDay].map((show, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-glr-purple/50 hover:bg-white/[0.06] transition-all duration-200 group cursor-default"
          >
            <div className="flex-shrink-0 w-32">
              <span className="text-glr-gold text-sm font-semibold">{show.time}</span>
            </div>
            <div className="h-8 w-px bg-glr-border hidden sm:block flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold group-hover:text-glr-gold transition-colors">{show.show}</p>
              <p className="text-glr-muted text-sm">{show.dj}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-glr-purple opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

function FeaturedDJs() {
  return (
    <section className="py-20 bg-gradient-to-b from-transparent via-glr-purple/5 to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <p className="text-glr-purple text-sm font-semibold uppercase tracking-widest mb-2">Our Residents</p>
            <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">FEATURED DJS</h2>
          </div>
          <Link
            to="/dj-profiles"
            className="hidden sm:flex items-center gap-1 text-sm text-glr-muted hover:text-glr-gold transition-colors"
          >
            View All <ChevronRight size={16} />
          </Link>
        </motion.div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:-mx-0 sm:px-0">
          {djs.map((dj, i) => (
            <motion.div
              key={dj.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="flex-shrink-0 w-48 glass rounded-2xl p-4 border border-glr-border hover:border-glr-purple/50 hover:shadow-[0_8px_30px_rgba(147,51,234,0.25)] transition-all duration-300 cursor-pointer"
            >
              <img
                src={`https://ui-avatars.com/api/?name=${dj.avatar}&background=9333ea&color=fff&size=128&bold=true`}
                alt={dj.name}
                className="w-16 h-16 rounded-full mx-auto mb-3 ring-2 ring-glr-purple/40"
                loading="lazy"
              />
              <p className="font-heading text-lg text-white text-center tracking-wide leading-tight">{dj.name}</p>
              <p className="text-glr-muted text-[11px] text-center mt-1 leading-snug">{dj.show}</p>
              <div className="flex flex-wrap gap-1 mt-3 justify-center">
                {dj.genres.slice(0, 2).map((g) => (
                  <GenreTag key={g} genre={g} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Link to="/dj-profiles" className="text-sm text-glr-muted hover:text-glr-gold transition-colors flex items-center gap-1">
            View All DJs <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function MerchandisePreview() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between mb-10"
      >
        <div>
          <p className="text-glr-gold text-sm font-semibold uppercase tracking-widest mb-2">Official Merch</p>
          <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">WEAR THE VIBE</h2>
        </div>
        <a
          href={MERCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-sm text-glr-muted hover:text-glr-gold transition-colors"
        >
          Shop All <ChevronRight size={16} />
        </a>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {merchandise.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="glass rounded-2xl overflow-hidden border border-glr-border hover:border-glr-gold/40 transition-all duration-300 group"
          >
            {/* Product image placeholder */}
            <div className="aspect-square bg-gradient-to-br from-[#1a0030] to-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-glr-purple/10 to-glr-gold/5" />
              <ShoppingBag size={32} className="text-glr-purple/60 mb-2" />
              <p className="text-xs font-bold tracking-[0.2em] text-glr-muted uppercase text-center px-2">{item.tag}</p>
            </div>
            <div className="p-4">
              <p className="text-white text-sm font-semibold leading-tight">{item.name}</p>
              <p className="text-glr-gold font-bold mt-1">{item.price}</p>
              <a
                href={MERCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full block text-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest
                  bg-glr-purple/20 text-glr-purple border border-glr-purple/30
                  group-hover:bg-glr-purple group-hover:text-white group-hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]
                  transition-all duration-200"
              >
                Shop
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-purple/30 mb-6">
          <Radio size={14} className="text-glr-purple" />
          <span className="text-xs font-semibold uppercase tracking-widest text-glr-purple">Newsletter</span>
        </div>
        <h2 className="font-heading text-5xl text-white tracking-wider mb-4">STAY IN THE LOOP</h2>
        <p className="text-glr-muted mb-8 leading-relaxed">
          Get the latest show schedules, new DJ announcements, and exclusive mixes delivered straight to your inbox.
        </p>
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 border border-green-500/30"
          >
            <p className="text-green-400 font-semibold text-lg">You're in! Welcome to the Get Loose family.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-glr-border text-white placeholder:text-glr-muted focus:outline-none focus:border-glr-purple transition-colors text-sm"
            />
            <button
              type="submit"
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-glr-purple to-glr-purple-dark text-white font-bold uppercase tracking-widest text-sm
                hover:from-glr-purple-light hover:to-glr-purple
                shadow-[0_0_20px_rgba(147,51,234,0.35)] hover:shadow-[0_0_30px_rgba(147,51,234,0.55)]
                transition-all duration-200 flex-shrink-0"
            >
              Subscribe
            </button>
          </form>
        )}
      </motion.div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="hero-bg min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-32 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-glr-purple/10 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-glr-gold/8 blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-red/30 bg-glr-red/10"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-glr-red live-dot" />
            <span className="text-glr-red text-xs font-bold uppercase tracking-[0.3em]">Live Now</span>
          </motion.div>

          {/* Main title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="font-heading text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-none tracking-widest"
          >
            <span className="block text-white">GET LOOSE</span>
            <span className="block text-gradient-purple">RADIO</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-glr-gold font-body text-lg sm:text-xl tracking-[0.5em] uppercase font-medium"
          >
            music for life
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 mt-2"
          >
            <Link
              to="/studio-live"
              className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                bg-gradient-to-r from-glr-purple to-glr-purple-dark text-white font-bold uppercase tracking-widest text-sm
                shadow-[0_0_25px_rgba(147,51,234,0.45)] hover:shadow-[0_0_40px_rgba(147,51,234,0.65)]
                hover:from-glr-purple-light hover:to-glr-purple transition-all duration-200"
            >
              <Volume2 size={16} />
              Listen Live
            </Link>
            <Link
              to="/#schedule"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                glass border border-glr-border text-white font-bold uppercase tracking-widest text-sm
                hover:border-glr-gold/50 hover:text-glr-gold transition-all duration-200"
            >
              <Calendar size={16} />
              View Schedule
            </Link>
          </motion.div>

          {/* Hero embedded player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-4 w-full flex justify-center"
          >
            <HeroAudioPlayer />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-glr-muted text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-glr-purple to-transparent" />
        </motion.div>
      </section>

      {/* Schedule */}
      <div id="schedule-section">
        <ScheduleGrid />
      </div>

      {/* Featured DJs */}
      <FeaturedDJs />

      {/* Merchandise Preview */}
      <MerchandisePreview />

      {/* Newsletter */}
      <NewsletterSection />
    </div>
  )
}
