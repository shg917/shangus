import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DemoApi, SupabaseApi, createApi } from './lib/api.js'
import { calculate, newPlayer, validateRecord } from './lib/core.js'
import { config } from './lib/config'
import { emptyDraft, readDraft, writeDraft, oauthDraftKey, takeOAuthDraft, draftKey } from './lib/drafts'
import { RecordForm } from './features/RecordForm'
import { CardView, cardImage, type Template } from './features/CardView'
import { Battle } from './features/Battle'
import { Rankings } from './features/Rankings'
import type { Attack, Card, Period, RecordInput, Request, State } from './types'

type Api = DemoApi | SupabaseApi
type Pending = Request & { id: string; version: number; scope: string }
const sections = { record: '기록 입력', card: '나의 카드', battle: '보스 도전', ranking: '랭킹' }
type Route = keyof typeof sections

function getRoute(): Route {
  const hash = location.hash.slice(1)
  return Object.hasOwn(sections, hash) ? hash as Route : 'record'
}

function guest(): State {
  return {
    player: newPlayer(), card: null, profile: { nickname: '나의 FitCard', avatar: 'a' },
    daily_available: true, claimed: [], has_workout: false, achievements: [],
  }
}
function previewCard(input: RecordInput): Card {
  return { input, result: calculate(input), created_at: new Date().toISOString() }
}
function userScope(api: Api) {
  return api instanceof SupabaseApi ? api.user?.id ?? 'guest' : 'demo'
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '요청에 실패했습니다.'
}
let connection: ReturnType<typeof createApi> | undefined

