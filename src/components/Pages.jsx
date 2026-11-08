import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { ITEMS, TYPES, RAR, RARITY, ACCENTS } from '../games/items.js'
import { games } from '../games/registry.js'
import { sfx } from '../audio.js'
import Coin from './Coin.jsx'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
import { useWin } from './WinBanner.jsx'
const fmt = n => Number(n).toLocaleString('de-DE')
function Preview({ it }) {
  switch (it.type) {
    case 'avatar': return <Avatar size={64} frame="silverline" avatar={it.val} />
    case 'frame': return <Avatar size={64} frame={it.val} avatar="ace-of-spades" />
    case 'bg': return <div className="bgprev" data-bg={it.val} />
    case 'accent': return <div className="accsw" style={{ background: ACCENTS[it.val] }} />
    case 'cardback': return <div className={'cbprev back cb-' + it.val} />
    case 'felt': return <div className="feltprev" data-felt={it.val} />
    case 'chip': return <div className="chipprev" data-chip={it.val}>10</div>
    default: return <NameFx name="Spielername" fx={it.val} />
  }
}
const Price = ({ n }) => <span className="price"><Coin size={18} />{fmt(n)}</span>
const Badge = ({ r }) => <span className={'rar r-' + r}>{RAR[r]}</span>
const sorted = l => [...l].sort((a, b) => RARITY.indexOf(a.rarity) - RARITY.indexOf(b.rarity) || a.price - b.price)

export function Shop() {
  const { p, buy } = useWallet(); const showWin = useWin(); const [tab, setTab] = useState('avatar')
  const starter = ITEMS[0], got = p.inv.includes('starter3'), list = ITEMS.filter(i => i.type === tab && !i.default)
  return (
    <main><h1>Item-Shop</h1>
      <section className="tile big starter">
        <Coin size={64} spin /><div><h2>{starter.name}</h2><p>{starter.desc}. Einmal pro Konto.</p></div>
        <button className="btn" disabled={got} onClick={async () => { if (await buy('starter3')) { sfx.win('jackpot'); showWin(starter.bonus, 'jackpot', 'STARTER-BONUS') } }}>{got ? 'Eingelöst' : '10.000 NC abholen'}</button>
      </section>
      <div className="tabs" role="tablist">{Object.entries(TYPES).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {RARITY.map(r => {
        const g = sorted(list.filter(i => i.rarity === r)); if (!g.length) return null
        const owned = g.filter(i => p.inv.includes(i.id)).length
        return (
          <details key={tab + r} className={'rgroup r-' + r}>
            <summary><Badge r={r} /><span>{g.length} Items · {fmt(g[0].price)} NC</span><span className="muted">{owned} von {g.length} im Besitz</span></summary>
            <div className="grid">{g.map(it => {
              const own = p.inv.includes(it.id)
              return <article key={it.id} className={'tile item r-' + it.rarity}><Preview it={it} /><h2>{it.name}</h2>
                {own ? <span className="tag">Im Inventar</span> : <Price n={it.price} />}
                <button className="btn sm" disabled={own || p.coins < it.price} onClick={async () => { (await buy(it.id)) && sfx.win('small') }}>{own ? 'Gekauft' : p.coins < it.price ? 'Zu wenig NC' : 'Kaufen'}</button></article>
            })}</div>
          </details>)
      })}
      <p className="muted">Tippe auf eine Seltenheitsstufe, um die Items zu sehen. Weitere Kategorien folgen: Würfel und Animationen. Neon Coins sind reine Spielwährung ohne Echtgeldwert.</p>
    </main>
  )
}
export function Inventory() {
  const { p, equip } = useWallet()
  return (
    <main><h1>Inventar</h1>
      {Object.entries(TYPES).map(([t, label]) => {
        const mine = sorted(ITEMS.filter(i => i.type === t && (i.default || p.inv.includes(i.id))))
        return (
          <details key={t} className="rgroup">
            <summary><b>{label}</b><span className="muted">{mine.length} im Besitz</span></summary>
            <div className="grid">{mine.map(it => {
              const on = p.eq[t] === it.val
              return <article key={it.id} className={'tile item r-' + it.rarity + (on ? ' on' : '')}><Preview it={it} /><h2>{it.name}</h2><Badge r={it.rarity} />
                <button className="btn sm ghost" disabled={on} onClick={() => equip(t, it.val)}>{on ? 'Ausgerüstet' : 'Ausrüsten'}</button></article>
            })}</div>
          </details>)
      })}
    </main>
  )
}
export function Profile() {
  const { p, rename } = useWallet(); const showWin = useWin(); const [n, setN] = useState(p.name)
  return (
    <main><div className="prof"><Avatar size={96} />
      <div><form onSubmit={async e => { e.preventDefault(); const b = await rename(n); if (b) { sfx.win('jackpot'); showWin(b, 'jackpot', 'NACHSCHUB') } }}><input value={n} maxLength={16} onChange={e => setN(e.target.value)} aria-label="Spielername" />
        <button className="btn sm ghost" disabled={!n.trim() || n.trim() === p.name}>Umbenennen</button></form>
        <p className="wallet inl"><Coin size={26} /><b>{p.coins}</b><small>NC</small></p>
        <p className="muted">{p.inv.filter(i => i !== 'starter3').length} Items freigeschaltet</p></div></div>
      <h2 className="sec">Statistiken</h2>
      <table className="stats"><thead><tr><th>Spiel</th><th>Runden</th><th>Gewonnen</th><th>Quote</th><th>Bester Gewinn</th></tr></thead><tbody>
        {games.map(g => { const s = p.stats[g.id] || { rounds: 0, wins: 0, best: 0 }
          return <tr key={g.id}><td>{g.name}</td><td>{s.rounds}</td><td>{s.wins}</td><td>{s.rounds ? Math.round(s.wins / s.rounds * 100) + ' %' : '–'}</td><td>{s.best} NC</td></tr> })}
      </tbody></table>
    </main>
  )
}
