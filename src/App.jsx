import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { applyTheme } from './theme.js'
import { useWallet } from './context/Wallet.jsx'
import { games } from './games/registry.js'
import Nav from './components/Nav.jsx'
import Coin from './components/Coin.jsx'
import Avatar from './components/Avatar.jsx'
import Slots from './components/Slots.jsx'
import Roulette from './components/Roulette.jsx'
import { Shop, Inventory, Profile } from './components/Pages.jsx'
import Entrance from './components/Entrance.jsx'
import Blackjack from './components/Blackjack.jsx'
import VideoPoker from './components/VideoPoker.jsx'
import Multiplayer from './components/Multiplayer.jsx'
import Leaderboard from './components/Leaderboard.jsx'

function Welcome() {
  const { createGuest, error } = useWallet(); const [n, setN] = useState(''), [busy, setBusy] = useState(false)
  return (
    <main className="welcome">
      <Coin size={120} spin /><h1>NEON ROYALE</h1>
      <p>Wähle einen Spielernamen und starte mit 50 Neon Coins. Im Item-Shop wartet ein Starter-Bonus von 10.000 NC. Neon Coins sind reine Spielwährung ohne Echtgeldwert.</p>
      <form onSubmit={e => { e.preventDefault(); if (n.trim().length >= 2) { setBusy(true); createGuest(n).finally(() => setBusy(false)) } }}>
        <input value={n} onChange={e => setN(e.target.value)} maxLength={16} placeholder="Spielername" aria-label="Spielername" />
        <button className="btn" disabled={busy || n.trim().length < 2}>{busy ? 'Verbinde …' : 'Als Gast starten'}</button>{error && <p className="muted" style={{ flexBasis: '100%' }}>{error}</p>}
      </form>
    </main>
  )
}
const GameGrid = () => <section className="grid">{games.map(g => (
  <Link key={g.id} to={g.path} className={'tile link' + (g.featured ? ' big' : '')}><h2>{g.name}</h2><p>{g.blurb}</p><span className="tag">Jetzt spielen</span></Link>))}</section>

function Lobby() {
  const { p, claimDaily, dailyReady, DAILY, claimRescue, rescueReady, RESCUE } = useWallet()
  return (
    <main>
      <section className="hero">
        <div><div className="row"><Avatar size={64} /><h1>Willkommen, {p.name}</h1></div>
          <p>Wähle bei jedem Spiel deinen Einsatz von 2 bis 50 NC. Dein Gewinn wächst mit. Den Starter-Bonus findest du im Item-Shop.</p>
          <div className="row">
            <Link to="/spiele/slots" className="btn" style={{ textDecoration: 'none' }}>Slot Machine spielen</Link>
            <button className="btn ghost" onClick={claimDaily} disabled={!dailyReady}>{dailyReady ? `Tagesbonus: ${DAILY} NC holen` : 'Tagesbonus abgeholt'}</button>
            {rescueReady && <button className="btn ghost" onClick={claimRescue}>Nachschub: {RESCUE} NC</button>}
          </div></div>
        <Coin size={180} spin />
      </section>
      <GameGrid />
    </main>
  )
}
const Maint = ({ title }) => <main><h1>{title}</h1><p className="muted">Wird gerade auf den Server umgestellt, damit niemand schummeln kann. Kommt im nächsten Schritt zurück.</p></main>
const Soon = ({ title, phase }) => <main><h1>{title}</h1><p className="muted">Dieser Bereich wird in Phase {phase} umgesetzt.</p></main>

export default function App() {
  const { p, ready } = useWallet()
  useEffect(() => { if (p) applyTheme(p.eq) }, [p?.eq?.bg, p?.eq?.accent])
  if (!ready) return <main className="welcome"><Coin size={90} spin /></main>
  if (!p) return <Welcome />
  return (<>
    <Nav />
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/spiele" element={<main><h1>Spiele</h1><GameGrid /></main>} />
      <Route path="/spiele/slots" element={<Entrance key="slots"><Slots /></Entrance>} />
      <Route path="/spiele/roulette" element={<Entrance key="roulette"><Roulette /></Entrance>} />
      <Route path="/spiele/blackjack" element={<Entrance key="blackjack"><Blackjack /></Entrance>} />
      <Route path="/spiele/poker" element={<Entrance key="poker"><VideoPoker /></Entrance>} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/inventar" element={<Inventory />} />
      <Route path="/multiplayer" element={<Multiplayer />} />
      <Route path="/rangliste" element={<Leaderboard />} />
      <Route path="/profil" element={<Profile />} />
    </Routes>
  </>)
}
