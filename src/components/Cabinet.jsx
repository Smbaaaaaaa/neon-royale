// Spielautomat-Gehäuse für einfache Spiele: Marquee, Bildschirm, Bedienfeld mit Joystick und Münzeinwurf
export default function Cabinet({ title, children, deck }) {
  return (
    <div className="cab">
      <div className="cab-top"><span className="cab-title">{title}</span></div>
      <div className="cab-bezel"><div className="cab-screen">{children}<div className="cab-glass" aria-hidden="true" /></div></div>
      <div className="cab-deck">
        <div className="cab-stick" aria-hidden="true"><i /></div>
        <div className="cab-controls">{deck}</div>
        <div className="cab-btns" aria-hidden="true"><i /><i /></div>
      </div>
      <div className="cab-base"><div className="cab-slot" aria-hidden="true"><span>RC EINWERFEN</span></div></div>
    </div>
  )
}
