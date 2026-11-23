import { AXES, CLASSES, METRICS } from '../lib/core.js'
import { formatEntry } from '../lib/record-format'
import type { Card, State } from '../types'

const classes: Record<string, string> = CLASSES
const score = (value: number | null | undefined) => value == null ? '미측정' : value.toFixed(1)
function records(card: Card) {
  return card.input.entries.filter(entry => METRICS.some(metric => metric.code === entry.code))
}
function combatRows(card: Card) {
  const stats = card.result.stats
  return [
    ['기본 공격력', stats.power.toLocaleString('ko-KR')],
    ['클릭당 타격 수', stats.hits.toLocaleString('ko-KR') + ' 타'],
    ['치명타 확률', stats.crit + '%'],
    ['최대 HP', stats.max_hp.toLocaleString('ko-KR')],
  ]
}

export async function cardImage(card: Card, nickname: string) {
  const entries = records(card)
  const canvas = document.createElement('canvas')
  canvas.width = 1440
  canvas.height = Math.max(680, 220 + entries.length * 44)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw Error('이미지를 만들 수 없습니다.')
  ctx.fillStyle = '#d9e5e8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  function text(content: string, x: number, y: number, size: number, color = '#263e47', maxWidth = 380) {
    ctx!.fillStyle = color
    ctx!.font = `700 ${size}px 'Malgun Gothic',sans-serif`
    ctx!.fillText(content, x, y, maxWidth)
  }
  function panel(x: number, width: number, title: string) {
    ctx!.fillStyle = '#8da8b2'
    ctx!.fillRect(x, 30, width, canvas.height - 100)
    ctx!.fillStyle = '#eff4f3'
    ctx!.fillRect(x + 5, 35, width - 10, canvas.height - 110)
    const gradient = ctx!.createLinearGradient(0, 35, 0, 87)
    gradient.addColorStop(0, '#34778f')
    gradient.addColorStop(1, '#163d50')
    ctx!.fillStyle = gradient
    ctx!.fillRect(x + 5, 35, width - 10, 52)
    text(title, x + 20, 69, 19, '#ecffad')
  }
  function row(x: number, width: number, y: number, label: string, value: string, accent = false) {
    ctx!.fillStyle = accent ? '#bcda56' : '#c4e0e8'
    ctx!.fillRect(x, y, width * .47, 34)
    ctx!.fillStyle = '#fff'
    ctx!.fillRect(x + width * .47 + 2, y, width * .53 - 2, 34)
    text(label, x + 8, y + 23, 15, '#2a444d', width * .47 - 16)
    text(value, x + width * .47 + 10, y + 23, 16, '#253c43', width * .53 - 20)
  }
  panel(24, 400, 'ABILITY STAT · 능력 스탯')
  panel(438, 430, 'CHARACTER STAT · 캐릭터')
  panel(882, 534, 'RECORD DETAIL · 종목별 기록')
  AXES.forEach(([key, label], i) => {
    const value = card.result.axes[key]
    row(40, 368, 110 + i * 78, label, score(value), true)
    ctx.fillStyle = '#c4d1d2'
    ctx.fillRect(40, 150 + i * 78, 368, 8)
    if (value != null) {
      ctx.fillStyle = '#398ca3'
      ctx.fillRect(40, 150 + i * 78, 368 * value / 100, 8)
    }
  })
  row(454, 398, 110, '이름', nickname, true)
  row(454, 398, 150, '클래스', classes[card.result.class], true)
  row(454, 398, 190, '체중', card.input.body_weight + ' kg')
  combatRows(card).forEach(([label, value], i) => row(454, 398, 254 + i * 40, label, value))
  entries.forEach((entry, i) => {
    const metric = METRICS.find(item => item.code === entry.code)!
    const value = card.result.entry_scores?.[entry.code]
    row(898, 502, 110 + i * 44, metric.label, formatEntry(entry) + (value == null ? '' : ' · ' + score(value) + '점'))
  })
  text('FITCARD · 자가 입력 · ' + card.result.version.toUpperCase(), 40, canvas.height - 35, 18, '#39515a', 800)
  text(new Date(card.created_at).toLocaleDateString('ko-KR'), 1180, canvas.height - 35, 16)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('이미지 생성에 실패했습니다.')), 'image/png'))
}

