// Neon-Münze als SVG, nachempfunden der Referenz: Goldverlauf, Perlrand, Lorbeer, Lilie.
const leaves = Array.from({ length: 9 }, (_, i) => -100 + i * 25)
export default function Coin({ size = 40, spin = false }) {
  const id = 'c' + size
  return (
    <svg className={spin ? 'coin spin' : 'coin'} width={size} height={size} viewBox="0 0 200 200" aria-label="Neon Coin">
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe08a"/><stop offset=".55" stopColor="#d9a21f"/><stop offset="1" stopColor="#8a5d0a"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="#7a5208"/>
      <circle cx="100" cy="100" r="95" fill={`url(#${id})`}/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="#fff0a8" strokeOpacity=".7" strokeWidth="4" strokeDasharray="1.2 3.2" strokeLinecap="round"/>
      <circle cx="100" cy="100" r="80" fill="none" stroke="#8a5d0a" strokeWidth="1.5"/>
      {leaves.map(a => (
        <ellipse key={a} cx="100" cy="30" rx="4.5" ry="11" fill="#b98512" stroke="#ffe08a" strokeWidth=".8"
          transform={`rotate(${a + 180} 100 100)`} opacity=".9"/>
      ))}
      <text x="100" y="116" textAnchor="middle" fontFamily="Fraunces,serif" fontWeight="800" fontSize="44"
        fill="#c18a14" stroke="#7a5208" strokeWidth=".8">NEON</text>
      <path d="M100 148 l6 8 -6 9 -6 -9z" fill="#b98512" stroke="#ffe08a" strokeWidth=".8"/>
    </svg>
  )
}
