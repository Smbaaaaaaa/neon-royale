import { NavLink } from 'react-router-dom'
import { useWallet } from '../context/Wallet.jsx'
import Coin from './Coin.jsx'
export const routes = [
  ['/', 'Lobby'], ['/spiele', 'Spiele'], ['/shop', 'Item-Shop'], ['/inventar', 'Inventar'],
  ['/multiplayer', 'Multiplayer'], ['/rangliste', 'Rangliste'], ['/profil', 'Profil'],
]
export default function Nav() {
  const { p } = useWallet()
  return (
    <header className="nav">
      <NavLink to="/" className="logo">NEON <span>ROYALE</span></NavLink>
      <nav aria-label="Hauptnavigation">
        {routes.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
      {p && <div className="wallet" title="Neon Coins, reine Spielwährung ohne Echtgeldwert">
        <Coin size={26} /><b>{p.coins}</b><small>NC</small></div>}
    </header>
  )
}