export function App() {
  const [api, setApi] = useState<Api | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [scope, setScope] = useState('guest')
  const [route, setRoute] = useState(getRoute)
  const [draft, setDraft] = useState(emptyDraft)
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState<Card | null>(null)
  const [template, setTemplate] = useState<Template>('stat')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [hit, setHit] = useState<Attack | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const latestScope = useRef('guest')
  const noticeTimer = useRef<number>(0)
  const notify = useCallback((message: string) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 4500)
  }, [])

  function hydrate(next: string, input?: RecordInput) {
    const saved = input ? { input, pending: true } : readDraft(next)
    latestScope.current = next
    setScope(next)
    setDraft(saved.input)
    setPending(false)
    setPreview(null)
    setHit(null)
    if (saved.pending) {
      try {
        setPreview(previewCard(validateRecord(saved.input)))
        setPending(true)
        if (input) writeDraft(next, input, true)
      } catch (error) { notify(errorText(error)) }
    }
  }

  useEffect(() => {
    let alive = true
    let unsubscribe: (() => void) | undefined
    let refreshVersion = 0
    const callback = new URL(location.href)
    const oauthError = callback.searchParams.get('error_description')
    if (oauthError) {
      sessionStorage.removeItem(oauthDraftKey)
      notify('카카오 로그인을 완료하지 못했습니다.')
      for (const name of ['error', 'error_code', 'error_description']) callback.searchParams.delete(name)
      history.replaceState(null, '', callback)
    }
    ;(connection ??= createApi(config)).then(async client => {
      if (!alive) return
      const next = userScope(client)
      const transfer = next !== 'guest' && next !== 'demo' ? takeOAuthDraft() : null
      hydrate(next, transfer ?? undefined)
      setApi(client)
      const refresh = async () => {
        const version = ++refreshVersion
        const current = userScope(client)
        const data = current === 'guest' ? guest() : await client.state()
        if (alive && version === refreshVersion && current === latestScope.current) setState(data)
      }
      if (client instanceof SupabaseApi) {
        const { data } = client.client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
          if (event === 'INITIAL_SESSION') return
          client.user = session?.user ?? null
          const current = userScope(client)
          if (current === latestScope.current) return
          const previous = latestScope.current
          if (previous !== 'guest') localStorage.removeItem(draftKey(previous))
          sessionStorage.removeItem('fitcard-request')
          setState(null)
          hydrate(current)
          window.setTimeout(() => { if (alive) refresh().catch(error => setError(errorText(error))) }, 0)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      }
      await refresh()
    }).catch(error => { if (alive) setError(errorText(error)) })
    return () => { alive = false; unsubscribe?.() }
  }, [notify])

  useEffect(() => {
    const update = () => setRoute(getRoute())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useEffect(() => {
    if (!api) return
    const refresh = () => {
      if (document.hidden || inFlight.current || latestScope.current === 'guest') return
      const current = latestScope.current
      api.state().then(data => {
        if (current === latestScope.current && !inFlight.current) setState(data)
      }).catch(error => notify(errorText(error)))
    }
    const syncDemo = (event: StorageEvent) => { if (event.key === 'fitcard-app-v1') refresh() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('storage', syncDemo)
    const timer = window.setInterval(refresh, 60000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('storage', syncDemo)
      window.clearInterval(timer)
    }
  }, [api, notify])

  const loadRanks = useCallback((kind: Period) => api!.rankings(kind), [api, scope, state?.player.version])
  const logged = scope !== 'guest'
  const card = preview ?? state?.card ?? null
  const kakaoAvailable = api instanceof SupabaseApi && api.kakaoEnabled !== false
  const showLogin = () => dialog.current?.showModal()
  async function login() {
    if (!(api instanceof SupabaseApi)) return
    setLoginBusy(true)
    try {
      sessionStorage.removeItem(oauthDraftKey)
      if (pending) sessionStorage.setItem(oauthDraftKey, JSON.stringify(validateRecord(draft)))
      await api.login()
    } catch (error) {
      sessionStorage.removeItem(oauthDraftKey)
      notify(errorText(error))
      setLoginBusy(false)
    }
  }

  async function operation(action: () => Promise<void>) {
    if (!api || inFlight.current || scope !== latestScope.current) return
    const current = scope
    inFlight.current = true
    setBusy(true)
    try { await action() }
    catch (error) { notify(errorText(error)) }
    finally {
      try {
        if (current === latestScope.current && current !== 'guest') {
          const fresh = await api.state()
          if (current === latestScope.current) setState(fresh)
        }
      } catch (error) { notify(errorText(error)) }
      inFlight.current = false
      setBusy(false)
    }
  }
  async function mutate(request: Request) {
    if (!api || !state) throw Error('상태를 불러오는 중입니다.')
    const stored = sessionStorage.getItem('fitcard-request')
    let previous: Pending | null = null
    try { previous = stored ? JSON.parse(stored) : null } catch { sessionStorage.removeItem('fitcard-request') }
    if (previous?.scope !== scope) previous = null
    const next: Pending = previous ?? { ...request, scope, id: crypto.randomUUID(), version: state.player.version }
    const recovered = !!previous && (previous.action !== request.action || JSON.stringify(previous.payload) !== JSON.stringify(request.payload))
    sessionStorage.setItem('fitcard-request', JSON.stringify(next))
    let result
    try {
      switch (next.action) {
        case 'record': result = await api.saveRecord(next.payload, next.id); break
        case 'attack': result = await api.attack(next.id, next.version); break
        case 'start': result = await api.start(next.payload.kind, next.id); break
        case 'claim': result = await api.claim(next.payload.kind, next.id); break
      }
    } catch (error) {
      if (!/fetch|network|timeout|네트워크|연결/i.test(errorText(error))) sessionStorage.removeItem('fitcard-request')
      throw error
    }
    if (scope !== latestScope.current) throw Error('계정이 변경되었습니다.')
    sessionStorage.removeItem('fitcard-request')
    if (recovered) throw Error('이전 요청을 복구했습니다. 결과를 확인한 뒤 다시 실행해 주세요.')
    return result
  }

  function changeDraft(input: RecordInput) {
    setDraft(input)
    setPending(false)
    setPreview(null)
    try { writeDraft(scope, input, false) } catch (error) { notify(errorText(error)) }
  }
  async function submit(input: RecordInput) {
    const valid = validateRecord(input)
    if (logged) {
      await mutate({ action: 'record', payload: valid })
      setPreview(null)
      notify('카드와 전투 능력치를 갱신했습니다.')
    } else setPreview(previewCard(valid))
    setDraft(valid)
    setPending(!logged)
    location.hash = 'card'
    writeDraft(scope, valid, !logged)
  }

  return <>
    <header className="header"><a className="brand" href="#record">FITCARD<span>기록이 힘이 되는 곳</span></a>
      <div className="account">{logged && api instanceof SupabaseApi && state
        ? <><span>{state.profile.nickname}</span><button className="secondary" disabled={busy} onClick={() => operation(async () => {
          await api.logout()
          notify('로그아웃했습니다.')
        })}>로그아웃</button></>
        : <button id="login-open" className="kakao" onClick={showLogin}>카카오로 시작</button>}</div>
    </header>
    <nav className="navigation" aria-label="주요 메뉴">{Object.entries(sections).map(([key, label]) =>
      <a href={'#' + key} key={key} aria-current={key === route ? 'page' : undefined} className={key === route ? 'active' : ''}>{label}</a>)}</nav>
    <div id="mode" className="mode">{api?.mode === 'demo' ? <><strong>로컬 체험</strong> · 이 브라우저에 저장됩니다.</> : logged ? <strong>계정에 연결됨</strong> : '카드는 로그인 없이 만들 수 있어요.'}</div>
    <main id="app">
      {error ? <section className="panel"><h1>연결을 확인해 주세요.</h1><p className="error">{error}</p><button onClick={() => location.reload()}>다시 시도</button></section>
      : !api || !state ? <p className="loading">불러오는 중…</p> : <>
        {route === 'record' && <RecordForm key={scope} draft={draft} change={changeDraft} submit={input => operation(() => submit(input))} busy={busy} saved={!!state.card} />}
        {route === 'card' && <CardView card={card} profile={state.profile} template={template} select={setTemplate} pending={pending} logged={logged} busy={busy}
          download={() => operation(async () => {
            if (!card) return
            const url = URL.createObjectURL(await cardImage(card, state.profile.nickname, template))
            const link = document.createElement('a')
            link.href = url
            link.download = 'fitcard-' + template + '.png'
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 2000)
          })}
          share={() => operation(async () => {
            if (!logged) return showLogin()
            if (!card?.id) throw Error('카드를 계정에 먼저 저장해 주세요.')
            if (!(api instanceof SupabaseApi)) throw Error('공유 링크는 계정 연결 후 이용할 수 있습니다.')
            const url = await api.uploadCard(await cardImage(card, state.profile.nickname, template), card.id)
            try { await navigator.clipboard.writeText(url); notify('1시간 동안 유효한 공유 링크를 복사했습니다.') }
            catch { window.prompt('1시간 동안 유효한 공유 링크', url) }
          })}
          challenge={() => operation(async () => {
            if (!logged) return showLogin()
            if (pending) await submit(draft)
            location.hash = 'battle'
          })}
          saveProfile={(nickname, avatar) => operation(async () => {
            if (!logged) return showLogin()
            await api.profile(nickname, avatar)
            notify('프로필을 저장했습니다.')
          })}
        />}
        {route === 'battle' && <Battle state={state} logged={logged} mode={api.mode} busy={busy} hit={hit}
          attack={() => operation(async () => {
            if (!logged) return showLogin()
            if (!state.card) { location.hash = 'record'; return }
            if (state.player.status !== 'active') {
              await mutate({ action: 'start', payload: { kind: state.daily_available ? 'daily' : 'ticket' } })
              return
            }
            const result: Attack = await mutate({ action: 'attack' })
            setState({ ...state, player: result.player })
            setHit(result)
            notify(result.kills ? `${result.kills}레벨 돌파!` : '공격을 완료했습니다.')
            setTimeout(() => setHit(current => current === result ? null : current), 650)
          })}
          claim={kind => operation(async () => { await mutate({ action: 'claim', payload: { kind } }); notify('부활권 1장을 받았습니다.') })} />}
        {route === 'ranking' && <Rankings load={loadRanks} demo={api.mode === 'demo'} />}
      </>}
    </main>
    <footer>FITCARD <span>자가 입력 기반 · 게임 점수 v1</span></footer>
    <div id="toast" className={notice ? 'show' : ''} role="status" aria-live="polite">{notice}</div>
    <dialog id="login-dialog" ref={dialog}>
      <form method="dialog"><button className="close" aria-label="닫기">×</button></form>
      <h2>나의 성장을 저장하세요.</h2><p>카드, 보스 진행도와 업적을 계정에 저장할 수 있어요.</p>
      <button id="kakao-login" className="kakao" disabled={!kakaoAvailable || loginBusy} onClick={login}>{kakaoAvailable ? '카카오로 시작하기' : '카카오 로그인 준비 중'}</button>
      <p className="muted" id="login-note">{kakaoAvailable ? '로그인해도 자가 입력 기록의 성격은 그대로입니다.' : '카카오 로그인을 준비 중입니다. 지금은 카드 만들기와 이미지 저장을 이용할 수 있어요.'}</p>
    </dialog>
  </>
}
