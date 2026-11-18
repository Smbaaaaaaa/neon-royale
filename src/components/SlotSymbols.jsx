// Slot-Symbole als detaillierte Retro-Vektorgrafiken (gold, glänzend, silbern)
export const SlotDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <radialGradient id="sy-cherry" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ff9a9a" /><stop offset=".35" stopColor="#d4141f" /><stop offset="1" stopColor="#5e0510" /></radialGradient>
    <radialGradient id="sy-lemon" cx=".35" cy=".3" r=".9"><stop offset="0" stopColor="#fffbb8" /><stop offset=".5" stopColor="#f5d21c" /><stop offset="1" stopColor="#b88a00" /></radialGradient>
    <linearGradient id="sy-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6c0" /><stop offset=".3" stopColor="#f0c64a" /><stop offset=".6" stopColor="#b8861f" /><stop offset="1" stopColor="#f8e08c" /></linearGradient>
    <linearGradient id="sy-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".4" stopColor="#aeb3bb" /><stop offset=".6" stopColor="#eef0f3" /><stop offset="1" stopColor="#8c929b" /></linearGradient>
    <linearGradient id="sy-seven" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7b6e" /><stop offset=".5" stopColor="#d0121f" /><stop offset="1" stopColor="#7a0710" /></linearGradient>
    <linearGradient id="sy-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9f3ff" /><stop offset=".4" stopColor="#3aa0e8" /><stop offset="1" stopColor="#12408a" /></linearGradient>
    <linearGradient id="sy-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fd44a" /><stop offset="1" stopColor="#2c6e18" /></linearGradient>
  </defs></svg>
)
const T = { cherry: 'Kirsche', lemon: 'Zitrone', bell: 'Glocke', bar: 'BAR', seven: 'Sieben', diamond: 'Diamant' }
export function Sym({ s }) {
  return (
    <div className={'sym s-' + s} aria-label={T[s]}>
      <svg viewBox="0 0 100 100">
        {s === 'cherry' && <>
          <path d="M50 22C44 40 40 52 36 60M50 22C56 36 62 48 64 58" stroke="#3f6b1d" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path d="M50 22C58 8 76 8 84 16C74 26 60 28 50 22Z" fill="url(#sy-leaf)" stroke="#1f4a10" strokeWidth="1.2" /><path d="M52 21C62 15 72 14 80 15" stroke="#1f4a10" strokeWidth=".9" fill="none" />
          <circle cx="34" cy="68" r="19" fill="url(#sy-cherry)" stroke="#4a0610" strokeWidth="1.6" /><circle cx="66" cy="64" r="19" fill="url(#sy-cherry)" stroke="#4a0610" strokeWidth="1.6" />
          <ellipse cx="27" cy="60" rx="5.5" ry="3.4" fill="#fff" opacity=".75" transform="rotate(-35 27 60)" /><ellipse cx="59" cy="56" rx="5.5" ry="3.4" fill="#fff" opacity=".75" transform="rotate(-35 59 56)" />
        </>}
        {s === 'lemon' && <>
          <g transform="rotate(-18 50 54)"><path d="M12 54C12 38 30 26 50 26C70 26 88 38 88 54C88 70 70 82 50 82C30 82 12 70 12 54Z" fill="url(#sy-lemon)" stroke="#8a6a00" strokeWidth="2" />
            <path d="M6 54H14M86 54H94" stroke="#b88a00" strokeWidth="5.5" strokeLinecap="round" /><ellipse cx="38" cy="42" rx="15" ry="6" fill="#fff" opacity=".55" />
            {[[58, 60], [68, 52], [48, 68], [72, 66], [40, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" fill="#b88a00" opacity=".55" />)}</g>
          <path d="M60 22C66 10 80 9 88 15C82 24 70 28 60 22Z" fill="url(#sy-leaf)" stroke="#1f4a10" strokeWidth="1.2" />
        </>}
        {s === 'bell' && <>
          <circle cx="50" cy="12" r="5" fill="url(#sy-gold)" stroke="#5a3d06" strokeWidth="1.5" />
          <path d="M50 16C60 16 64 24 64 32C64 48 72 56 80 70H20C28 56 36 48 36 32C36 24 40 16 50 16Z" fill="url(#sy-gold)" stroke="#5a3d06" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M18 70H82V77C82 80 80 82 77 82H23C20 82 18 80 18 77Z" fill="url(#sy-gold)" stroke="#5a3d06" strokeWidth="2.2" />
          <circle cx="50" cy="88" r="7" fill="url(#sy-gold)" stroke="#5a3d06" strokeWidth="1.8" />
          <path d="M42 26C40 40 36 52 28 64" stroke="#fff" strokeOpacity=".7" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M56 30C58 42 62 52 70 62" stroke="#5a3d06" strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>}
        {s === 'bar' && <>
          <rect x="6" y="28" width="88" height="46" rx="8" fill="url(#sy-gold)" stroke="#5a3d06" strokeWidth="3" />
          <rect x="12" y="34" width="76" height="34" rx="4" fill="#0c0c0e" stroke="#f6e08a" strokeWidth="1.5" />
          <text x="50" y="62" textAnchor="middle" fontSize="27" fontFamily="Fraunces,serif" fontWeight="800" letterSpacing="3" fill="url(#sy-silver)" stroke="#000" strokeWidth=".6">BAR</text>
          <path d="M16 38H84" stroke="#f6e08a" strokeOpacity=".5" /><path d="M16 64H84" stroke="#f6e08a" strokeOpacity=".5" />
        </>}
        {s === 'seven' && <>
          <text x="53" y="84" textAnchor="middle" fontSize="96" fontFamily="Fraunces,serif" fontWeight="900" fill="#5a3d06">7</text>
          <text x="50" y="80" textAnchor="middle" fontSize="96" fontFamily="Fraunces,serif" fontWeight="900" fill="url(#sy-seven)" stroke="#fff" strokeWidth="4" paintOrder="stroke">7</text>
          <text x="50" y="80" textAnchor="middle" fontSize="96" fontFamily="Fraunces,serif" fontWeight="900" fill="none" stroke="#f0c64a" strokeWidth="1.2">7</text>
        </>}
        {s === 'diamond' && <>
          <path d="M50 90L12 40L26 14H74L88 40Z" fill="url(#sy-gem)" stroke="#0b2a5e" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M12 40H88M26 14L38 40L50 90L62 40L74 14M38 40L50 14L62 40" fill="none" stroke="#d9f3ff" strokeOpacity=".75" strokeWidth="1.4" />
          <path d="M26 14L38 40L12 40Z" fill="#fff" opacity=".35" /><path d="M50 14L62 40H38Z" fill="#fff" opacity=".4" />
        </>}
      </svg>
    </div>
  )
}
