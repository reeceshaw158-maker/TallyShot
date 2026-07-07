import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import NowPlayingBar from './components/NowPlayingBar.jsx'
import Home from './pages/Home.jsx'
import StudioLive from './pages/StudioLive.jsx'
import Music from './pages/Music.jsx'
import Archives from './pages/Archives.jsx'
import DJProfiles from './pages/DJProfiles.jsx'

export default function App() {
  const location = useLocation()

  return (
    <div className="flex flex-col min-h-screen bg-glr-black">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/studio-live" element={<StudioLive />} />
            <Route path="/music" element={<Music />} />
            <Route path="/archives" element={<Archives />} />
            <Route path="/dj-profiles" element={<DJProfiles />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
      <NowPlayingBar />
    </div>
  )
}
