import { useEffect, useRef, useState } from 'react'
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
const BOXES = {
  normal: { title: 'Mystery Box', cost: 2500, odds: [['common', 55], ['rare', 28], ['epic', 11], ['legendary', 5], ['mythic', 1]], desc: 'Ein zufälliges Item aus allen Kategorien. Die Toxic Collection ist nicht enthalten.' },
  toxic: { title: 'Toxic Box', cost: 20000, odds: [['epic', 60], ['legendary', 28], ['mythic', 12]], desc: 'Nur Items der Toxic Collection: die Horror-Clown-Profilbilder und die mythischen Designs.', toxic: true },
}
const RC = { common: '#8a8a92', rare: '#c9ccd2', epic: '#b4384c', legendary: '#c9a24a', mythic: '#f3f1ea' }
const CHARGE = { common: 2200, rare: 2600, epic: 3200, legendary: 4000, mythic: 5000 }
const SPARKS = { common: 18, rare: 28, epic: 44, legendary: 70, mythic: 110 }
const sparksOf = n => Array.from({ length: n }, () => { const a = Math.random() * 6.283, d = 20 + Math.random() * 55
  return { '--x': Math.cos(a) * d + 'vmin', '--y': Math.sin(a) * d * 0.8 + 'vmin', '--sz': 5 + Math.random() * 12 + 'px', '--d': Math.random() * 0.4 + 's' } })
const BoxSvg = ({ toxic, cls, style }) => (
  <svg className={cls} style={style} viewBox="0 0 100 100" aria-hidden="true">
    <g className="lid"><path d="M10 28H90V42H10Z" fill={toxic ? '#2a0a12' : '#202025'} stroke={toxic ? '#8a1220' : '#c9ccd2'} strokeWidth="2" /><path d="M46 28H54V42H46Z" fill={toxic ? '#8a1220' : '#8d9199'} /></g>
    <path d="M14 42H86V88H14Z" fill={toxic ? '#140508' : '#17171b'} stroke={toxic ? '#8a1220' : '#aeb2b9'} strokeWidth="2" /><path d="M46 42H54V88H46Z" fill={toxic ? '#8a1220' : '#8d9199'} />
    <text x="50" y="72" textAnchor="middle" fontSize="26" fontFamily="Fraunces,serif" fontWeight="800" fill={toxic ? '#e9e0cc' : '#e7e9ec'}>?</text>
  </svg>
)
function MysteryBox({ kind }) {
  const cfg = BOXES[kind], { p, call, refresh } = useWallet(), [st, setSt] = useState(null), timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const close = () => { timers.current.forEach(clearTimeout); timers.current = []; setSt(null) }
  const open = async () => {
    sfx.unlock(); sfx.chip(); setSt({ phase: 'charge', glow: RC.common, amp: 1 })
    const t0 = Date.now(), r = await call('open_mystery_box', { p_kind: kind })
    if (r?.error) { setSt({ phase: 'error', msg: r.error }); return }
    const left = Math.max(900, CHARGE[r.rarity] - (Date.now() - t0)), steps = Math.max(6, Math.floor(left / 300))
    sfx.charge(left)
    // Spannung: Die Farbe wechselt durch alle Stufen, wird langsamer und rastet beim Ergebnis ein
    for (let i = 0; i < steps; i++) later(() => setSt(s => (s?.phase === 'charge' ? { ...s, glow: RC[RARITY[i % 5]], amp: i > steps * 0.6 ? 2 : 1 } : s)), left * 0.85 * (i / steps) ** 2)
    later(() => setSt(s => (s?.phase === 'charge' ? { ...s, glow: RC[r.rarity], amp: 3 } : s)), left * 0.88)
    later(() => { sfx.reveal(r.rarity); setSt({ phase: 'burst', r, sp: sparksOf(SPARKS[r.rarity]) }) }, left)
    later(() => { refresh(); setSt(s => (s ? { ...s, phase: 'reveal' } : s)) }, left + 800)
  }
  const again = () => { close(); later(open, 80) }
  const it = st?.r && ITEMS.find(i => i.id === st.r.item), rar = st?.r?.rarity
  const charging = st?.phase === 'charge', color = st?.r ? RC[rar] : st?.glow
  return (
    <section className={'tile big mbox-tile' + (cfg.toxic ? ' toxic-box' : '')}>
      <BoxSvg toxic={cfg.toxic} cls="mbox-ico" />
      <div><h2>{cfg.title}</h2><p>{cfg.desc} Chancen: {cfg.odds.map(([r, c]) => `${RAR[r]} ${c} %`).join(', ')}. Besitzt du alles einer Stufe, bekommst du 30 % des Preises zurück.</p></div>
      <button className="btn" disabled={p.coins < cfg.cost || !!st} onClick={open}>Öffnen, {fmt(cfg.cost)} NC</button>
      {st && <div className={'mbox-overlay' + (st.phase === 'burst' && ['epic', 'legendary', 'mythic'].includes(rar) ? ' mquake' : '')} style={{ '--rc': color }} role="dialog" aria-label={cfg.title}>
        {(st.phase === 'burst' || st.phase === 'reveal') && <><div className="mrays" />{st.phase === 'burst' && <div className="mflash" />}{st.sp.map((sp, k) => <i key={k} className="msp" style={sp} />)}</>}
        {(charging || st.phase === 'burst') && <BoxSvg toxic={cfg.toxic} cls={'mbox-big ' + (charging ? 'shake' + st.amp : 'opened')} style={{ filter: `drop-shadow(0 0 ${charging ? 14 + st.amp * 14 : 56}px ${color})` }} />}
        {charging && <p className="muted">Die Box wird geöffnet …</p>}
        {st.phase === 'error' && <><p>{st.msg}</p><button className="btn" onClick={close}>Schließen</button></>}
        {st.phase === 'reveal' && it && <div className={'mbox-result r-' + rar}><div className="mbox-rar">{RAR[rar].toUpperCase()}{rar === 'mythic' ? '!' : ''}</div><Preview it={it} /><h2>{it.name}</h2><p className="muted">{TYPES[it.type]}</p>
          <p>{st.r.duplicate ? `Schon vorhanden. Du bekommst ${fmt(st.r.refund)} NC zurück.` : 'Neu in deinem Inventar!'}</p>
          <div className="row center"><button className="btn" onClick={close}>Weiter</button><button className="btn ghost" disabled={p.coins < cfg.cost} onClick={again}>Nochmal, {fmt(cfg.cost)} NC</button></div></div>}
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
      <MysteryBox kind="normal" />
      <MysteryBox kind="toxic" />
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
