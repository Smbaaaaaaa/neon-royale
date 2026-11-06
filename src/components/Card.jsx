import { SUITS, rankLabel } from '../games/cards.js'
export default function Card({ c, hidden, hold, onClick, i = 0 }) {
  const red = c && (c.s === 1 || c.s === 2)
  return <div className={'card' + (hidden ? ' back' : red ? ' red' : '') + (hold ? ' hold' : '') + (onClick ? ' pick' : '')}
    style={{ animationDelay: i * 120 + 'ms' }} onClick={onClick}>
    {!hidden && <><b>{rankLabel(c.r)}</b><span>{SUITS[c.s]}</span></>}
  </div>
}
