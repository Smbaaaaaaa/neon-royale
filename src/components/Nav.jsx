import { NavLink } from 'react-router-dom'
import { useWallet } from '../context/Wallet.jsx'
import Coin from './Coin.jsx'
import Logo from './Logo.jsx'
import SoundControl from './SoundControl.jsx'
export const routes = [
  ['/', 'Lobby'], ['/spiele', 'Spiele'], ['/shop', 'Item-Shop'], ['/inventar', 'Inventar'],
  ['/multiplayer', 'Multiplayer'], ['/rangliste', 'Rangliste'], ['/profil', 'Profil'],
]
export default function Nav() {
  const { p } = useWallet()
  return (
    <header className="nav">
      <NavLink to="/" className="logo"><Logo /></NavLink>
      <nav aria-label="Hauptnavigation">
        {routes.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
      <SoundControl />
      {p && <div className="wallet" title="Royal Coins, reine Spielwährung ohne Echtgeldwert">
        <Coin size={26} /><b>{p.coins}</b><small>RC</small></div>}
    </header>
  )
}
