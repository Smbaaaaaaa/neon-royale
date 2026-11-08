// Schriftzug "ROYALE" mit kleiner Krone, die schräg auf dem letzten E sitzt
export default function Logo() {
  return (
    <span className="logo-t">ROYAL<span className="logo-e">E
      <svg className="crown" viewBox="0 0 24 18" aria-hidden="true">
        <defs><linearGradient id="lg-crown" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a0" /><stop offset=".55" stopColor="#c9a24a" /><stop offset="1" stopColor="#8a6a1c" /></linearGradient></defs>
        <path d="M2 16L1 5L7 10L12 2L17 10L23 5L22 16Z" fill="url(#lg-crown)" stroke="#6b5214" strokeWidth=".6" strokeLinejoin="round" />
        <rect x="2" y="14.5" width="20" height="2.6" rx="1" fill="url(#lg-crown)" />
        <circle cx="1" cy="5" r="1.4" fill="#f6e3a0" /><circle cx="12" cy="2" r="1.4" fill="#f6e3a0" /><circle cx="23" cy="5" r="1.4" fill="#f6e3a0" />
      </svg></span></span>
  )
}
