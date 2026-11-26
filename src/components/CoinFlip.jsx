import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import Cabinet from './Cabinet.jsx'
import Coin from './Coin.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const fmt = n => Number(n).toLocaleString('de-DE')
const Back = () => (
  <svg viewBox="0 0 200 200" width="100%" height="100%" aria-label="Zahl">
    <defs><radialGradient id="cfb" cx=".35" cy=".28" r=".95"><stop offset="0" stopColor="#ffe9a3" /><stop offset=".4" stopColor="#e2b64a" /><stop offset="1" stopColor="#7a5208" /></radialGradient></defs>
    <circle cx="100" cy="100" r="98" fill="#4a3205" /><circle cx="100" cy="100" r="92" fill="url(#cfb)" /><circle cx="100" cy="100" r="92" fill="none" stroke="#fff6c8" strokeOpacity=".6" strokeWidth="5" strokeDasharray="1.6 3.1" />
    <circle cx="100" cy="100" r="78" fill="none" stroke="#6b4a08" strokeWidth="1.5" />
    <text x="100" y="124" textAnchor="middle" fontFamily="Fraunces,serif" fontWeight="800" fontSize="72" fill="#7a5208" stroke="#fff1b8" strokeWidth="1.2" paintOrder="stroke">RC</text>
    <ellipse cx="66" cy="50" rx="46" ry="20" fill="#fff" opacity=".2" transform="rotate(-28 66 50)" />
  </svg>
)
export default function CoinFlip() {
  const { p, adjust, refresh, call } = useWallet(), showWin = useWin()
  const [bet, setBet] = useState(10), [side, setSide] = useState('heads'), [busy, setBusy] = useState(false), [rot, setRot] = useState(0), [res, setRes] = useState(null), [err, setErr] = useState(''), [toss, setToss] = useState(false)
  const flip = async () => {
    if (busy || p.coins < bet) return
    sfx.unlock(); setBusy(true); setErr(''); setRes(null)
    const r = await call('play_coin', { p_bet: bet, p_side: side })
    if (r?.error) { setBusy(false); setErr(r.error); return }
    adjust(-bet); sfx.chip(); setToss(true)
    setRot(v => v + 1800 + ((((r.result === 'heads' ? 0 : 180) - (v % 360)) + 360) % 360))
    setTimeout(() => {
      const pay = Number(r.pay); setToss(false); setRes(r); refresh()
      if (pay > 0) { sfx.win('big'); showWin(pay - bet, tierOf(pay - bet, bet)) } else sfx.lose()
      setBusy(false)
    }, 2300)
  }
  return (
    <main className="table-page"><h1>Münzwurf</h1>
      <Cabinet title="Münzwurf" deck={<>
        <div className="row center"><button className={'bet' + (side === 'heads' ? ' on' : '')} disabled={busy} onClick={() => setSide('heads')}>Kopf (Krone)</button><button className={'bet' + (side === 'tails' ? ' on' : '')} disabled={busy} onClick={() => setSide('tails')}>Zahl (RC)</button></div>
        <BetBar bet={bet} setBet={setBet} disabled={busy} coins={p.coins} />
        <button className="arc-btn" disabled={busy || p.coins < bet} onClick={flip}>Werfen, {fmt(bet)} RC</button></>}>
        <div className={'tosser' + (toss ? ' toss' : '')}><div className="flipcoin" style={{ transform: `rotateY(${rot}deg)` }}>
          <div className="fc-face"><Coin size={150} /></div><div className="fc-face fc-back"><Back /></div></div></div>
        <p className="cab-msg" role="status">{err || (res ? (Number(res.pay) > 0 ? `${res.result === 'heads' ? 'Kopf' : 'Zahl'}, gewonnen: +${fmt(res.pay)} RC` : `${res.result === 'heads' ? 'Kopf' : 'Zahl'}, leider verloren`) : 'Tipp auf Kopf oder Zahl, Gewinn 1,94-fach.')}</p>
      </Cabinet>
    </main>
  )
}
