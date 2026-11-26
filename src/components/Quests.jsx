import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import { useWin } from './WinBanner.jsx'
const PERIOD = { daily: 'Tägliche Quests', weekly: 'Wöchentliche Quests', monthly: 'Monatliche Quests' }
const DIFF = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' }
const fmt = n => Number(n).toLocaleString('de-DE')
function resetIn(period, pkey) {
  const d = new Date(pkey + 'T00:00:00Z'), next = period === 'daily' ? new Date(d.getTime() + 864e5) : period === 'weekly' ? new Date(d.getTime() + 7 * 864e5) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const h = Math.max(0, Math.floor((next - Date.now()) / 36e5)); return h >= 48 ? `${Math.floor(h / 24)} Tage` : `${h} Std`
}
export default function Quests() {
  const { call, quests, refreshQuests, refresh } = useWallet(), showWin = useWin()
  const claim = async q => {
    const r = await call('quest_claim', { p_id: q.id })
    if (r?.error) return alert(r.error)
    sfx.win(q.diff === 'hard' ? 'jackpot' : q.diff === 'medium' ? 'big' : 'small'); showWin(Number(r), q.diff === 'hard' ? 'jackpot' : q.diff === 'medium' ? 'big' : 'small', 'QUEST GESCHAFFT')
    refreshQuests(); refresh()
  }
  return (
    <main><h1>Quests</h1>
      <p className="muted">Spiele, sammle Fortschritt und hol dir die Belohnung ab. Je schwerer die Quest, desto größer die Belohnung. Neue Quests gibt es täglich, wöchentlich (montags) und monatlich.</p>
      {!quests && <p className="muted">Lade Quests …</p>}
      {['daily', 'weekly', 'monthly'].map(per => { const list = (quests || []).filter(q => q.period === per); if (!list.length) return null
        return (
          <section key={per}><h2 className="sec">{PERIOD[per]} <small className="muted">· neu in {resetIn(per, list[0].pkey)}</small></h2>
            <div className="grid">{list.map(q => { const v = Math.min(Number(q.value), Number(q.target)), done = Number(q.value) >= Number(q.target)
              return (
                <article key={q.id} className={'tile quest d-' + q.diff + (q.claimed ? ' claimed' : '')}>
                  <span className={'qdiff d-' + q.diff}>{DIFF[q.diff]}</span><h2>{q.title}</h2>
                  <div className="qbar" role="progressbar" aria-valuemin="0" aria-valuemax={q.target} aria-valuenow={v}><i style={{ width: (v / Number(q.target)) * 100 + '%' }} /></div>
                  <small className="muted">{fmt(v)} von {fmt(q.target)}</small>
                  <span className="price">Belohnung: {fmt(q.reward)} RC</span>
                  <button className="btn sm" disabled={!done || q.claimed} onClick={() => claim(q)}>{q.claimed ? 'Abgeholt ✓' : done ? 'Belohnung abholen' : 'Noch nicht geschafft'}</button>
                </article>) })}</div></section>) })}
    </main>
  )
}
