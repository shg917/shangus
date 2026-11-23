import { useEffect, useRef, useState } from 'react'
import type { Attack, State } from '../types'

type Api = {
  state: () => Promise<State>
  clickAttack: (id: string, runId: string, totalClicks: number) => Promise<Attack>
}
type Pending = { id: string; runId: string; totalClicks: number }

export function useTimedBattle(api: Api, state: State, scope: string, update: (state: State) => void, notify: (message: string) => void) {
  const [seconds, setSeconds] = useState(0)
  const [clickFlash, setClickFlash] = useState(0)
  const [result, setResult] = useState<Attack | null>(null)
  const [waiting, setWaiting] = useState(0)
  const syncRef = useRef<() => Promise<void>>(async () => {})
  const target = useRef(0)
  const snapshot = useRef(state)
  snapshot.current = state
  const deadline = useRef(0)

  useEffect(() => {
    const runId = state.player.run_id
    if (!runId || state.player.status !== 'active') { setSeconds(0); return }
    let mounted = true, syncing = false, failures = 0, retryAfter = 0
    let confirmed = state.player.click_count
    let anchorServer = state.server_now ?? Date.now(), anchorLocal = performance.now()
    const countKey = `fitcard-click-count:${scope}:${runId}`
    const requestKey = `fitcard-click-request:${scope}:${runId}`
    target.current = Math.max(state.player.click_count, Number(sessionStorage.getItem(countKey)) || 0)
    deadline.current = state.player.ends_at
    const serverNow = () => anchorServer + performance.now() - anchorLocal
    const refreshClock = () => {
      if (mounted) setSeconds(Math.max(0, Math.ceil((deadline.current - serverNow()) / 1000)))
    }
    const sync = async () => {
      if (syncing || performance.now() < retryAfter) return
      syncing = true
      try {
        let pending: Pending | null = null
        try { pending = JSON.parse(sessionStorage.getItem(requestKey) ?? 'null') } catch { sessionStorage.removeItem(requestKey) }
        const current = snapshot.current.player
        if (!pending && target.current > current.click_count) {
          pending = { id: crypto.randomUUID(), runId, totalClicks: target.current }
          sessionStorage.setItem(requestKey, JSON.stringify(pending))
        }
        if (pending) {
          const accepted = await api.clickAttack(pending.id, pending.runId, pending.totalClicks)
          sessionStorage.removeItem(requestKey)
          if (mounted && accepted.effective > 0) {
            setResult(accepted)
            window.setTimeout(() => { if (mounted) setResult(value => value === accepted ? null : value) }, 550)
          }
        }
        const next = await api.state()
        if (next.player.run_id !== runId) { confirmed = target.current; return }
        confirmed = next.player.click_count
        anchorServer = next.server_now ?? Date.now()
        anchorLocal = performance.now()
        deadline.current = next.player.ends_at
        target.current = Math.max(target.current, next.player.click_count)
        if (next.player.status !== 'active') {
          sessionStorage.removeItem(countKey)
          sessionStorage.removeItem(requestKey)
          target.current = next.player.click_count
        }
        if (mounted) {
          setWaiting(Math.max(0, target.current - next.player.click_count))
          update(next)
          refreshClock()
        }
        failures = 0
      } catch (error) {
        retryAfter = performance.now() + 1000
        if (!failures++ && mounted) notify(error instanceof Error ? error.message : '전투 연결을 확인해 주세요.')
      } finally {
        syncing = false
        if (!mounted && !failures && target.current > confirmed) void sync()
      }
    }
    syncRef.current = sync
    refreshClock()
    const clock = window.setInterval(refreshClock, 100)
    const timer = window.setInterval(() => { void sync() }, 200)
    return () => {
      mounted = false
      clearInterval(clock)
      clearInterval(timer)
      // Flush accepted local clicks on route change. Lost responses keep the request ID.
      if (target.current > snapshot.current.player.click_count) void sync()
    }
  }, [api, state.player.run_id, state.player.status, scope])

  function click() {
    if (snapshot.current.player.status !== 'active' || seconds <= 0) return
    target.current++
    const runId = snapshot.current.player.run_id!
    sessionStorage.setItem(`fitcard-click-count:${scope}:${runId}`, String(target.current))
    setWaiting(Math.max(0, target.current - snapshot.current.player.click_count))
    setClickFlash(value => value + 1)
    void syncRef.current()
  }
  return { seconds, click, clickFlash, result, waiting }
}
