import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { useWallet } from '../context/Wallet.jsx'
import Roulette from './Roulette.jsx'
import PokerRoom from './PokerRoom.jsx'
import HoldemRoom from './HoldemRoom.jsx'
import NameFx from './NameFx.jsx'
import Avatar from './Avatar.jsx'
function InviteBox({ code }) {
  const { social, call } = useWallet(), [sent, setSent] = useState({}), friends = social?.friends || []
  if (!friends.length) return null
  return (
    <details className="rgroup invbox"><summary><b>Freunde einladen</b><span className="muted">{friends.length} Freunde</span></summary>
      <div className="fr-list">{friends.map(f => <div key={f.id} className="fr-row"><Avatar size={30} frame={f.eq?.frame || 'silverline'} avatar={f.eq?.avatar || 'ace-of-spades'} /><NameFx name={f.name} fx={f.eq?.namefx} />
        <button className="btn sm" disabled={sent[f.id]} onClick={async () => { const r = await call('invite_friend', { p_code: code, p_id: f.id }); if (!r?.error) setSent(s => ({ ...s, [f.id]: true })) }}>{sent[f.id] ? 'Eingeladen ✓' : 'Einladen'}</button></div>)}</div>
    </details>
  )
}
export default function Multiplayer() {
  const { p, call, social, refreshSocial } = useWallet()
  const [code, setCode] = useState(() => localStorage.getItem('nr-room') || ''), [input, setInput] = useState('')
  const [room, setRoom] = useState(null), [err, setErr] = useState(''), [revealed, setRevealed] = useState(0), [wait, setWait] = useState(false)
  const enter = c => { localStorage.setItem('nr-room', c); setCode(c); setErr('') }
  const exit = () => { localStorage.removeItem('nr-room'); setCode(''); setRoom(null); setRevealed(0) }
  const load = useCallback(async c => {
    const r = await call('get_room', { p_code: c })
    if (r?.error) { setErr(r.error); exit(); return }
    setRoom(r)
  }, [call])
  useEffect(() => {
    if (!code) return
    load(code)
    const ch = supabase.channel('room-' + code)
    for (const table of ['rooms', 'room_members', 'room_bets', 'holdem_seats'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `code=eq.${code}` }, () => load(code))
    ch.subscribe()
    const poll = setInterval(() => load(code), 4000) // Sicherheitsnetz, falls Echtzeit mal ausfällt
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [code, load])
  const create = async (game, mode = 'friendly') => { setWait(true); const r = await call('create_room', { p_game: game, p_mode: mode }); setWait(false); r?.error ? setErr(r.error) : enter(r) }
  const join = async c => { setWait(true); const r = await call('join_room', { p_code: typeof c === 'string' ? c : input }); setWait(false); r?.error ? setErr(r.error) : enter(r) }
  const leave = async () => { await call('leave_room', { p_code: code }); exit() }
  const act = async (fn, extra = {}) => {
    setWait(true); const r = await call(fn, { p_code: code, ...extra }); setWait(false)
    if (r?.error) setErr(r.error); else { setErr(''); load(code) }
    return r
  }

  if (!code || !room) return (
    <main><h1>Multiplayer</h1>
      <p className="muted">Spiele mit Freunden in privaten Räumen. Der Gastgeber erstellt einen Raum und bekommt einen 5-stelligen Code. Deine Freunde geben ihn bei "Raum beitreten" ein.</p>
      {(social?.invites || []).length > 0 && <section className="tile big"><h2>Einladungen</h2>{social.invites.map(i => <div key={i.code} className="fr-row">
        <span><b>{i.from}</b> lädt dich in einen {i.game === 'holdem' ? "Hold'em" : i.game === 'poker' ? 'Poker' : 'Roulette'}-Raum{i.mode === 'ranked' ? ' (Ranked)' : ''} ein.</span>
        <button className="btn sm" disabled={wait} onClick={() => join(i.code)}>Beitreten</button>
        <button className="btn sm ghost" onClick={async () => { await call('invite_dismiss', { p_code: i.code }); refreshSocial() }}>Ablehnen</button></div>)}</section>}
      <div className="grid">
        <section className="tile"><h2>Roulette-Raum</h2><p>Alle setzen auf denselben Tisch, der Gastgeber dreht, bis zu 8 Spieler.</p><button className="btn" onClick={() => create('roulette')} disabled={wait}>Roulette-Raum erstellen</button></section>
        <section className="tile"><h2>Poker-Raum</h2><p>Five Card Draw gegeneinander um einen gemeinsamen Pot, 2 bis 5 Spieler.</p><button className="btn" onClick={() => create('poker')} disabled={wait}>Poker-Raum erstellen</button></section>
        <section className="tile"><h2>Texas Hold'em</h2><p>Echtes Hold'em mit Blinds, Erhöhen und All-in, bis zu 9 Spieler. <b>Friendly:</b> jeder spielt für sich, setzt sich hin und steht auf, wann er will. <b>Ranked:</b> alle zahlen denselben Einsatz, der letzte Spieler mit Chips bekommt alles.</p><div className="row"><button className="btn" onClick={() => create('holdem', 'friendly')} disabled={wait}>Friendly-Raum</button><button className="btn ghost" onClick={() => create('holdem', 'ranked')} disabled={wait}>Ranked-Raum</button></div></section>
        <section className="tile"><h2>Raum beitreten</h2><p>Gib den Code deines Freundes ein.</p>
          <div className="row"><input value={input} onChange={e => setInput(e.target.value.toUpperCase())} maxLength={5} placeholder="CODE" aria-label="Raumcode" style={{ width: '7rem', textTransform: 'uppercase' }} />
            <button className="btn" onClick={join} disabled={wait || input.trim().length < 5}>Beitreten</button></div></section>
      </div>
      {err && <p className="muted">{err}</p>}
    </main>
  )
  const host = room.host === p.id, poker = room.game === 'poker', shown = revealed === room.round && room.phase === 'result'
  const ready = id => (poker ? room.seats.some(s => s.user_id === id && s.done) : room.bets.some(b => b.user_id === id))
  return (
    <main className="table-page">
      <div className="room-head">
        <div><small className="muted">{room.game === 'holdem' ? "Texas Hold'em" + (room.mode === 'ranked' ? ' · Ranked' : ' · Friendly') : poker ? 'Poker-Raum' : 'Roulette-Raum'}, Code</small><div className="room-code">{room.code}</div></div>
        <div className="row"><button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(room.code)}>Code kopieren</button><button className="btn sm ghost" onClick={leave}>{host ? 'Raum schließen' : 'Verlassen'}</button></div>
      </div>
      <div className="members">{room.members.map(m => <span key={m.user_id} className={'member' + (ready(m.user_id) ? ' ok' : '')}>
        <NameFx name={m.name} fx={m.eq?.namefx} />{m.user_id === room.host ? ' (Gastgeber)' : ''}{ready(m.user_id) ? ' ✓' : ''}<small className={'mnet ' + (Number(m.net) >= 0 ? 'up' : 'down')}>{Number(m.net) >= 0 ? '+' : ''}{Number(m.net || 0).toLocaleString('de-DE')} RC</small></span>)}</div>
      <InviteBox code={room.code} />
      {room.game === 'holdem' ? <HoldemRoom room={room} act={act} busy={wait} /> : poker ? <PokerRoom room={room} act={act} busy={wait} /> : <>
        <Roulette room={room} onBet={b => call('room_bet', { p_code: room.code, p_bets: b })} onDone={setRevealed} />
        <div className="row center">
          {host && room.phase === 'betting' && <button className="btn" onClick={() => act('room_spin')} disabled={wait || !room.bets.length}>Kugel rollen lassen</button>}
          {host && shown && <button className="btn" onClick={() => act('room_next')} disabled={wait}>Nächste Runde</button>}
        </div>
        <p className="muted center-t">{room.phase === 'betting' ? (host ? 'Warte, bis alle gesetzt haben (✓), dann starte die Kugel.' : 'Setze deine Chips und gib deine Wetten ab. Der Gastgeber startet die Kugel.') : shown ? '' : 'Die Kugel rollt …'}</p>
        {shown && <table className="stats"><thead><tr><th>Spieler</th><th>Einsatz</th><th>Auszahlung</th></tr></thead><tbody>
          {room.payouts.map(x => <tr key={x.user_id} className={Number(x.pay) > Number(x.stake) ? 'me' : ''}><td>{x.name}</td><td>{x.stake} RC</td><td>{x.pay} RC</td></tr>)}</tbody></table>}
      </>}
      {err && <p className="muted center-t">{err}</p>}
    </main>
  )
}