export function CardView({ card, profile, pending, logged, busy, download, share, challenge, saveProfile }: {
  card: Card | null; profile: State['profile']
  pending: boolean; logged: boolean; busy: boolean; download: () => void; share: () => void; challenge: () => void
  saveProfile: (nickname: string, avatar: string) => void
}) {
  if (!card) return <div className="panel empty"><h1>첫 운동 기록을 남겨보세요.</h1><p>종목 하나부터 나의 스탯을 만들 수 있어요.</p><a href="#record">기록 입력하기 →</a></div>
  const entries = records(card)
  const measured = AXES.filter(([key]) => card.result.axes[key] != null).length
  return <>
    <div className="intro"><div><h1>나의 캐릭터 스탯</h1><p>운동 기록으로 채우는 네 가지 능력.</p></div><a className="text-button" href="#record">기록 갱신 ↗</a></div>
    <article className="fitness-card character-sheet" aria-label="나의 4축 스탯 카드">
      <section className="stat-window ability-window">
        <h2 className="window-title"><span>ABILITY STAT</span>능력 스탯</h2>
        <div className="window-body">
          {AXES.map(([key, label]) => {
            const value = card.result.axes[key]
            return <div className="ability-row" key={key}>
              <div className="sheet-row"><span>{label}</span><strong>{score(value)}{value != null && <small> / 100</small>}</strong></div>
              <div className="ability-meter" aria-hidden="true"><i style={{ width: `${value ?? 0}%` }} /></div>
            </div>
          })}
          <div className="sheet-note"><span>측정된 능력</span><strong>{measured} / 4</strong></div>
          <p className="sheet-help">미측정 축은 기록을 추가하면 채워집니다.</p>
        </div>
      </section>
      <section className="stat-window character-window">
        <h2 className="window-title"><span>CHARACTER STAT</span>캐릭터 정보</h2>
        <div className="window-body">
          <div className="sheet-row lime"><span>이름</span><strong>{profile.nickname}</strong></div>
          <div className="sheet-row lime"><span>클래스</span><strong className="class-name">{classes[card.result.class]}</strong></div>
          <div className="sheet-row"><span>체중</span><strong>{card.input.body_weight} kg</strong></div>
          <div className="sheet-row"><span>계산 기준</span><strong>{card.input.reference_sex === 'f' ? '여성' : '남성'}</strong></div>
          <h3 className="sheet-subtitle">BATTLE ABILITY</h3>
          {combatRows(card).map(([label, value]) => <div className="sheet-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          <p className="sheet-help">미측정 축에는 전투 기본값이 적용됩니다.</p>
        </div>
      </section>
      <section className="stat-window detail-window">
        <h2 className="window-title"><span>RECORD DETAIL</span>종목별 기록</h2>
        <div className="window-body">
          <div className="detail-head"><span>종목</span><span>기록 / 점수</span></div>
          {entries.map(entry => {
            const metric = METRICS.find(item => item.code === entry.code)!
            const value = card.result.entry_scores?.[entry.code]
            return <div className="sheet-row detail-row" key={entry.code}><span>{metric.label}</span><strong>{formatEntry(entry)}<small>{value == null ? '이전 버전 기록' : score(value) + '점'}</small></strong></div>
          })}
          {!entries.length && <p className="sheet-help">현재 4개 축에 해당하는 기록을 추가해 주세요.</p>}
          <p className="sheet-help">같은 축에서 가장 높은 종목 점수가 반영됩니다.</p>
        </div>
      </section>
      <div className="sheet-footer"><strong>FITCARD</strong><span>자가 입력 · 게임 점수 {card.result.version.toUpperCase()}</span><time>{new Date(card.created_at).toLocaleDateString('ko-KR')}</time></div>
    </article>
    <div className="card-controls">
      <div className="card-actions"><button id="download-card" className="secondary" disabled={busy} onClick={download}>이미지 저장 ↓</button><button className="secondary" disabled={busy} onClick={share}>공유 링크 ↗</button>
        <button className="primary" id="go-battle" disabled={busy} onClick={challenge}>{pending ? logged ? '계정에 저장하고 도전' : '로그인 후 업적 받기' : '보스 도전하기 →'}</button></div>
      <form key={profile.nickname + profile.avatar} className="profile-controls" onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        saveProfile(String(data.get('nickname')), String(data.get('avatar')))
      }}>
        <label htmlFor="nickname">닉네임<input id="nickname" name="nickname" maxLength={20} required defaultValue={profile.nickname} /></label>
        <label>아바타<select name="avatar" defaultValue={profile.avatar}><option value="a">라임 트레이너</option><option value="b">바이올렛 트레이너</option></select></label>
        <button className="secondary" disabled={busy}>프로필 저장</button>
      </form>
    </div>
    <p className="card-disclaimer">각 종목의 점수는 임시 게임 밸런스입니다. 실제 체력 백분위가 아닙니다.</p>
  </>
}
