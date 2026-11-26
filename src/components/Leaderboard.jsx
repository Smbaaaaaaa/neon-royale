import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../context/Wallet.jsx'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
const GAMES = [['all', 'Gesamt'], ['slots', 'Slot Machine'], ['roulette', 'Roulette'], ['blackjack', 'Blackjack'], ['poker', 'Video Poker'], ['holdem', "Texas Hold'em"], ['scratch', 'Rubbellose'], ['plinko', 'Royal Plinko'], ['wheel', 'Glücksrad'], ['coinflip', 'Münzwurf'], ['dice', 'Würfeltisch'], ['ranked', 'Ranked-Turniere']]
const TABLES = [['rounds', 'Gespielte Runden'], ['won', 'Insgesamt gewonnen'], ['peak', 'Höchstes Guthaben (All-Time)']]
const fmt = n => Number(n).toLocaleString('de-DE')
export default function Leaderboard() {
  const { p, call } = useWallet(), nav = useNavigate()
  const [table, setTable] = useState('rounds'), [game, setGame] = useState('all'), [rows, setRows] = useState(null), [err, setErr] = useState('')
  const kind = table === 'rounds' ? game : table
  useEffect(() => { setRows(null); call('get_leaderboard', { p_game: kind }).then(r => (r?.error ? setErr(r.error) : (setErr(''), setRows(r)))) }, [kind, call])
  const head = table === 'rounds' ? (game === 'ranked' ? 'Turniersiege' : 'Runden') : table === 'won' ? 'Insgesamt gewonnen' : 'All-Time-Höchststand'
  const val = r => (table === 'rounds' ? fmt(r.value) : fmt(r.value) + ' RC')
  return (
    <main><h1>Rangliste</h1>
      <div className="views">{TABLES.map(([k, l]) => <button key={k} className={table === k ? 'on' : ''} onClick={() => setTable(k)}>{l}</button>)}</div>
      <p className="muted">{table === 'rounds' ? 'Wer hat am meisten gespielt? Wähle unten ein Spiel.' : table === 'won' ? 'Alles, was ein Spieler in Spielen insgesamt gewonnen hat (nur der Gewinn über dem Einsatz, ohne Bonusse). Zählt ab jetzt.' : 'Das meiste Geld, das ein Spieler je auf einmal auf dem Konto hatte. Der Wert steigt nur und sinkt nie, auch wenn danach alles verloren geht.'} Tippe auf einen Namen, um das Profil zu öffnen.</p>
      {table === 'rounds' && <div className="tabs" role="tablist">{GAMES.map(([k, l]) => <button key={k} role="tab" aria-selected={game === k} className={game === k ? 'on' : ''} onClick={() => setGame(k)}>{l}</button>)}</div>}
      {err && <p className="muted">{err}</p>}
      {rows && !rows.length && <p className="muted">Noch keine Einträge.</p>}
      {rows?.length > 0 && <table className="stats"><thead><tr><th>#</th><th>Spieler</th><th>{head}</th></tr></thead><tbody>
        {rows.map((r, i) => <tr key={r.id} className={r.id === p.id ? 'me' : ''}><td>{i + 1}</td>
          <td><button className="linkname" onClick={() => nav('/profil/' + r.id)}><Avatar size={30} frame={r.eq?.frame || 'silverline'} avatar={r.eq?.avatar || 'ace-of-spades'} /><NameFx name={r.name} fx={r.eq?.namefx} /></button></td>
          <td>{val(r)}</td></tr>)}</tbody></table>}
    </main>
  )
}
