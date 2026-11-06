import { glyphOf } from '../games/items.js'
import { useWallet } from '../context/Wallet.jsx'
export default function Avatar({ size = 44, frame, avatar }) {
  const { p } = useWallet()
  return <div className={'avatar frame-' + (frame ?? p.eq.frame)} style={{ '--s': size + 'px' }}>{glyphOf(avatar ?? p.eq.avatar)}</div>
}
