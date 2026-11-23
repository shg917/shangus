import { useEffect, useRef } from 'react'
import { CLASSES } from '../lib/core.js'
import { BOSSES, bossAt, hpAt } from '../lib/click-combat.js'
import { drawArena } from '../lib/art.js'
import { useTimedBattle } from './useTimedBattle'
import { Stats, format } from './Stats'
import type { Attack, State } from '../types'

function Health({ value, max, player = false }: { value: number; max: number; player?: boolean }) {
  return <><div className={'health' + (player ? ' player' : '')} role="progressbar" aria-label={player ? '나의 HP' : '보스 HP'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${value / max * 100}%` }} /></div>
    <div className="hp-label"><span>{player ? 'MY HP' : 'BOSS HP'}</span><span>{format(value)} / {format(max)}</span></div></>
}

export function Battle({ api, state, scope, update, notify, logged, busy, attack, claim }: {
  api: { state: () => Promise<State>; clickAttack: (id: string, runId: string, totalClicks: number) => Promise<Attack> }
  state: State; scope: string; update: (state: State) => void; notify: (message: string) => void
  logged: boolean; busy: boolean; attack: () => void; claim: (kind: string) => void
}) {
  const player = state.player, boss = bossAt(player.level), complete = player.status === 'complete'
  const timed = useTimedBattle(api, state, scope, update, notify)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const draw = () => { if (canvas.current) drawArena(canvas.current, player.level, state.profile.avatar) }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [player.level, state.profile.avatar])
  const button = !logged ? '카카오로 시작하기' : !state.card ? '기록 입력하고 시작'
    : player.status === 'active' ? '클릭해서 공격!'
    : state.daily_available ? '오늘 기본 플레이로 시작' : player.tickets > 0 ? '부활권 1장으로 이어하기' : '부활권이 필요해요'
  return <>
    <div className="intro"><div><h1>60초, 멈추지 않는 공격.</h1><p>클릭할 때마다 공격합니다. 보스는 2초마다 반격합니다.</p></div><span className="pill">보스 {player.level} / 10</span></div>
    <div className="grid battle-grid">
      <section className="panel arena-panel">
        <div className="boss-heading"><div><div className="level">BOSS {player.level}</div><h2>{complete ? '10명 전원 격파' : boss.name}</h2></div><div className="battle-clock" aria-label="남은 시간">{player.status === 'ready' ? 60 : player.status === 'active' ? timed.seconds : 0}<small>초</small></div></div>
        <div className="health-wrap"><Health value={player.boss_hp} max={hpAt(player.level)} /></div>
        <div className="arena">
          <canvas ref={canvas} id="arena-canvas" role="img" aria-label="헬스장에서 보스와 맞서는 아바타" />
          {timed.clickFlash > 0 && <div key={timed.clickFlash} className="click-impact" aria-hidden="true"><div className="impact-ring" /><div className="hit-slash" /><div className="hit-slash reverse" /></div>}
          {timed.result && <span key={timed.result.player.version} className="damage-float">−{format(timed.result.effective)}</span>}
        </div>
        <div className="battle-bottom">
          <Health value={player.hp} max={player.stats.max_hp} player />
          <div className="click-summary"><span>클릭 <b>{player.click_count ?? 0}</b>회</span><span>처치 <b>{player.cleared}</b> / 10</span>{timed.waiting > 0 && <span>반영 중 {timed.waiting}회</span>}</div>
          <p className="battle-message" aria-live="polite">{complete ? '모든 보스를 쓰러뜨렸습니다.' : player.status === 'dead' ? player.end_reason === 'timeout' ? '60초 종료. 보스 HP는 다음 도전으로 이어집니다.' : '쓰러졌습니다. 부활하면 깎아둔 보스 HP부터 이어갑니다.' : player.status === 'active' ? '공격 버튼을 연속으로 눌러주세요!' : '한 번의 도전은 60초. 공격한 만큼 보스 HP가 누적 차감됩니다.'}</p>
          <button id="attack" className="primary battle-button rapid-attack" disabled={complete || (player.status === 'active' ? timed.seconds <= 0 : busy)}
            onClick={player.status === 'active' ? timed.click : attack}>{button}</button>
          <div className="hp-label"><span>오늘 기본 플레이 {state.daily_available ? 1 : 0} / 1</span><span>부활권 {player.tickets}장</span></div>
        </div>
      </section>
      <aside className="stack">
        <section className="panel"><div className="section-head"><h2>{(CLASSES as Record<string, string>)[state.card?.result.class || 'unclassified']} 트레이너</h2><a className="text-button" href="#record">기록 갱신 ↗</a></div><Stats values={player.stats} /><p className="muted">클릭 1회당 {format(player.stats.hits)}타 · 2초마다 자동 반격</p></section>
        <section className="panel"><h2>오늘의 퀘스트</h2>{[['login', api && scope === 'demo' ? '체험 출석' : '오늘 로그인'], ['workout', '운동 기록 남기기']].map(([kind, label]) =>
          <div className="quest" key={kind}><div><strong>{label}</strong><small>부활권 1장</small></div>
            <button data-claim={kind} disabled={busy || !logged || state.claimed.includes(kind) || (kind === 'workout' && !state.has_workout)} onClick={() => claim(kind)}>{state.claimed.includes(kind) ? '받음' : '받기'}</button></div>)}</section>
        <section className="panel"><h3>10명의 보스</h3><div className="road">{BOSSES.map(item => <div key={item.from} className={item.from === boss.from ? 'current' : ''}><span>{item.from <= player.cleared ? '✓ ' : ''}{item.name}</span><span>{format(item.hp)} HP</span></div>)}</div></section>
        <section className="panel"><h3>획득한 업적</h3>{state.achievements.length ? state.achievements.map(item => <div className="achievement" key={item.label}>✦ {item.label}</div>) : <p className="muted">첫 보스를 쓰러뜨리면 업적이 열려요.</p>}</section>
      </aside>
    </div>
  </>
}
