import { useState } from 'react'
import { getAudio, setVolume, setMuted } from '../audio.js'
// Lautstärke für die ganze Seite, immer oben in der Navigation erreichbar
export default function SoundControl() {
  const [open, setOpen] = useState(false), [a, setA] = useState(getAudio())
  const off = a.muted || a.vol === 0
  return (
    <div className="snd">
      <button className="snd-btn" aria-label="Ton und Lautstärke" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />{off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
      </button>
      {open && <div className="snd-pop">
        <label className="snd-row"><input type="checkbox" checked={!a.muted} onChange={e => { setMuted(!e.target.checked); setA(getAudio()) }} /> Ton an</label>
        <div className="snd-row"><input type="range" min="0" max="100" step="1" value={Math.round(a.vol * 100)} onChange={e => { setVolume(+e.target.value / 100); setA(getAudio()) }} aria-label="Lautstärke" /><b>{Math.round(a.vol * 100)} %</b></div>
      </div>}
    </div>
  )
}
