import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWallet } from '../context/Wallet.jsx'
import { ITEMS, TYPES, RAR } from '../games/items.js'
import { games } from '../games/registry.js'
import { SUITS, rankLabel } from '../games/cards.js'
import { sfx } from '../audio.js'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
import Coin from './Coin.jsx'
import { Die } from './TableDice.jsx'
import { useWin } from './WinBanner.jsx'
const fmt = n => Number(n).toLocaleString('de-DE')
const hash = s => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return h >>> 0 }
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// Kleiner Tisch: Karten, Chipstapel, lose Chips und Würfel liegen zufällig, aber bei jedem Spieler immer gleich, im Design des Spielers
function ProfileTable({ eq, seed }) {
  const L = useMemo(() => {
    const r = rng(hash(String(seed))), zones = [[24, 42], [52, 38], [78, 46], [34, 76], [68, 76]]
    for (let i = zones.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [zones[i], zones[j]] = [zones[j], zones[i]] }
    const at = z => ({ left: z[0] + (r() - 0.5) * 7 + '%', top: z[1] + (r() - 0.5) * 7 + '%' })
    const cards = Array.from({ length: 4 }, (_, i) => ({ r: 2 + Math.floor(r() * 13), s: Math.floor(r() * 4), up: i < 2 || r() > 0.5, rot: (i - 1.5) * (11 + r() * 5) + (r() - 0.5) * 8, dx: (i - 1.5) * 15, dy: (r() - 0.5) * 8 }))
    cards[3].up = false
    return { fan: at(zones[0]), stack: at(zones[1]), dice: at(zones[2]), loose: at(zones[3]), single: at(zones[4]), cards, h: 6 + Math.floor(r() * 4),
      d: [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)], dr: [(r() - 0.5) * 50, (r() - 0.5) * 50], sc: { r: 2 + Math.floor(r() * 13), s: Math.floor(r() * 4), rot: (r() - 0.5) * 50 } }
  }, [seed])
  const Face = ({ c }) => <><b>{rankLabel(c.r)}</b><span>{SUITS[c.s]}</span></>
  return (
    <div className="rail ptrail"><div className="feltprev pt-felt" data-felt={eq.felt}>
      <div className="pt-item" style={L.fan}>{L.cards.map((c, i) => <div key={i} className={'card ptcard' + (c.up ? (c.s === 1 || c.s === 2 ? ' red' : '') : ' back cb-' + eq.cardback)}
        style={{ transform: `translate(${c.dx - 24}px,${c.dy}px) rotate(${c.rot}deg)` }}>{c.up && <Face c={c} />}</div>)}</div>
      <div className="pt-item" style={L.stack}><div className="chipprev chipstack" data-chip={eq.chip}>{Array.from({ length: L.h }, (_, i) => <i key={i} style={{ marginLeft: (i % 2 ? 2 : -2) + 'px' }} />)}</div></div>
      <div className="pt-item" style={L.loose}><div className="chipprev loose" data-chip={eq.chip}><i style={{ left: 0, top: 6 }} /><i style={{ left: 22, top: 0 }} /><i style={{ left: 14, top: 18 }} /></div></div>
      <div className="pt-item ptdice" style={L.dice}><div className="diceprev" data-dice={eq.dice}>{L.d.map((n, i) => <span key={i} style={{ display: 'inline-block', transform: `rotate(${L.dr[i]}deg)`, margin: '0 4px' }}><Die n={n} /></span>)}</div></div>
      <div className="pt-item" style={L.single}><div className={'card ptcard' + (L.sc.s === 1 || L.sc.s === 2 ? ' red' : '')} style={{ transform: `rotate(${L.sc.rot}deg)` }}><Face c={L.sc} /></div></div>
    </div></div>
  )
}

