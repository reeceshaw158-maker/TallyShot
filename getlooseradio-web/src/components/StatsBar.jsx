import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

function AnimatedNumber({ target, suffix = '', duration = 2000 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setDisplay(target)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  { label: 'Years On Air',      value: 6,    suffix: '',   detail: 'Broadcasting since 2019' },
  { label: 'Shows Every Week',  value: 10,   suffix: '+',  detail: 'Fresh music every week'  },
  { label: 'Shows Aired',       value: 5200, suffix: '+',  detail: 'And counting'            },
  { label: 'Resident DJs',      value: 11,   suffix: '',   detail: 'World-class selectors'   },
]

export default function StatsBar() {
  return (
    <section className="relative overflow-hidden">
      {/* Top edge glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glr-purple/60 to-transparent" />

      {/* Subtle ambient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-glr-purple/[0.06] via-transparent to-glr-gold/[0.03]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(147,51,234,0.08)_0%,transparent_70%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <React.Fragment key={stat.label}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center px-4 py-6 sm:py-8 relative"
              >
                {/* Big number */}
                <p
                  className="font-heading leading-none tracking-wide"
                  style={{
                    fontSize: 'clamp(3rem, 6vw, 5rem)',
                    background: i % 2 === 0
                      ? 'linear-gradient(135deg, #c084fc 0%, #9333ea 55%, #7e22ce 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 55%, #f59e0b 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>

                {/* Label */}
                <p className="text-white/90 font-semibold text-sm sm:text-base mt-2 tracking-wide leading-tight">
                  {stat.label}
                </p>

                {/* Detail */}
                <p className="text-glr-muted text-[11px] sm:text-xs mt-1 tracking-wider uppercase font-medium">
                  {stat.detail}
                </p>

                {/* Animated underline accent */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.6 }}
                  className="mt-4 h-[2px] w-10 rounded-full origin-left"
                  style={{
                    background: i % 2 === 0
                      ? 'linear-gradient(90deg, #9333ea, #c084fc)'
                      : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  }}
                />
              </motion.div>

              {/* Vertical divider between items */}
              {i < stats.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent"
                  style={{ left: `${(i + 1) * 25}%` }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </section>
  )
}
