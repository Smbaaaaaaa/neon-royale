import { useMemo } from 'react'
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
export const Die = ({ n }) => <div className="die">{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />)}</div>
// Zwei Würfel liegen als Dekoration auf dem Tisch und passen sich dem gewählten Design an
export default function TableDice() {
  const f = useMemo(() => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], [])
  return <div className="tdice" aria-hidden="true"><Die n={f[0]} /><Die n={f[1]} /></div>
}
