import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { ITEMS, TYPES, RAR, RARITY, ACCENTS } from '../games/items.js'
import { games } from '../games/registry.js'
import { sfx } from '../audio.js'
import Coin from './Coin.jsx'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
import { useWin } from './WinBanner.jsx'
import { Die } from './TableDice.jsx'
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
    case 'dice': return <div className="diceprev" data-dice={it.val}><Die n={5} /></div>
    case 'anim': return <div className={'animprev ap-' + it.val}><span className="mc big"><b>A</b><span>♠</span></span><span className="mc big red"><b>K</b><span>♥</span></span><span className="pbet pstatic"><i /></span></div>
    default: return <NameFx name="Spielername" fx={it.val} />
  }
}
const Price = ({ n }) => <span className="price"><Coin size={18} />{fmt(n)}</span>
const Badge = ({ r }) => <span className={'rar r-' + r}>{RAR[r]}</span>
const MYSTERY = { cost: 2500, odds: [['common', 55], ['rare', 28], ['epic', 11], ['legendary', 5], ['mythic', 1]] }
function MysteryBox() {
  const { p, call, refresh } = useWallet(); const [st, setSt] = useState(null)
  const open = async () => {
    sfx.unlock(); sfx.chip(); setSt({ phase: 'shake' })
    const [r] = await Promise.all([call('open_mystery_box'), new Promise(res => setTimeout(res, 1500))])
    if (r?.error) { setSt({ phase: 'error', msg: r.error }); return }
    sfx.win({ common: 'small', rare: 'small', epic: 'big', legendary: 'big', mythic: 'jackpot' }[r.rarity]); refresh(); setSt({ phase: 'result', r })
  }
  const it = st?.r && ITEMS.find(i => i.id === st.r.item)
  return (
    <section className="tile big mbox-tile">
      <svg className="mbox-ico" viewBox="0 0 100 100" aria-hidden="true"><path d="M14 40H86V86H14Z" fill="#17171b" stroke="#aeb2b9" strokeWidth="2" /><path d="M10 28H90V42H10Z" fill="#202025" stroke="#c9ccd2" strokeWidth="2" /><path d="M46 28H54V86H46Z" fill="#8d9199" /><text x="50" y="72" textAnchor="middle" fontSize="26" fontFamily="Fraunces,serif" fontWeight="800" fill="#e7e9ec">?</text></svg>
      <div><h2>Mystery Box</h2>
        <p>Ein zufälliges Item aus allen Kategorien. Chancen: {MYSTERY.odds.map(([r, c]) => `${RAR[r]} ${c} %`).join(', ')}. Die Toxic Collection ist nicht enthalten. Ist eine Stufe komplett in deinem Besitz, bekommst du 30 % des Preises zurück.</p></div>
      <button className="btn" disabled={p.coins < MYSTERY.cost || !!st} onClick={open}>Öffnen, {fmt(MYSTERY.cost)} NC</button>
      {st && <div className="mbox-overlay" role="dialog" aria-label="Mystery Box">
        {st.phase === 'shake' && <><svg className="mbox-big shake" viewBox="0 0 100 100"><path d="M14 40H86V86H14Z" fill="#17171b" stroke="#aeb2b9" strokeWidth="2" /><path d="M10 28H90V42H10Z" fill="#202025" stroke="#c9ccd2" strokeWidth="2" /><path d="M46 28H54V86H46Z" fill="#8d9199" /><text x="50" y="72" textAnchor="middle" fontSize="26" fontFamily="Fraunces,serif" fontWeight="800" fill="#e7e9ec">?</text></svg><p>Die Box wird geöffnet …</p></>}
        {st.phase === 'error' && <><p>{st.msg}</p><button className="btn" onClick={() => setSt(null)}>Schließen</button></>}
        {st.phase === 'result' && it && <div className={'mbox-result r-' + it.rarity}><Badge r={it.rarity} /><Preview it={it} /><h2>{it.name}</h2><p className="muted">{TYPES[it.type]}</p>
          <p>{st.r.duplicate ? `Schon vorhanden. Du bekommst ${fmt(st.r.refund)} NC zurück.` : 'Neu in deinem Inventar!'}</p><button className="btn" onClick={() => setSt(null)}>Weiter</button></div>}
      </div>}
    </section>
  )
}
const sorted = l => [...l].sort((a, b) => RARITY.indexOf(a.rarity) - RARITY.indexOf(b.rarity) || a.price - b.price)

