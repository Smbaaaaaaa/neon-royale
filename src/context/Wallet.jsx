import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase.js'
const Ctx = createContext(null)
export const useWallet = () => useContext(Ctx)
const DAILY = 1000, RESCUE = 10
const today = () => new Date().toISOString().slice(0, 10)
const shape = s => s?.profile ? {
  name: s.profile.name, coins: Number(s.profile.coins), lastDaily: s.profile.last_daily, lastRescue: s.profile.last_rescue,
  eq: s.profile.eq, inv: s.inventory || [],
  stats: Object.fromEntries((s.stats || []).map(x => [x.game, { rounds: x.rounds, wins: x.wins, best: Number(x.best) }])),
} : null

export function WalletProvider({ children }) {
  const [p, setP] = useState(null), [ready, setReady] = useState(false), [error, setError] = useState(null)
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_state')
    if (error) { setError(error.message); return null }
    setError(null); const s = shape(data); setP(s); return s
  }, [])
  useEffect(() => { (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) await refresh()
    setReady(true)
  })() }, [refresh])

  // Ruft eine Server-Funktion auf und lädt danach den Zustand neu
  const act = async (fn, args) => {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) { setError(error.message); return { error: error.message } }
    await refresh(); return { data }
  }
  // Spiel-Funktionen: liefern das Ergebnis, der Kontostand wird erst nach der Animation aktualisiert
  const play = async (fn, args) => {
    const { data, error } = await supabase.rpc(fn, args)
    return error ? { error: error.message } : data
  }
  const createGuest = async name => {
    setError(null)
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) { setError(error.message); return }
    }
    const { error } = await supabase.rpc('ensure_profile', { p_name: name })
    if (error) { setError(error.message); return }
    await refresh()
  }
  const adjust = n => setP(s => s && { ...s, coins: s.coins + n })
  const buy = async id => !(await act('buy_item', { p_id: id })).error
  const equip = (type, val) => act('equip_item', { p_type: type, p_val: val })
  const rename = async n => { const r = await act('rename_profile', { p_name: n }); return r.error ? 0 : Number(r.data) }
  const claimDaily = () => act('claim_daily')
  const claimRescue = () => act('claim_rescue')
  return <Ctx.Provider value={{ p, ready, error, createGuest, refresh, adjust, buy, equip, rename, claimDaily, claimRescue, DAILY, RESCUE,
    playSlots: bet => play('play_slots', { p_bet: bet }), playRoulette: bets => play('play_roulette', { p_bets: bets }),
    dailyReady: !!p && p.lastDaily !== today(), rescueReady: !!p && p.coins < 2 && p.lastRescue !== today() }}>{children}</Ctx.Provider>
}