export default function Profile() {
  const { id } = useParams(), nav = useNavigate(), { p, call, rename } = useWallet(), showWin = useWin()
  const own = !id || id === p.id
  const [other, setOther] = useState(null), [err, setErr] = useState(''), [n, setN] = useState(p.name)
  useEffect(() => {
    setOther(null); setErr('')
    if (!own) call('get_public_profile', { p_id: id }).then(r => (r?.error ? setErr(r.error) : setOther(r)))
  }, [id, own, call])
  const d = own ? { name: p.name, eq: p.eq, inv: p.inv, stats: p.stats, peak: p.peak }
    : other && { name: other.name, eq: other.eq, inv: other.inventory || [], peak: Number(other.peak),
      stats: Object.fromEntries((other.stats || []).map(x => [x.game, { rounds: x.rounds, wins: x.wins, best: Number(x.best), won: Number(x.won) }])) }
  if (!d) return <main><h1>Profil</h1><p className="muted">{err || 'Lade Profil …'}</p></main>
  const totalWon = Object.values(d.stats).reduce((a, s) => a + (s.won || 0), 0)
  const eq = { ...p.eq, ...d.eq }
  return (
    <main className="profile">
      {!own && <button className="btn sm ghost" onClick={() => nav(-1)}>Zurück</button>}
      <div className="pf-card"><div className="bgprev pf-banner" data-bg={eq.bg} />
        <div className="pf-head"><Avatar size={96} frame={eq.frame} avatar={eq.avatar} />
          <div className="pf-info"><h1><NameFx name={d.name} fx={eq.namefx} /></h1>
            {own && <form onSubmit={async e => { e.preventDefault(); const b = await rename(n); if (b) { sfx.win('jackpot'); showWin(b, 'jackpot', 'NACHSCHUB') } }}>
              <input value={n} maxLength={16} onChange={e => setN(e.target.value)} aria-label="Spielername" /><button className="btn sm ghost" disabled={!n.trim() || n.trim() === p.name}>Umbenennen</button></form>}
            {own && <p className="wallet inl"><Coin size={26} /><b>{p.coins}</b><small>RC</small></p>}
            <div className="pf-stats"><span>Insgesamt gewonnen <b>{fmt(totalWon)} RC</b></span><span>All-Time-Höchststand <b>{fmt(d.peak)} RC</b></span></div></div></div></div>
      <ProfileTable eq={eq} seed={own ? p.id : id} />
      <h2 className="sec">Ausgerüstet</h2>
      <div className="grid">{Object.entries(TYPES).map(([t, label]) => { const it = ITEMS.find(i => i.type === t && i.val === eq[t])
        return <div key={t} className={'tile eqtile r-' + (it?.rarity || 'common')}><small className="muted">{label}</small><b>{it?.name || '–'}</b>{it?.rarity && <span className={'rar r-' + it.rarity}>{RAR[it.rarity]}</span>}</div> })}</div>
      <h2 className="sec">Sammlung</h2>
      <div className="grid">{Object.entries(TYPES).map(([t, label]) => { const all = ITEMS.filter(i => i.type === t), got = all.filter(i => i.default || d.inv.includes(i.id)).length
        return <div key={t} className="tile eqtile"><small className="muted">{label}</small><b>{got} von {all.length}</b></div> })}</div>
      <h2 className="sec">Statistiken</h2>
      <table className="stats"><thead><tr><th>Spiel</th><th>Runden</th><th>Gewonnen</th><th>Quote</th><th>Bester Gewinn</th></tr></thead><tbody>
        {[...games, { id: 'ranked', name: 'Ranked-Turniere' }].map(g => { const s = d.stats[g.id] || { rounds: 0, wins: 0, best: 0 }
          return <tr key={g.id}><td>{g.name}</td><td>{s.rounds}</td><td>{s.wins}</td><td>{s.rounds ? Math.round(s.wins / s.rounds * 100) + ' %' : '–'}</td><td>{fmt(s.best)} RC</td></tr> })}
      </tbody></table>
    </main>
  )
}
