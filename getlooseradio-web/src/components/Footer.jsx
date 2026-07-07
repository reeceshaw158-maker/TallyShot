import React from 'react'
import { Link } from 'react-router-dom'
import { Radio, Instagram, Facebook, Music } from 'lucide-react'
import { MERCH_URL } from '../data/index.js'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Studio Live', to: '/studio-live' },
  { label: 'Music', to: '/music' },
  { label: 'Archives', to: '/archives' },
  { label: 'DJ Profiles', to: '/dj-profiles' },
  { label: 'Merchandise', href: MERCH_URL },
]

const socials = [
  { icon: Instagram, label: 'Instagram', href: '#' },
  { icon: Facebook, label: 'Facebook', href: '#' },
  {
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
        <path d="M11.5 2C6.25 2 2 6.25 2 11.5S6.25 21 11.5 21c2.35 0 4.5-.82 6.19-2.17L20 21l2-2-2.17-2.31A9.456 9.456 0 0 0 21 11.5C21 6.25 16.75 2 11.5 2zm0 2c4.14 0 7.5 3.36 7.5 7.5S15.64 19 11.5 19 4 15.64 4 11.5 7.36 4 11.5 4zm-.5 2v6l5 3 .75-1.23-4.25-2.52V6H11z" />
      </svg>
    ),
    label: 'Mixcloud',
    href: '#',
  },
  { icon: Music, label: 'SoundCloud', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#060606] border-t border-glr-border mt-auto pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-glr-purple to-glr-gold flex items-center justify-center">
                <Radio size={18} className="text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-heading text-xl text-white tracking-widest">GET LOOSE RADIO</span>
                <span className="text-[9px] text-glr-gold tracking-[0.3em] uppercase font-medium">music for life</span>
              </div>
            </div>
            <p className="text-glr-muted text-sm leading-relaxed max-w-xs">
              Your home for the finest in soul, reggae, hip hop, house, and more. Broadcasting live, always.
            </p>
            <div className="flex items-center gap-3">
              {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full glass flex items-center justify-center text-glr-muted hover:text-glr-purple hover:border-glr-purple transition-all duration-200"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Nav links */}
          <div>
            <h3 className="font-heading text-lg tracking-widest text-white mb-4">Navigate</h3>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link
                      to={link.to}
                      className="text-glr-muted hover:text-glr-gold text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-glr-muted hover:text-glr-gold text-sm transition-colors"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-heading text-lg tracking-widest text-white mb-4">Stay In The Loop</h3>
            <p className="text-glr-muted text-sm mb-4">Get schedule updates, new shows, and events delivered to your inbox.</p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-glr-border text-sm text-white placeholder:text-glr-muted focus:outline-none focus:border-glr-purple transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-glr-purple hover:bg-glr-purple-light text-white text-sm font-semibold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)]"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-glr-muted text-sm">© 2025 Get Loose Radio. Music For Life.</p>
          <p className="text-glr-muted text-xs">Broadcasting from the underground.</p>
        </div>
      </div>
    </footer>
  )
}
