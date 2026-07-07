import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play, Pause, Calendar, ChevronRight, ShoppingBag, Radio, Loader2, Volume2, Zap, Send, Music } from 'lucide-react'
import { schedule, djs, merchandise, MERCH_URL, GLR_LOGO, getDJPhoto } from '../data/index.js'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'
import StatsBar from '../components/StatsBar.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const genreColors = {
  Reggae: 'bg-green-900/60 text-green-300 border-green-700/40',
  Soul: 'bg-amber-900/60 text-amber-300 border-amber-700/40',
  'Hip Hop': 'bg-blue-900/60 text-blue-300 border-blue-700/40',
  House: 'bg-purple-900/60 text-purple-300 border-purple-700/40',
  Afrobeat: 'bg-red-900/60 text-red-300 border-red-700/40',
  Soca: 'bg-teal-900/60 text-teal-300 border-teal-700/40',
  default: 'bg-white/5 text-glr-muted border-white/10',
}

const merchGradients = [
  { from: 'from-purple-900/80 to-purple-950/80', accent: '#9333ea' },
  { from: 'from-amber-900/60 to-stone-950/80',   accent: '#f59e0b' },
  { from: 'from-slate-800/80 to-black/80',        accent: '#94a3b8' },
  { from: 'from-emerald-900/60 to-black/80',      accent: '#10b981' },
]

const MerchIcon = ({ tag }) => {
  if (tag === 'TEE') return (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 opacity-40 group-hover:opacity-60 transition-opacity" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 16 L8 28 L20 34 L20 64 L60 64 L60 34 L72 28 L60 16 L52 24 C52 28 48 32 40 32 C32 32 28 28 28 24 Z" />
    </svg>
  )
  if (tag === 'HOODIE') return (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 opacity-40 group-hover:opacity-60 transition-opacity" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16 C22 16 18 16 12 24 L8 30 L20 36 L20 64 L60 64 L60 36 L72 30 L68 24 C62 16 58 16 58 16 C54 22 48 26 40 26 C32 26 26 22 22 16Z" />
      <path d="M32 26 L32 42 L48 42 L48 26" />
    </svg>
  )
  if (tag === 'CAP') return (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 opacity-40 group-hover:opacity-60 transition-opacity" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 46 C18 46 18 30 40 28 C62 30 62 46 62 46 Z" />
      <path d="M18 46 Q12 50 10 54 L70 54 Q68 50 62 46" />
      <line x1="40" y1="28" x2="40" y2="46" />
    </svg>
  )
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 opacity-40 group-hover:opacity-60 transition-opacity" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 20 L20 30 L20 62 L60 62 L60 30 L52 20 Z" />
      <path d="M28 20 Q28 14 40 14 Q52 14 52 20" />
      <line x1="20" y1="30" x2="60" y2="30" />
    </svg>
  )
}

