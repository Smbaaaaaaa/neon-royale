import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../context/Wallet.jsx'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
const fmt = n => Number(n).toLocaleString('de-DE')
export default function FriendsPanel() {
  const { p, call, social, refreshSocial, refresh } = useWallet(), nav = useNavigate()
  const [code, setCode] = useState(''), [msg, setMsg] = useState(''), [pay, setPay] = useState(null), [amt, setAmt] = useState(''), [sure, setSure] = useState(false)
  const run = async (fn, args, ok) => { setMsg(''); const r = await call(fn, args); if (r?.error) setMsg(r.error); else { setMsg(ok || ''); await refreshSocial(); refresh() } return r }
  const f = social || { friends: [], incoming: [], outgoing: [], transfers: [] }
  const Who = ({ u }) => <button className="linkname" onClick={() => nav('/profil/' + u.id)}><Avatar size={30} frame={u.eq?.frame || 'silverline'} avatar={u.eq?.avatar || 'ace-of-spades'} /><NameFx name={u.name} fx={u.eq?.namefx} /></button>
  return (
    <section className="friends"><h2 className="sec">Freunde</h2>
      <div className="tile"><small className="muted">Deine Freundes-ID, sie gilt immer und nur für dich</small>
        <div className="fr-codeline"><span className="fr-code">{p.friendCode || '…'}</span><button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(p.friendCode || '')}>Kopieren</button></div>
        <div className="row"><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ID eines Freundes" aria-label="Freundes-ID" style={{ width: '11rem' }} />
          <button className="btn sm" disabled={code.trim().length < 6} onClick={async () => { const r = await run('friend_add', { p_code: code }, 'Anfrage gesendet'); if (!r?.error) setCode('') }}>Hinzufügen</button></div>
        {msg && <p className="muted">{msg}</p>}</div>
      {f.incoming.length > 0 && <div className="tile"><h2>Anfragen an dich</h2>{f.incoming.map(u => <div key={u.id} className="fr-row"><Who u={u} />
        <button className="btn sm" onClick={() => run('friend_respond', { p_id: u.id, p_accept: true }, 'Ihr seid jetzt befreundet')}>Annehmen</button>
        <button className="btn sm ghost" onClick={() => run('friend_respond', { p_id: u.id, p_accept: false })}>Ablehnen</button></div>)}</div>}
      {f.outgoing.length > 0 && <div className="tile"><h2>Gesendete Anfragen</h2>{f.outgoing.map(u => <div key={u.id} className="fr-row"><Who u={u} />
        <button className="btn sm ghost" onClick={() => run('friend_remove', { p_id: u.id })}>Zurückziehen</button></div>)}</div>}
      <div className="tile"><h2>Deine Freunde ({f.friends.length})</h2>
        {!f.friends.length && <p className="muted">Noch keine Freunde. Tausche deine ID mit jemandem aus.</p>}
        {f.friends.map(u => <div key={u.id} className="fr-block"><div className="fr-row"><Who u={u} />
          <button className="btn sm" onClick={() => { setPay(pay === u.id ? null : u.id); setAmt(''); setSure(false) }}>Geld senden</button>
          <button className="btn sm ghost" onClick={() => run('friend_remove', { p_id: u.id })}>Entfernen</button></div>
          {pay === u.id && <div className="fr-send"><input type="number" min="1" value={amt} onChange={e => { setAmt(e.target.value); setSure(false) }} placeholder="Betrag in RC" style={{ width: '10rem' }} />
            {!sure ? <button className="btn sm" disabled={!(Number(amt) >= 1) || Number(amt) > p.coins} onClick={() => setSure(true)}>Weiter</button>
              : <button className="btn sm" onClick={async () => { const r = await run('send_money', { p_id: u.id, p_amount: Math.floor(Number(amt)) }, `${fmt(amt)} RC an ${u.name} gesendet`); if (!r?.error) { setPay(null); setSure(false) } }}>Wirklich {fmt(amt)} RC an {u.name} senden</button>}</div>}</div>)}</div>
      {f.transfers.length > 0 && <div className="tile"><h2>Letzte Überweisungen</h2>{f.transfers.map((t, i) => <div key={i} className="fr-row"><span>{t.sent ? `An ${t.other}` : `Von ${t.other}`}</span>
        <b className={t.sent ? 'mnet down' : 'mnet up'}>{t.sent ? '-' : '+'}{fmt(t.amount)} RC</b></div>)}</div>}
    </section>
  )
}
