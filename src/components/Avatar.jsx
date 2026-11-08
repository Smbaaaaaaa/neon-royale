import { useWallet } from '../context/Wallet.jsx'
import { ART } from './avatarArt.jsx'
export default function Avatar({ size = 44, frame, avatar }) {
  const { p } = useWallet()
  const Art = ART[avatar ?? p.eq.avatar] || ART['ace-of-spades']
  return <div className={'avatar frame-' + (frame ?? p.eq.frame)} style={{ '--s': size + 'px' }}><Art /></div>
}
