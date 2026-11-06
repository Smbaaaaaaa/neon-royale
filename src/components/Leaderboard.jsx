import { useEffect, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
const TABS = [['all', 'Gesamt'], ['slots', 'Slot Machine'], ['roulette', 'Roulette'], ['blackjack', 'Blackjack'], ['poker', 'Video Poker']]
export default function Leaderboard() {
  const { p, call } = useWallet(); const [tab, setTab] = useState('all'), [rows, setRows] = useState(null), [err, setErr] = useState('')
  useEffect(() => { setRows(null); call('get_leaderboard', { p_game: tab }).then(r => r?.error ? setErr(r.error) : (setErr(''), setRows(r))) }, [tab, call])
  return (
    <main><h1>Rangliste</h1>
      <p className="muted">Wer hat am meisten gespielt? Gerankt wird nach gespielten Runden, nicht nach Coins oder Gewinnen.</p>
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {err && <p className="muted">{err}</p>}
      {rows && !rows.length && <p className="muted">Noch niemand hat hier gespielt.</p>}
      {rows?.length > 0 && <table className="stats"><thead><tr><th>#</th><th>Spieler</th><th>Runden</th></tr></thead><tbody>
        {rows.map((r, i) => <tr key={i} className={r.name === p.name ? 'me' : ''}><td>{i + 1}</td><td>{r.name}</td><td>{r.rounds}</td></tr>)}</tbody></table>}
    </main>
  )
}