export function Shop() {
  const { p, buy } = useWallet(); const showWin = useWin()
  const [tab, setTab] = useState('avatar'), [view, setView] = useState('shop')
  const bonuses = ITEMS.filter(i => i.type === 'bonus')
  const list = ITEMS.filter(i => i.type === tab && !i.default && !i.collection)
  const toxic = sorted(ITEMS.filter(i => i.collection === 'toxic'))
  const card = it => {
    const own = p.inv.includes(it.id)
    return <article key={it.id} className={'tile item r-' + it.rarity + (it.collection ? ' toxic' : '')}><Preview it={it} /><h2>{it.name}</h2>
      {it.collection && <span className="muted">{TYPES[it.type]}</span>}<Badge r={it.rarity} />
      {own ? <span className="tag">Im Inventar</span> : <Price n={it.price} />}
      <button className="btn sm" disabled={own || p.coins < it.price} onClick={async () => { (await buy(it.id)) && sfx.win('small') }}>{own ? 'Gekauft' : p.coins < it.price ? 'Zu wenig NC' : 'Kaufen'}</button></article>
  }
  return (
    <main><h1>Item-Shop</h1>
      {bonuses.map(b => { const got = p.inv.includes(b.id); return (
        <section key={b.id} className="tile big starter">
          <Coin size={64} spin /><div><h2>{b.id === 'starter3' ? 'Starter-Bonus' : 'Bonus'}</h2><p>{b.desc}. Einmal pro Konto.</p></div>
          <button className="btn" disabled={got} onClick={async () => { if (await buy(b.id)) { sfx.win('jackpot'); showWin(b.bonus, 'jackpot', b.id === 'starter3' ? 'STARTER-BONUS' : 'BONUS') } }}>{got ? 'Eingelöst' : `${fmt(b.bonus)} NC abholen`}</button>
        </section>) })}
      <MysteryBox />
      <div className="views"><button className={view === 'shop' ? 'on' : ''} onClick={() => setView('shop')}>Kategorien</button>
        <button className={'tox' + (view === 'toxic' ? ' on' : '')} onClick={() => setView('toxic')}>Toxic Collection</button></div>
      {view === 'toxic' ? (
        <section className="toxic-head"><h2>Toxic Collection</h2>
          <p>Eine eigene Kollektion im Horror-Clown-Stil: vier Profilbilder und für jede Kategorie ein einziges mythisches Design.</p>
          <div className="grid">{toxic.map(card)}</div></section>
      ) : <>
        <div className="tabs" role="tablist">{Object.entries(TYPES).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {RARITY.map(r => {
          const g = sorted(list.filter(i => i.rarity === r)); if (!g.length) return null
          const owned = g.filter(i => p.inv.includes(i.id)).length
          return (
            <details key={tab + r} className={'rgroup r-' + r}>
              <summary><Badge r={r} /><span>{g.length} Items · {fmt(g[0].price)} NC</span><span className="muted">{owned} von {g.length} im Besitz</span></summary>
              <div className="grid">{g.map(card)}</div>
            </details>)
        })}
        <p className="muted">Tippe auf eine Seltenheitsstufe, um die Items zu sehen. Neon Coins sind reine Spielwährung ohne Echtgeldwert.</p>
      </>}
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
              return <article key={it.id} className={'tile item r-' + it.rarity + (on ? ' on' : '')}><Preview it={it} /><h2>{it.name}</h2><Badge r={it.rarity} />{it.collection && <span className="tag">Toxic</span>}
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
        <p className="muted">{p.inv.filter(i => !['starter3', 'bonus-15k'].includes(i)).length} Items freigeschaltet</p></div></div>
      <h2 className="sec">Statistiken</h2>
      <table className="stats"><thead><tr><th>Spiel</th><th>Runden</th><th>Gewonnen</th><th>Quote</th><th>Bester Gewinn</th></tr></thead><tbody>
        {games.map(g => { const s = p.stats[g.id] || { rounds: 0, wins: 0, best: 0 }
          return <tr key={g.id}><td>{g.name}</td><td>{s.rounds}</td><td>{s.wins}</td><td>{s.rounds ? Math.round(s.wins / s.rounds * 100) + ' %' : '–'}</td><td>{s.best} NC</td></tr> })}
      </tbody></table>
    </main>
  )
}
