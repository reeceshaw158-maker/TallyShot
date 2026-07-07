import React, { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Radio } from 'lucide-react'
import { MERCH_URL } from '../data/index.js'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Studio Live', to: '/studio-live' },
  { label: 'Music', to: '/music' },
  { label: 'Archives', to: '/archives' },
  { label: 'DJ Profiles', to: '/dj-profiles' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-dark shadow-[0_4px_30px_rgba(147,51,234,0.15)]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-glr-purple to-glr-gold flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]">
                <Radio size={18} className="text-white" />
              </div>
              {/* live dot */}
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-glr-red live-dot" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-xl text-white tracking-widest group-hover:text-glr-gold transition-colors">
                GET LOOSE RADIO
              </span>
              <span className="text-[9px] text-glr-gold tracking-[0.3em] uppercase font-medium">
                music for life
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium tracking-wider uppercase transition-all duration-200 rounded-md
                  ${isActive
                    ? 'text-glr-gold bg-white/5'
                    : 'text-glr-muted hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <a
              href={MERCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 px-4 py-2 text-sm font-semibold tracking-wider uppercase rounded-md
                bg-gradient-to-r from-glr-purple to-glr-purple-dark text-white
                hover:from-glr-purple-light hover:to-glr-purple
                shadow-[0_0_15px_rgba(147,51,234,0.35)]
                hover:shadow-[0_0_25px_rgba(147,51,234,0.55)]
                transition-all duration-200"
            >
              Merch
            </a>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-glr-muted hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden glass-dark border-t border-glr-border overflow-hidden"
          >
            <nav className="flex flex-col px-4 py-3 gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-3 text-sm font-medium tracking-wider uppercase rounded-md transition-colors
                    ${isActive ? 'text-glr-gold bg-white/5' : 'text-glr-muted hover:text-white hover:bg-white/5'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <a
                href={MERCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="mt-2 px-4 py-3 text-sm font-semibold tracking-wider uppercase rounded-md text-center
                  bg-gradient-to-r from-glr-purple to-glr-purple-dark text-white"
              >
                Merchandise
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
