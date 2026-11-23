// Faire Slot-Logik: Ergebnisse kommen aus crypto.getRandomValues, die Gewichte unten sind öffentlich.
// Gewinn: 3, 4 oder 5 gleiche Symbole auf einer der 9 Linien, gezählt von LINKS und von RECHTS.
export const SYMBOLS = ['cherry', 'lemon', 'bell', 'bar', 'seven', 'diamond']
export const WEIGHTS = { cherry: 33, lemon: 28, bell: 17, bar: 11, seven: 7, diamond: 4 }
// Auszahlung in RC pro Linie bei 3 / 4 / 5 gleichen Symbolen (gilt für 2 RC Einsatz, skaliert mit dem Einsatz)
export const PAYS = {
  cherry: [1, 2, 7], lemon: [1, 3, 10], bell: [2, 6, 17],
  bar: [4, 11, 34], seven: [9, 27, 95], diamond: [15, 45, 170],
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
  const wins = [], pay = (s, n) => Math.round(PAYS[s][n - 3] * bet / 2)
  LINES.forEach((line, li) => {
    const at = i => grid[i][line[i]]
    let n = 1; while (n < 5 && at(n) === at(0)) n++
    if (n >= 3) wins.push({ line: li, symbol: at(0), count: n, dir: 1, pay: pay(at(0), n) })
    if (n < 5) { // von rechts: bei 5 gleichen Symbolen wird nur einmal gezählt
      let m = 1; while (m < 5 && at(4 - m) === at(4)) m++
      if (m >= 3) wins.push({ line: li, symbol: at(4), count: m, dir: -1, pay: pay(at(4), m) })
    }
  })
  return { wins, total: wins.reduce((a, w) => a + w.pay, 0) }
}
// Stufe nach Vielfachem des Einsatzes, damit sie bei jedem Einsatz gleich selten ist
export const tier = (t, bet = 2) => (t >= bet * 20 ? 'jackpot' : t >= bet * 5 ? 'big' : t > 0 ? 'small' : 'none')
