import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { ITEMS, TYPES, glyphOf } from '../games/items.js'
import { games } from '../games/registry.js'
import { sfx } from '../audio.js'
import Coin from './Coin.jsx'
import { useWin } from './WinBanner.jsx'
import Avatar from './Avatar.jsx'
const Preview = ({ it }) => it.type === 'frame' ? <Avatar size={56} frame={it.val} avatar="default" /> : it.type === 'avatar'
  ? <Avatar size={56} frame="none" avatar={it.val} /> : <div className={'swatch skin-' + it.val} />
const Price = ({ n }) => <span className="price"><Coin size={18} />{n}</span>

export function Shop() {
  const { p, buy } = useWallet(); const showWin = useWin(); const [tab, setTab] = useState('frame')
  const starter = ITEMS[0], got = p.inv.includes('starter3')
  return (
    <main><h1>Item-Shop</h1>
      <section className="tile big starter">
        <Coin size={64} spin /><div><h2>{starter.name}</h2><p>{starter.desc}. Einmal pro Konto.</p></div>
        <button className="btn" disabled={got} onClick={async () => { if (await buy('starter3')) { sfx.win('jackpot'); showWin(starter.bonus, 'jackpot', 'STARTER-BONUS') } }}>{got ? 'Eingelöst' : '10.000 NC abholen'}</button>
      </section>
      <div className="tabs" role="tablist">{Object.entries(TYPES).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="grid">{ITEMS.filter(i => i.type === tab && !i.default).map(it => {
        const own = p.inv.includes(it.id)
        return <article key={it.id} className="tile item"><Preview it={it} /><h2>{it.name}</h2>
          {own ? <span className="tag">Im Inventar</span> : <Price n={it.price} />}
          <button className="btn sm" disabled={own || p.coins < it.price} onClick={async () => { (await buy(it.id)) && sfx.win('small') }}>{own ? 'Gekauft' : p.coins < it.price ? 'Zu wenig NC' : 'Kaufen'}</button></article>
      })}</div>
      <p className="muted">Neon Coins sind reine Spielwährung ohne Echtgeldwert und nur für kosmetische Items.</p>
    </main>
  )
}
export function Inventory() {
  const { p, equip } = useWallet()
  const mine = ITEMS.filter(i => i.type !== 'bonus' && (i.default || p.inv.includes(i.id)))
  return (
    <main><h1>Inventar</h1>
      {Object.entries(TYPES).map(([t, label]) => <section key={t}><h2 className="sec">{label}</h2>
        <div className="grid">{mine.filter(i => i.type === t).map(it => {
          const on = p.eq[t] === it.val
          return <article key={it.id} className={'tile item' + (on ? ' on' : '')}><Preview it={it} /><h2>{it.name}</h2>
            <button className="btn sm ghost" disabled={on} onClick={() => equip(t, it.val)}>{on ? 'Ausgerüstet' : 'Ausrüsten'}</button></article>
        })}</div></section>)}
      <p className="muted">Automaten-Skins siehst du an der Slot Machine, Avatar und Rahmen in Lobby und Profil.</p>
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
