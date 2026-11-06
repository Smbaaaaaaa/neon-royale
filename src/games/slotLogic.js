// Faire Slot-Logik: Ergebnisse kommen aus crypto.getRandomValues, die Gewichte unten sind öffentlich.
export const SYMBOLS = ['cherry', 'lemon', 'bell', 'bar', 'seven', 'diamond']
export const WEIGHTS = { cherry: 30, lemon: 26, bell: 18, bar: 12, seven: 8, diamond: 5 }
// Auszahlung in NC pro Linie bei 3 / 4 / 5 gleichen Symbolen von links
export const PAYS = {
  cherry: [2, 4, 10], lemon: [2, 5, 14], bell: [3, 9, 24],
  bar: [5, 16, 46], seven: [12, 38, 130], diamond: [20, 64, 240],
}
// Reihe (0 oben, 2 unten) pro Walze
export const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],
]
const TOTAL = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
export function rnd(n) { // gleichverteilte Zahl 0..n-1 ohne Modulo-Verzerrung
  const max = Math.floor(2 ** 32 / n) * n, b = new Uint32Array(1)
  do crypto.getRandomValues(b); while (b[0] >= max)
  return b[0] % n
}
export function randSymbol() {
  let r = rnd(TOTAL)
  for (const s of SYMBOLS) { if ((r -= WEIGHTS[s]) < 0) return s }
}
export const spinGrid = () => Array.from({ length: 5 }, () => Array.from({ length: 3 }, randSymbol))
export function evaluate(grid, bet = 2) {
  const wins = []
  LINES.forEach((line, li) => {
    const s = grid[0][line[0]]; let n = 1
    while (n < 5 && grid[n][line[n]] === s) n++
    if (n >= 3) wins.push({ line: li, symbol: s, count: n, pay: Math.round(PAYS[s][n - 3] * bet / 2) })
  })
  return { wins, total: wins.reduce((a, w) => a + w.pay, 0) }
}
// Stufe nach Vielfachem des Einsatzes, damit sie bei jedem Einsatz gleich selten ist
export const tier = (t, bet = 2) => (t >= bet * 20 ? 'jackpot' : t >= bet * 5 ? 'big' : t > 0 ? 'small' : 'none')
