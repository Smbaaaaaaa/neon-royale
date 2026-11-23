import { BETS } from '../games/registry.js'
import { sfx } from '../audio.js'
const CAP = 2000000000
// Einsatzauswahl mit festen Stufen und All-in (alle RC setzen)
export default function BetBar({ bet, setBet, disabled, coins, label = 'Einsatz', allin = true }) {
  const all = Math.min(coins, CAP)
  return (
    <div className="bets" role="group" aria-label={label}>
      {BETS.map(b => <button key={b} className={'bet' + (b === bet ? ' on' : '')} disabled={disabled || b > coins} onClick={() => { setBet(b); sfx.chip() }}>{b.toLocaleString('de-DE')}</button>)}
      {allin && <button className={'bet allin' + (bet === all && all >= 2 && !BETS.includes(bet) ? ' on' : '')} disabled={disabled || coins < 2} onClick={() => { setBet(all); sfx.chip() }} title="Alle RC setzen">All-in</button>}
    </div>
  )
}
