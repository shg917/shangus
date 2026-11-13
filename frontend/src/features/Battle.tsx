import { useEffect, useRef } from 'react'
import { BOSSES, CLASSES, bossAt, hpAt } from '../lib/core.js'
import { drawArena } from '../lib/art.js'
import { Stats, format } from './Stats'
import type { Attack, State } from '../types'

function Health({ value, max, player = false }: { value: number; max: number; player?: boolean }) {
  return <><div className={'health' + (player ? ' player' : '')} role="progressbar" aria-label={player ? '나의 HP' : '보스 HP'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${value / max * 100}%` }} /></div>
    <div className="hp-label"><span>{player ? 'MY HP' : 'BOSS HP'}</span><span>{format(value)} / {format(max)}</span></div></>
}

export function Battle({ state, logged, mode, busy, hit, attack, claim }: {
  state: State; logged: boolean; mode: string; busy: boolean; hit: Attack | null
  attack: () => void; claim: (kind: string) => void
}) {
  const player = state.player, boss = bossAt(player.level) ?? BOSSES[0], complete = player.status === 'complete'
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const draw = () => { if (canvas.current) drawArena(canvas.current, player.level, state.profile.avatar) }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [player.level, state.profile.avatar])
  const button = !logged ? '카카오로 시작하기' : !state.card ? '기록 입력하고 시작'
    : player.status === 'active' ? `공격하기 / ${format(player.stats.hits)} HIT`
    : state.daily_available ? '오늘 기본 플레이로 시작' : player.tickets > 0 ? '부활권 1장으로 이어하기' : '부활권이 필요해요'
  const achievements = mode === 'demo' ? [{ level: 1, label: '첫 보스 격파' }, { level: 100, label: '백 층 돌파' }, { level: 1000, label: '천 층의 주인' }, { level: 9999, label: '9,999층 정복' }].filter(a => a.level <= player.cleared) : state.achievements
  return <>
    <div className="intro"><div><h1>어디까지 강해질 수 있을까.</h1><p>초과 피해는 다음 보스까지. 쓰러져도 깎아둔 보스 HP는 그대로.</p></div><span className="pill">LV. 1 — 9,999</span></div>
    <div className="grid battle-grid">
      <section className="panel arena-panel">
        <div className="boss-heading"><div><div className="level">LV. {format(player.level)}</div><h2>{complete ? '보스 탑 정복' : boss.name}</h2></div><div className="muted">처치 완료<br /><strong>{format(player.cleared)} 레벨</strong></div></div>
        <div className="health-wrap"><Health value={player.boss_hp} max={hpAt(player.level)} /></div>
        <div className={'arena' + (hit ? ' hit' : '')}>
          <canvas ref={canvas} id="arena-canvas" role="img" aria-label="헬스장에서 보스와 맞서는 아바타" />
          {hit && <><div className="impact-ring" /><div className="hit-slash" /><div className="hit-slash reverse" /><span className="damage-float">−{format(hit.effective)}</span>{hit.kills > 0 && <span className="overkill">+{hit.kills} LV</span>}{hit.counter > 0 && <span className="counter-note">−{format(hit.counter)}</span>}</>}
        </div>
        <div className="battle-bottom">
          <Health value={player.hp} max={player.stats.max_hp} player />
          <p className="battle-message" aria-live="polite">{complete ? '모든 보스를 쓰러뜨렸습니다.' : player.status === 'dead' ? '쓰러졌습니다. 보스에게 남긴 피해가 다음 도전에 이어집니다.' : player.status === 'active' ? '내 공격 후 살아남은 보스가 한 번 반격합니다.' : '오늘의 도전을 시작하세요.'}</p>
          <button id="attack" className="primary battle-button" disabled={busy || complete} onClick={attack}>{button}</button>
          <div className="hp-label"><span>오늘 기본 플레이 {state.daily_available ? 1 : 0} / 1</span><span>부활권 {player.tickets}장</span></div>
        </div>
      </section>
      <aside className="stack">
        <section className="panel"><div className="section-head"><h2>{(CLASSES as Record<string, string>)[state.card?.result.class || 'unclassified']} 트레이너</h2><a className="text-button" href="#record">기록 갱신 ↗</a></div><Stats values={player.stats} /><p className="muted">기록 저장 즉시 능력치에 반영됩니다.</p></section>
        <section className="panel"><h2>오늘의 퀘스트</h2>{[['login', mode === 'demo' ? '체험 출석' : '오늘 로그인'], ['workout', '운동 기록 남기기']].map(([kind, label]) =>
          <div className="quest" key={kind}><div><strong>{label}</strong><small>부활권 1장</small></div>
            <button data-claim={kind} disabled={busy || !logged || state.claimed.includes(kind) || (kind === 'workout' && !state.has_workout)} onClick={() => claim(kind)}>{state.claimed.includes(kind) ? '받음' : '받기'}</button></div>)}</section>
        <section className="panel"><h3>다음 상대</h3><div className="road">{BOSSES.map(item => <div key={item.from} className={item.from === boss.from ? 'current' : ''}><span>{item.name}</span><span>Lv.{format(item.from)}</span></div>)}</div></section>
        <section className="panel"><h3>획득한 업적</h3>{achievements.length ? achievements.map(item => <div className="achievement" key={item.label}>✦ {item.label}</div>) : <p className="muted">첫 보스를 쓰러뜨리면 업적이 열려요.</p>}</section>
      </aside>
    </div>
  </>
}
