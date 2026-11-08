// Synthetische Sounds über die Web Audio API, ohne Audiodateien.
let ctx, master
let vol = parseFloat(localStorage.getItem('nr-vol') ?? '0.5')
let muted = localStorage.getItem('nr-mute') === '1'
const ac = () => {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.connect(ctx.destination) }
  master.gain.value = muted ? 0 : vol
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
export const getAudio = () => ({ vol, muted })
export function setVolume(v) { vol = v; localStorage.setItem('nr-vol', v); if (master) master.gain.value = muted ? 0 : v }
export function setMuted(m) { muted = m; localStorage.setItem('nr-mute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : vol }
function tone(f, d, type = 'sine', g = 0.3, at = 0, to) {
  const c = ac(), o = c.createOscillator(), e = c.createGain(), t = c.currentTime + at
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d)
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + d)
  o.connect(e).connect(master); o.start(t); o.stop(t + d + 0.02)
}
function noise(d, g = 0.3, freq = 1000, at = 0) {
  const c = ac(), n = c.sampleRate * d, b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0)
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1
  const s = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain(), t = c.currentTime + at
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + d)
  s.connect(f).connect(e).connect(master); s.start(t)
}
export const sfx = {
  unlock: () => ac(),
  charge(ms) {
    const c = ac(), t = c.currentTime, d = ms / 1000, o = c.createOscillator(), g = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(700, t + d)
    g.gain.setValueAtTime(0.02, t); g.gain.linearRampToValueAtTime(0.14, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.05)
    o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.1)
    let at = 0, gap = 0.5; while (at < d - 0.1) { tone(70, 0.12, 'sine', 0.35, at, 40); at += gap; gap = Math.max(0.1, gap * 0.86) }
  },
  reveal(r) {
    const sets = { common: [523, 659], rare: [523, 659, 784], epic: [523, 659, 784, 1046], legendary: [392, 523, 659, 784, 1046, 1318], mythic: [262, 392, 523, 659, 784, 1046, 1318, 1568] }
    ;(sets[r] || sets.common).forEach((n, i) => tone(n, 0.5, 'triangle', 0.22, i * 0.07)); noise(0.5, 0.5, 2500)
    if (r === 'legendary' || r === 'mythic') tone(55, 1.2, 'sine', 0.7, 0, 30)
  },
  thud() { tone(90, 0.6, 'sine', 0.9, 0, 32); noise(0.4, 0.7, 450); tone(55, 0.8, 'triangle', 0.5, 0.05, 28) },
  card() { noise(0.06, 0.3, 3500); tone(320, 0.05, 'triangle', 0.1) },
  chip() { tone(1500, 0.06, 'square', 0.07); tone(950, 0.09, 'sine', 0.1, 0.03) },
  lose() { tone(220, 0.35, 'sawtooth', 0.1, 0, 90) },
  lever() { noise(0.18, 0.5, 500); tone(140, 0.2, 'square', 0.15, 0, 50); tone(70, 0.25, 'triangle', 0.4, 0.05) },
  tick() { tone(1100 + Math.random() * 200, 0.025, 'square', 0.04) },
  stop() { tone(220, 0.14, 'triangle', 0.45, 0, 70); noise(0.06, 0.25, 2000) },
  coin() { const f = 1800 + Math.random() * 500; tone(f, 0.25, 'sine', 0.18); tone(f * 1.5, 0.2, 'sine', 0.1, 0.03) },
  win(level) {
    const notes = level === 'jackpot' ? [523, 659, 784, 1046, 1318, 1568, 2093] : level === 'big' ? [523, 659, 784, 1046] : [659, 880]
    notes.forEach((n, i) => tone(n, 0.3, 'triangle', 0.25, i * 0.1))
  },
}
