import { BETS } from '../games/registry.js'
import { sfx } from '../audio.js'
export default function BetBar({ bet, setBet, disabled, coins, label = 'Einsatz' }) {
  return <div className="bets" role="group" aria-label={label}>
    {BETS.map(b => <button key={b} className={'bet' + (b === bet ? ' on' : '')} disabled={disabled || b > coins} onClick={() => { setBet(b); sfx.chip() }}>{b}</button>)}
  </div>
}
