import { ACCENTS } from './games/items.js'
// Wendet Hintergrund und Akzentfarbe des Spielers auf die ganze Seite an
export function applyTheme(eq) {
  const hex = ACCENTS[eq?.accent] || ACCENTS.silver, r = document.documentElement
  const [R, G, B] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  r.style.setProperty('--accent', hex)
  r.style.setProperty('--accent-ink', (0.299 * R + 0.587 * G + 0.114 * B) / 255 > 0.5 ? '#0a0a0b' : '#f3efe6')
  r.dataset.bg = eq?.bg || 'matte-black'
}
