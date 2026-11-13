import { AXES, CLASSES, METRICS } from '../lib/core.js'
import { Stats } from './Stats'
import type { Card, State } from '../types'

const templates = {
  stat: '스탯 카드', receipt: '운동 영수증', status: '상태창',
  report: '성적표', license: '운동 면허증', news: '헬스장 속보',
}
export type Template = keyof typeof templates
const classes: Record<string, string> = CLASSES

function Radar({ axes }: { axes: Card['result']['axes'] }) {
  const point = (i: number, r: number) => [150 + Math.sin(i * Math.PI * 2 / 5) * r, 128 - Math.cos(i * Math.PI * 2 / 5) * r] as const
  return <svg className="radar" viewBox="0 0 300 255" role="img" aria-label={AXES.map(([key, label]) => label + ' ' + (axes[key] ?? '미측정')).join(', ')}>
    {[.33, .66, 1].map(radius => <polygon key={radius} points={AXES.map((_, i) => point(i, 83 * radius).join(',')).join(' ')} fill="none" stroke="#455334" />)}
    {AXES.every(([key]) => axes[key] != null) && <polygon points={AXES.map(([key], i) => point(i, 83 * (axes[key] ?? 0) / 100).join(',')).join(' ')} fill="#d4fc5222" stroke="#d4fc52" />}
    {AXES.map(([key, label], i) => {
      const value = axes[key], [x, y] = point(i, 83 * (value ?? 0) / 100), [lx, ly] = point(i, 108)
      return <g key={key}>{value != null && <><line x1="150" y1="128" x2={x} y2={y} stroke="#d4fc52" strokeWidth="3" /><circle cx={x} cy={y} r="4" fill="#d4fc52" /></>}
        <text x={lx} y={ly} textAnchor="middle" fontSize="11" fill={value == null ? '#81916e' : '#d7e4c0'}>{label}<tspan x={lx} dy="15">{value ?? '미측정'}</tspan></text></g>
    })}
  </svg>
}

export async function cardImage(card: Card, nickname: string, template: Template) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) throw Error('이미지를 만들 수 없습니다.')
  ctx.fillStyle = '#182011'
  ctx.fillRect(0, 0, 720, 1080)
  ctx.strokeStyle = '#6d8344'
  ctx.strokeRect(24, 24, 672, 1032)
  function text(content: string, x: number, y: number, size: number, color = '#f0f5e6') {
    ctx!.fillStyle = color
    ctx!.font = `700 ${size}px 'Malgun Gothic', sans-serif`
    ctx!.fillText(content, x, y, 600)
  }
  text('FITCARD.', 60, 100, 40, '#d4fc52')
  text(templates[template], 60, 155, 18)
  text(classes[card.result.class], 60, 240, 64)
  text(nickname, 60, 285, 22)
  AXES.forEach(([key, label], i) => {
    const y = 365 + i * 90, score = card.result.axes[key]
    text(label, 60, y, 22)
    text(score == null ? '미측정' : String(score), 540, y, 26, '#d4fc52')
    ctx.fillStyle = '#354327'
    ctx.fillRect(60, y + 17, 595, 7)
    if (score != null) {
      ctx.fillStyle = '#d4fc52'
      ctx.fillRect(60, y + 17, 595 * score / 100, 7)
    }
  })
  text(`${card.input.body_weight}kg · ${card.input.entries.length}개 종목`, 60, 875, 24)
  text('자가 입력 · 게임 점수 v1', 60, 925, 20)
  text(new Date(card.created_at).toLocaleDateString('ko-KR'), 60, 995, 18)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('이미지 생성에 실패했습니다.')), 'image/png'))
}

export function CardView({ card, profile, template, select, pending, logged, busy, download, share, challenge, saveProfile }: {
  card: Card | null; profile: State['profile']; template: Template; select: (value: Template) => void
  pending: boolean; logged: boolean; busy: boolean; download: () => void; share: () => void; challenge: () => void
  saveProfile: (nickname: string, avatar: string) => void
}) {
  return <>
    <div className="intro"><div><h1>{card ? '기록은 나를 닮는다.' : '첫 운동 기록을 남겨보세요.'}</h1><p>종목 하나부터 나만의 카드를 만들 수 있어요.</p></div></div>
    {!card ? <div className="panel empty"><a href="#record">기록 입력하기 →</a></div> : <div className="grid">
      <div className="card-stage"><article className="fitness-card">
        <div className="section-head"><b className="brand">FITCARD.</b><span className="pill">자가 입력</span></div>
        <div className="card-type">{templates[template]} / {card.result.version.toUpperCase()}</div>
        <div className="class-name">{classes[card.result.class]}</div>
        <p className="muted">{profile.nickname} · {card.input.body_weight}kg</p>
        {template === 'stat' ? <Radar axes={card.result.axes} /> : <div className="record-list">{AXES.map(([key, label]) => <div key={key}>{label}<b>{card.result.axes[key] ?? '미측정'}</b></div>)}</div>}
        <div className="record-list">{card.input.entries.slice(0, 4).map(entry => {
          const metric = METRICS.find(item => item.code === entry.code)
          return metric && <div key={entry.code}>{metric.label}<b>{entry.value}{metric.unit}{metric.lift && ' × ' + entry.reps}</b></div>
        })}</div>
        <div className="card-foot"><span>{new Date(card.created_at).toLocaleDateString('ko-KR')}</span><span>게임 점수 · {card.input.entries.length}개 기록</span></div>
      </article></div>
      <aside className="stack">
        <section className="panel"><h2>카드 스타일</h2><select id="template" aria-label="카드 스타일" value={template} onChange={event => select(event.target.value as Template)}>
          {Object.entries(templates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <div className="buttons"><button id="download-card" className="secondary" disabled={busy} onClick={download}>이미지 저장 ↓</button><button className="secondary" disabled={busy} onClick={share}>공유 링크 ↗</button></div>
        </section>
        <section className="panel"><h2>나의 전투 능력치</h2><Stats values={card.result.stats} />
          <p className="muted">미측정 축은 게임 기본값으로 시작합니다.</p>
          <button className="primary" id="go-battle" disabled={busy} onClick={challenge}>{pending ? logged ? '계정에 저장하고 도전' : '로그인 후 업적 받기' : '보스 도전하기 →'}</button>
        </section>
        <form key={profile.nickname + profile.avatar} className="panel" onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          saveProfile(String(data.get('nickname')), String(data.get('avatar')))
        }}>
          <h3>아바타 &amp; 닉네임</h3>
          <label>아바타 <select name="avatar" defaultValue={profile.avatar}><option value="a">라임 트레이너</option><option value="b">바이올렛 트레이너</option></select></label>
          <label htmlFor="nickname">랭킹에 표시할 닉네임</label><input id="nickname" name="nickname" maxLength={20} required defaultValue={profile.nickname} />
          <button className="secondary wide" disabled={busy} style={{ marginTop: 10 }}>프로필 저장</button>
        </form>
      </aside>
    </div>}
  </>
}