function GenreTag({ genre }) {
  const cls = Object.entries(genreColors).find(([k]) => genre.includes(k))?.[1] || genreColors.default
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${cls}`}>
      {genre}
    </span>
  )
}

function parseShowHour(h, period) {
  let hour = parseInt(h)
  if (period.toLowerCase() === 'pm' && hour !== 12) hour += 12
  if (period.toLowerCase() === 'am' && hour === 12) hour = 0
  return hour
}

function isShowLiveNow(timeStr) {
  const match = timeStr.match(/(\d+)(am|pm)–(\d+)(am|pm)/i)
  if (!match) return false
  const start = parseShowHour(match[1], match[2])
  let end = parseShowHour(match[3], match[4])
  const hour = new Date().getHours()
  if (end <= start) end += 24
  const h = hour < start ? hour + 24 : hour
  return h >= start && h < end
}

function HeroTicker() {
  const seg = '✦ GET LOOSE RADIO — ON AIR NOW  ·  SOUL · REGGAE · HIP HOP · HOUSE · AFROBEATS  ·  BROADCASTING 24/7  ·  MUSIC FOR LIFE  ·  NEW MIXES EVERY WEEK  ·  '
  return (
    <div className="absolute top-12 left-0 right-0 w-full overflow-hidden border-y border-glr-purple/20 bg-glr-purple/5 backdrop-blur-sm z-20 pointer-events-none py-2">
      <div className="animate-ticker">
        <span className="text-[11px] text-glr-purple/75 font-medium tracking-[0.18em] uppercase">{seg}</span>
        <span className="text-[11px] text-glr-purple/75 font-medium tracking-[0.18em] uppercase">{seg}</span>
        <span className="text-[11px] text-glr-purple/75 font-medium tracking-[0.18em] uppercase">{seg}</span>
        <span className="text-[11px] text-glr-purple/75 font-medium tracking-[0.18em] uppercase">{seg}</span>
      </div>
    </div>
  )
}

function HeroWaveform() {
  const heights = [20, 45, 70, 35, 85, 55, 30, 75, 50, 90, 40, 65, 80, 25, 60, 45, 70, 35, 55, 80, 30, 65, 50, 90, 40, 75, 55, 30, 80, 60]
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[3px] overflow-hidden h-52 pointer-events-none opacity-[0.07]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="equalizer-bar flex-shrink-0 bg-glr-purple rounded-t-sm"
          style={{
            width: '3%',
            height: `${h}%`,
            animationDelay: `${i * 0.06}s`,
            animationDuration: `${0.55 + (i % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}

function getCurrentShow() {
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  const todayShows = schedule[today] || []
  return todayShows.find((s) => isShowLiveNow(s.time)) || null
}

function HeroAudioPlayer() {
  const { isPlaying, isLoading, togglePlay } = useAudioPlayer()
  const currentShow = getCurrentShow()

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex items-center gap-4 glass border rounded-2xl px-5 py-4 w-full max-w-md transition-all duration-300"
      style={{
        borderColor: isPlaying ? 'rgba(147,51,234,0.35)' : 'rgba(255,255,255,0.08)',
        boxShadow: isPlaying ? '0 0 40px rgba(147,51,234,0.2), 0 0 0 1px rgba(147,51,234,0.1)' : '0 0 20px rgba(0,0,0,0.3)',
      }}
    >
      <motion.button
        onClick={togglePlay}
        disabled={isLoading}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.95 }}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 disabled:opacity-60
          ${isPlaying
            ? 'bg-glr-purple shadow-[0_0_24px_rgba(147,51,234,0.65)]'
            : 'bg-white/10 hover:bg-white/15'
          }`}
        aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
      >
        {isPlaying && (
          <motion.span
            className="absolute inset-0 rounded-full bg-glr-purple"
            animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative z-10">
          {isLoading
            ? <Loader2 size={20} className="animate-spin text-white" />
            : isPlaying
              ? <Pause size={20} className="text-white" />
              : <Play size={20} className="text-white ml-0.5" />
          }
        </span>
      </motion.button>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-glr-muted uppercase tracking-widest font-medium">
          {isPlaying ? 'Now Streaming' : 'Live Stream'}
        </p>
        <p className="text-sm font-bold text-white truncate mt-0.5">
          {isPlaying && currentShow ? currentShow.show : isPlaying ? 'Get Loose Radio — On Air' : 'Click to tune in'}
        </p>
        {isPlaying && currentShow && (
          <p className="text-[11px] text-glr-gold/80 font-medium mt-0.5 truncate">{currentShow.dj} · {currentShow.time}</p>
        )}
      </div>

      {isPlaying ? (
        <div className="flex items-end gap-[2.5px] h-6 flex-shrink-0">
          {[0.6, 1, 0.7, 1, 0.5, 0.8, 0.65].map((h, i) => (
            <div
              key={i}
              className="equalizer-bar w-[3px] rounded-full"
              style={{
                height: `${h * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${0.5 + i * 0.09}s`,
                background: i < 4 ? '#9333ea' : '#f59e0b',
              }}
            />
          ))}
        </div>
      ) : (
        <Volume2 size={18} className="text-glr-muted flex-shrink-0" />
      )}
    </motion.div>
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
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-5 h-5 rounded-full bg-glr-purple/20 flex items-center justify-center">
                <Calendar size={11} className="text-glr-purple" />
              </div>
              <span className="text-glr-purple text-xs font-semibold uppercase tracking-widest">Weekly Schedule</span>
            </div>
            <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">ON AIR THIS WEEK</h2>
          </div>
          <div className="hidden md:flex items-center gap-2 glass rounded-full px-4 py-2 border border-glr-border">
            <span className="w-1.5 h-1.5 rounded-full bg-glr-red live-dot" />
            <span className="text-[11px] text-glr-muted font-medium uppercase tracking-wider">Live Now</span>
          </div>
        </div>
      </motion.div>

      <div className="flex overflow-x-auto gap-2 pb-2 mb-8 scrollbar-hide justify-start md:justify-start">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5
              ${activeDay === day
                ? 'bg-glr-purple text-white shadow-[0_0_16px_rgba(147,51,234,0.45)]'
                : 'glass text-glr-muted hover:text-white border border-glr-border'
              }`}
          >
            {day === today && (
              <span className="w-1.5 h-1.5 rounded-full bg-glr-red live-dot flex-shrink-0" />
            )}
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      <motion.div
        key={activeDay}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-2"
      >
        {schedule[activeDay].map((show, i) => {
          const live = activeDay === today && isShowLiveNow(show.time)
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`relative rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 cursor-default overflow-hidden
                ${live
                  ? 'bg-glr-purple/10 border border-glr-purple/40 shadow-[0_0_24px_rgba(147,51,234,0.12)]'
                  : 'glass border border-glr-border hover:border-glr-purple/30 hover:bg-white/[0.05]'
                }`}
            >
              {live && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-glr-purple rounded-l-full" />
              )}
              <div className="flex-shrink-0 w-36 flex items-center gap-2">
                {live && <span className="w-1.5 h-1.5 rounded-full bg-glr-red live-dot flex-shrink-0" />}
                <span className={`text-sm font-semibold ${live ? 'text-glr-gold' : 'text-glr-gold/80'}`}>{show.time}</span>
              </div>
              <div className="hidden sm:block w-px h-6 bg-glr-border flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${live ? 'text-white' : 'text-white/90'}`}>{show.show}</p>
                <p className="text-glr-muted text-xs mt-0.5">{show.dj}</p>
              </div>
              {live ? (
                <span className="flex-shrink-0 text-[10px] font-bold text-glr-red uppercase tracking-widest bg-glr-red/10 border border-glr-red/30 px-3 py-1 rounded-full">
                  On Air
                </span>
              ) : (
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-glr-purple/40" />
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}

function FeaturedDJs() {
  return (
    <section className="py-20 bg-gradient-to-b from-transparent via-glr-purple/[0.04] to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <p className="text-glr-purple text-xs font-semibold uppercase tracking-widest mb-2.5">Our Residents</p>
            <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">FEATURED DJS</h2>
          </div>
          <Link
            to="/dj-profiles"
            className="hidden sm:flex items-center gap-1 text-xs text-glr-muted hover:text-glr-gold transition-colors font-medium"
          >
            View All <ChevronRight size={14} />
          </Link>
        </motion.div>

        <div className="relative scroll-fade-x">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:-mx-0 sm:px-0">
            {djs.map((dj, i) => (
              <motion.div
                key={dj.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="flex-shrink-0 w-52 glass rounded-2xl overflow-hidden border border-glr-border hover:border-glr-purple/50 hover:shadow-[0_12px_40px_rgba(147,51,234,0.25)] transition-all duration-300 cursor-pointer"
              >
                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-glr-purple/20 to-black">
                  <img
                    src={getDJPhoto(dj)}
                    alt={dj.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${dj.avatar}&background=9333ea&color=fff&size=208&bold=true` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
                <div className="p-4">
                  <p className="font-heading text-lg text-white tracking-wide leading-tight">{dj.name}</p>
                  <p className="text-glr-muted text-[11px] mt-1 leading-snug line-clamp-1">{dj.show}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {dj.genres.slice(0, 2).map((g) => (
                      <GenreTag key={g} genre={g} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Link to="/dj-profiles" className="text-xs text-glr-muted hover:text-glr-gold transition-colors flex items-center gap-1 font-medium">
            View All DJs <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

const GENRE_ITEMS = [
  '✦ Soul', '· Reggae', '· Hip Hop', '· House', '· Afrobeats',
  '· Nu Disco', '· Soca', '· Funk', '· Deep House', '· Jazz',
  '· Neo Soul', '· Dancehall', '· RnB', '· Rare Groove', '· Electronic',
]

function GenreTicker() {
  const seg = GENRE_ITEMS.join('  ')
  return (
    <div className="relative py-5 overflow-hidden border-y border-white/[0.05]">
      <div className="absolute inset-0 bg-gradient-to-r from-glr-purple/5 via-transparent to-glr-gold/5 pointer-events-none" />
      <div className="animate-ticker whitespace-nowrap select-none">
        {[0, 1, 2, 3].map((k) => (
          <span key={k} className="text-[13px] font-semibold tracking-[0.18em] uppercase text-glr-muted/60 mr-16">
            {seg}
          </span>
        ))}
      </div>
    </div>
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
        className="flex items-end justify-between mb-10"
      >
        <div>
          <p className="text-glr-gold text-xs font-semibold uppercase tracking-widest mb-2.5">Official Merch</p>
          <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wider">WEAR THE VIBE</h2>
        </div>
        <a
          href={MERCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-xs text-glr-muted hover:text-glr-gold transition-colors font-medium"
        >
          Shop All <ChevronRight size={14} />
        </a>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {merchandise.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="glass rounded-2xl overflow-hidden border border-glr-border hover:border-glr-gold/40 hover:shadow-[0_12px_40px_rgba(245,158,11,0.12)] transition-all duration-300 group"
          >
            <div className="aspect-square relative overflow-hidden bg-black">
              <img
                src={item.photo}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-3 right-3 glass border border-glr-gold/30 rounded-full px-2.5 py-1">
                <span className="text-[11px] font-bold text-glr-gold">{item.price}</span>
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/70 bg-black/50 rounded-full px-2 py-0.5 backdrop-blur-sm">{item.tag}</span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-white text-sm font-semibold leading-tight">{item.name}</p>
              <a
                href={MERCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-semibold tracking-wide
                  bg-glr-gold/10 text-glr-gold border border-glr-gold/20
                  group-hover:bg-glr-gold group-hover:text-black group-hover:border-transparent
                  transition-all duration-300"
              >
                <ShoppingBag size={12} />
                Shop Now
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
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-glr-purple/8 blur-[80px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center relative z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-purple/25 mb-6">
          <Radio size={13} className="text-glr-purple" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-glr-purple">Newsletter</span>
        </div>
        <h2 className="font-heading text-5xl sm:text-6xl text-white tracking-wider mb-4">STAY IN THE LOOP</h2>
        <p className="text-glr-muted text-sm mb-8 leading-relaxed max-w-md mx-auto">
          Get the latest show schedules, new DJ announcements, and exclusive mixes delivered straight to your inbox.
        </p>
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 border border-green-500/30 bg-green-950/20"
          >
            <Zap size={28} className="text-green-400 mx-auto mb-3" />
            <p className="text-green-400 font-semibold text-base">You're in! Welcome to the Get Loose family.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="flex-1 px-5 py-3.5 rounded-full glass border border-glr-border text-white placeholder:text-glr-muted focus:outline-none focus:border-glr-purple/50 transition-colors text-sm font-medium"
            />
            <button
              type="submit"
              className="px-7 py-3.5 rounded-full bg-glr-purple text-white font-semibold text-sm
                hover:bg-glr-purple-light
                shadow-[0_0_20px_rgba(147,51,234,0.35)] hover:shadow-[0_0_28px_rgba(147,51,234,0.55)]
                transition-all duration-300 flex-shrink-0"
            >
              Subscribe
            </button>
          </form>
        )}
      </motion.div>
    </section>
  )
}

// ─── Magic Effects ────────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 4.7 + 3) % 95}%`,
  size: 2 + (i % 3),
  delay: (i * 0.31) % 5,
  dur: 3.5 + (i % 4) * 0.9,
  color: i % 3 === 0 ? 'rgba(147,51,234,0.85)' : i % 3 === 1 ? 'rgba(245,158,11,0.75)' : 'rgba(192,132,252,0.8)',
}))

const STARS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 3.7 + 2) % 97}%`,
  top: `${(i * 6.1 + 8) % 88}%`,
  delay: (i * 0.19) % 4,
  dur: 2.2 + (i % 4) * 0.7,
  char: i % 4 === 0 ? '✦' : i % 4 === 1 ? '✧' : i % 4 === 2 ? '·' : '★',
  opacity: i % 3 === 0 ? 'rgba(147,51,234,0.4)' : i % 3 === 1 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.2)',
  size: i % 3 === 0 ? '13px' : i % 3 === 1 ? '10px' : '8px',
}))

function MagicParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-0 rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 5}px ${p.color}`,
            animation: `magic-rise ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function StarField() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {STARS.map((s) => (
        <span
          key={s.id}
          className="absolute select-none"
          style={{
            left: s.left,
            top: s.top,
            fontSize: s.size,
            color: s.opacity,
            animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {s.char}
        </span>
      ))}
    </div>
  )
}

// ─── AI Chat Widget ───────────────────────────────────────────────────────────

const AVATAR_BG = [
  'from-purple-600 to-purple-800', 'from-amber-500 to-orange-700',
  'from-cyan-500 to-blue-700',     'from-pink-500 to-rose-700',
  'from-green-500 to-emerald-700', 'from-blue-500 to-indigo-700',
  'from-violet-500 to-purple-700', 'from-rose-500 to-pink-700',
]

const INITIAL_CHAT = [
  { id: 1, user: 'SoulGroove',   text: 'This set is absolutely fire 🔥',          time: '2:30 PM', colorIdx: 0 },
  { id: 2, user: 'ReggaeVibes',  text: 'Request: Play some roots reggae please!',  time: '2:31 PM', colorIdx: 1, isRequest: true },
  { id: 3, user: 'HouseHead_UK', text: 'That bassline just hit different 🎵',       time: '2:33 PM', colorIdx: 2 },
  { id: 4, user: 'FunkyFresh',   text: 'GLR never misses ❤️',                     time: '2:36 PM', colorIdx: 4 },
  { id: 5, user: 'AfroBeats247', text: 'Tuning in from Jamaica 🇯🇲',              time: '2:38 PM', colorIdx: 5 },
]

const BOT_RESPONSES_REQUEST = [
  '🎵 Request received! Passing it straight to the DJ — stay locked in!',
  '✨ Love that pick! Your request is in the queue. Coming up soon!',
  '🎶 Brilliant request! The DJ has been notified. Don\'t touch that dial!',
  '💜 Great taste! We\'ll spin that for you on Get Loose Radio!',
]

const BOT_RESPONSES_CHAT = [
  '💜 The vibes are absolutely immaculate tonight!',
  '🔥 That\'s the Get Loose spirit right there!',
  '✨ Thank you for being part of the GLR family — music for life!',
  '🎵 Six years of bringing you the finest sounds. And we\'re just getting started!',
  '🙌 The energy in here is unreal — keep it coming!',
  '🎧 Stay locked in, it only gets better from here!',
]

function AIChatWidget() {
  const [messages, setMessages] = useState(INITIAL_CHAT)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const isReq = mode === 'request'
    const text = isReq ? `🎵 Song Request: ${trimmed}` : trimmed
    setMessages((prev) => [
      ...prev.slice(-35),
      { id: Date.now(), user: 'You', text, time: now, colorIdx: 3, isRequest: isReq },
    ])
    setInput('')
    if (isReq) setMode('chat')

    setIsTyping(true)
    const lowerText = trimmed.toLowerCase()
    const wasRequest = isReq || lowerText.includes('request') || lowerText.includes('play ') || lowerText.includes('put on')
    setTimeout(() => {
      const pool = wasRequest ? BOT_RESPONSES_REQUEST : BOT_RESPONSES_CHAT
      const botText = pool[Math.floor(Math.random() * pool.length)]
      const botNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages((prev) => [
        ...prev.slice(-35),
        { id: Date.now() + 1, user: 'GLR Bot', text: botText, time: botNow, colorIdx: 0, isBot: true },
      ])
      setIsTyping(false)
    }, 900 + Math.random() * 700)
  }

  const sendReaction = (emoji) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [
      ...prev.slice(-35),
      { id: Date.now(), user: 'You', text: emoji, time: now, colorIdx: 3 },
    ])
  }

  return (
    <div
      className="w-full h-full rounded-3xl overflow-hidden flex flex-col animate-magic-border"
      style={{
        background: 'linear-gradient(180deg, rgba(14,0,24,0.97) 0%, rgba(5,0,16,0.99) 100%)',
        border: '1px solid rgba(147,51,234,0.35)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, rgba(147,51,234,0.12) 0%, rgba(245,158,11,0.04) 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]"
          />
          <span className="text-sm font-bold text-white">Live Chat & Requests</span>
          <span className="text-[10px] text-glr-purple/70 bg-glr-purple/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">AI</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setMode('chat')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-200
              ${mode === 'chat'
                ? 'bg-glr-purple text-white shadow-[0_0_12px_rgba(147,51,234,0.5)]'
                : 'bg-white/5 text-glr-muted hover:text-white'}`}
          >Chat</button>
          <button
            onClick={() => setMode('request')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-200
              ${mode === 'request'
                ? 'bg-glr-gold text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-white/5 text-glr-muted hover:text-white'}`}
          >🎵 Request</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -10, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-2.5"
          >
            <div
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${AVATAR_BG[msg.colorIdx % AVATAR_BG.length]} flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold shadow-sm`}
            >
              {msg.isBot ? '✨' : msg.user[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-[11px] font-bold ${msg.isBot ? 'text-glr-purple' : msg.user === 'You' ? 'text-glr-gold' : 'text-purple-400'}`}>
                  {msg.user}
                </span>
                {msg.isBot && (
                  <span className="text-[8px] font-bold text-glr-purple/60 bg-glr-purple/10 px-1.5 rounded-full uppercase tracking-wide">AI</span>
                )}
                <span className="text-[10px] text-glr-muted/50">{msg.time}</span>
              </div>
              {msg.isRequest && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-glr-gold bg-glr-gold/10 border border-glr-gold/25 px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-0.5">
                  🎵 Request
                </span>
              )}
              <p className={`text-[12px] mt-0.5 leading-relaxed break-words ${msg.isBot ? 'text-glr-purple/90' : msg.user === 'You' ? 'text-white' : 'text-white/80'}`}>
                {msg.text}
              </p>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-glr-purple/30 border border-glr-purple/40 flex-shrink-0 flex items-center justify-center text-[11px]">
              ✨
            </div>
            <div className="flex items-center gap-1 pt-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-glr-purple/70 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick reactions */}
      <div className="px-4 py-2 border-t border-white/[0.05] flex gap-1.5 flex-shrink-0">
        {['🔥', '❤️', '🎵', '🙌', '💜'].map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/12 border border-white/8 hover:border-glr-purple/40 flex items-center justify-center text-base transition-all duration-200 hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-white/[0.07] flex-shrink-0 space-y-2">
        {mode === 'request' && (
          <div className="flex items-center gap-1.5 px-1">
            <Music size={10} className="text-glr-gold flex-shrink-0" />
            <span className="text-[10px] font-bold text-glr-gold uppercase tracking-wider">Song Request — artist & title</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'request' ? 'Artist – Song title...' : 'Request a song or say something...'}
            maxLength={120}
            className="flex-1 px-4 py-2.5 rounded-full text-[12px] text-white placeholder:text-glr-muted/60 focus:outline-none font-medium transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: mode === 'request' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(147,51,234,0.25)',
            }}
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            disabled={!input.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all duration-200
              ${mode === 'request'
                ? 'bg-glr-gold shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                : 'bg-glr-purple shadow-[0_0_16px_rgba(147,51,234,0.5)] hover:bg-glr-purple-light'
              }`}
          >
            <Send size={13} className={mode === 'request' ? 'text-black' : 'text-white'} />
          </motion.button>
        </div>
        <Link
          to="/studio-live"
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-glr-muted hover:text-white text-[11px] font-semibold hover:border-glr-purple/30 transition-all duration-300"
        >
          <Radio size={11} /> Join Full Studio Chat
        </Link>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-black">

        {/* Background magic */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-glr-purple/10 blur-[120px] animate-aurora" />
          <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-glr-gold/5 blur-[90px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-glr-purple/[0.04] blur-[140px]" />
        </div>

        {/* Star field */}
        <StarField />

        {/* Floating particles */}
        <MagicParticles />

        {/* Ticker strip */}
        <HeroTicker />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 flex flex-col lg:flex-row items-center gap-8 pt-24 pb-20 min-h-screen">

          {/* LEFT — text content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col gap-6 items-start text-left"
          >
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-glr-red/30 bg-glr-red/8"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-glr-red live-dot" />
              <span className="text-glr-red text-[11px] font-bold uppercase tracking-[0.3em]">Live Now</span>
            </motion.div>

            {/* Logo + title row */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 -m-2 rounded-full border border-dashed border-glr-purple/25 animate-spin-slow" />
                <img
                  src={GLR_LOGO}
                  alt="Get Loose Radio"
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-glr-purple/50 shadow-[0_0_40px_rgba(147,51,234,0.5)]"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>
              <div>
                <p className="text-glr-muted text-xs font-semibold uppercase tracking-[0.3em]">Est. 2019</p>
                <p className="text-glr-gold/80 text-sm font-semibold tracking-widest">Music For Life</p>
              </div>
            </div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.8 }}
              className="font-heading leading-none tracking-widest"
              style={{ fontSize: 'clamp(4rem, 9vw, 8rem)' }}
            >
              <span className="block text-white">GET LOOSE</span>
              <span className="block text-gradient-purple">RADIO</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="shimmer-gold font-body text-lg tracking-[0.5em] uppercase font-semibold"
            >
              music for life
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/studio-live"
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-glr-purple text-white font-semibold text-sm
                  shadow-[0_0_24px_rgba(147,51,234,0.45)] hover:shadow-[0_0_40px_rgba(147,51,234,0.7)]
                  hover:bg-glr-purple-light transition-all duration-300">
                <Volume2 size={15} /> Listen Live
              </Link>
              <Link to="/#schedule"
                onClick={(e) => { e.preventDefault(); document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full glass border border-glr-border text-white font-semibold text-sm
                  hover:bg-white/[0.08] hover:border-white/15 transition-all duration-300">
                <Calendar size={15} /> View Schedule
              </Link>
            </motion.div>

            {/* Audio player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="w-full max-w-sm"
            >
              <HeroAudioPlayer />
            </motion.div>
          </motion.div>

          {/* RIGHT — AI Chat Widget */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 relative hidden lg:flex flex-col"
            style={{ height: '580px' }}
          >
            <AIChatWidget />
          </motion.div>
        </div>

        {/* Waveform bottom */}
        <HeroWaveform />

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
        >
          <span className="text-glr-muted text-[9px] tracking-[0.4em] uppercase font-medium">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-glr-purple/60 to-transparent" />
        </motion.div>
      </section>

      {/* Stats */}
      <StatsBar />

      {/* Schedule */}
      <div id="schedule-section">
        <ScheduleGrid />
      </div>

      {/* Featured DJs */}
      <FeaturedDJs />

      {/* Genre ticker */}
      <GenreTicker />

      {/* Merchandise Preview */}
      <MerchandisePreview />

      {/* Newsletter */}
      <NewsletterSection />
    </div>
  )
}
