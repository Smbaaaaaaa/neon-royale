// Royal Coin: geprägte Goldmünze mit Riffelrand, Krone, Lorbeer und Schriftzug ROYALE
const leaf = (th, mirror) => {
  const a = th * Math.PI / 180, r = 64, x = 100 + (mirror ? -1 : 1) * r * Math.sin(a), y = 100 - r * Math.cos(a)
  return { x, y, rot: mirror ? 90 - th : th - 90 }
}
const leaves = Array.from({ length: 8 }, (_, i) => [leaf(100 + i * 10, false), leaf(100 + i * 10, true)]).flat()
export default function Coin({ size = 40, spin = false }) {
  const id = 'cn' + size
  return (
    <svg className={spin ? 'coin spin' : 'coin'} width={size} height={size} viewBox="0 0 200 200" aria-label="Royal Coin">
      <defs>
        <linearGradient id={id + 'r'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b8" /><stop offset=".25" stopColor="#e0b44a" /><stop offset=".5" stopColor="#8a5d0a" /><stop offset=".75" stopColor="#f2d27a" /><stop offset="1" stopColor="#b88a22" /></linearGradient>
        <radialGradient id={id + 'f'} cx=".35" cy=".28" r=".95"><stop offset="0" stopColor="#ffe9a3" /><stop offset=".38" stopColor="#e2b64a" /><stop offset=".72" stopColor="#b3832a" /><stop offset="1" stopColor="#7a5208" /></radialGradient>
        <linearGradient id={id + 't'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6c8" /><stop offset=".5" stopColor="#d9a93a" /><stop offset="1" stopColor="#8a5d0a" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="#4a3205" />
      <circle cx="100" cy="100" r="96" fill={`url(#${id}r)`} />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#fff6c8" strokeOpacity=".6" strokeWidth="5" strokeDasharray="1.6 3.1" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#4a3205" strokeOpacity=".35" strokeWidth="5" strokeDasharray="1.6 3.1" strokeDashoffset="2.3" />
      <circle cx="100" cy="100" r="86" fill={`url(#${id}f)`} stroke="#6b4a08" strokeWidth="1.6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#fff1b8" strokeOpacity=".65" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="77" fill="none" stroke="#6b4a08" strokeOpacity=".8" strokeWidth="1" />
      {leaves.map((l, i) => <ellipse key={i} cx={l.x} cy={l.y} rx="3.8" ry="8.6" transform={`rotate(${l.rot} ${l.x} ${l.y})`} fill="#c99a30" stroke="#6b4a08" strokeWidth=".8" />)}
      <path d="M66 76L62 50L80 62L100 38L120 62L138 50L134 76Z" fill={`url(#${id}t)`} stroke="#4a3205" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="66" y="72" width="68" height="9" rx="2" fill={`url(#${id}t)`} stroke="#4a3205" strokeWidth="1.4" />
      {[[62, 50], [100, 38], [138, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.2" fill="#fff1b8" stroke="#4a3205" strokeWidth="1.2" />)}
      <circle cx="100" cy="76.5" r="3.2" fill="#b3202e" stroke="#fff1b8" strokeWidth=".8" />
      <text x="100" y="112" textAnchor="middle" fontFamily="Fraunces,serif" fontWeight="800" fontSize="25" letterSpacing="2" fill={`url(#${id}t)`} stroke="#4a3205" strokeWidth="1" paintOrder="stroke">ROYALE</text>
      <path d="M72 122H92M108 122H128" stroke="#4a3205" strokeWidth="1.3" /><path d="M100 118L104 122L100 126L96 122Z" fill="#4a3205" />
      <text x="100" y="140" textAnchor="middle" fontFamily="Outfit,sans-serif" fontWeight="700" fontSize="11" letterSpacing="5" fill="#4a3205" opacity=".85">COIN</text>
      <ellipse cx="66" cy="50" rx="46" ry="20" fill="#fff" opacity=".2" transform="rotate(-28 66 50)" />
      <path d="M30 70A74 74 0 0 1 90 28" stroke="#fff" strokeOpacity=".5" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
