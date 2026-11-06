import { rnd } from './slotLogic.js'
export const SUITS = ['♠', '♥', '♦', '♣']
export const rankLabel = r => (r < 11 ? String(r) : 'JQKA'[r - 11])
export function newDeck(n = 1) {
  const d = []
  for (let k = 0; k < n; k++) for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s })
  for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]] }
  return d
}
export function bjValue(hand) {
  let t = 0, a = 0
  for (const c of hand) { if (c.r === 14) { a++; t += 11 } else t += c.r > 10 ? 10 : c.r }
  while (t > 21 && a > 0) { t -= 10; a-- }
  return t
}
export const POKER = [ // Jacks or Better, Auszahlung als Vielfaches des Einsatzes
  ['royal', 'Royal Flush', 800], ['sflush', 'Straight Flush', 50], ['quads', 'Vierling', 25], ['full', 'Full House', 9],
  ['flush', 'Flush', 6], ['straight', 'Straße', 4], ['trips', 'Drilling', 3], ['twopair', 'Zwei Paare', 2], ['jacks', 'Paar Buben oder besser', 1],
]
export function pokerEval(h) {
  const rs = h.map(c => c.r).sort((a, b) => a - b), flush = h.every(c => c.s === h[0].s)
  const straight = new Set(rs).size === 5 && (rs[4] - rs[0] === 4 || rs.join() === '2,3,4,5,14')
  const cnt = {}; rs.forEach(r => (cnt[r] = (cnt[r] || 0) + 1))
  const c = Object.values(cnt).sort((a, b) => b - a)
  if (straight && flush) return rs[0] === 10 ? 'royal' : 'sflush'
  if (c[0] === 4) return 'quads'
  if (c[0] === 3 && c[1] === 2) return 'full'
  if (flush) return 'flush'
  if (straight) return 'straight'
  if (c[0] === 3) return 'trips'
  if (c[0] === 2 && c[1] === 2) return 'twopair'
  if (Object.entries(cnt).some(([r, n]) => n === 2 && +r >= 11)) return 'jacks'
  return null
}
