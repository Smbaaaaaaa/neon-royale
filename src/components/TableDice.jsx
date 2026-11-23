import { useMemo } from 'react'
import Logo from './Logo.jsx'
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const ORIENT = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [0, 3]]
const Face = ({ v }) => <span className={'f f' + v}>{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[v].includes(i) ? 'on' : ''} />)}</span>
// Würfel als echter 3D-Würfel (6 Flächen). Die Zahl n bestimmt nur, wie er gerade liegt.
export const Die = ({ n }) => {
  const [ox, oy] = ORIENT[(n - 1) % 6]
  return <span className="dwrap"><span className="die" style={{ '--ox': ox, '--oy': oy }}>{[1, 2, 3, 4, 5, 6].map(v => <Face key={v} v={v} />)}</span></span>
}
// Zwei Würfel liegen als Dekoration auf dem Tisch und passen sich dem gewählten Design an
export default function TableDice() {
  const f = useMemo(() => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], [])
  return <><div className="tlogo" aria-hidden="true"><Logo /></div><div className="tdice" aria-hidden="true"><Die n={f[0]} /><Die n={f[1]} /></div></>
}
