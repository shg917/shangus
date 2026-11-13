import { useEffect, useState } from 'react'
import { CAP, hpAt, periods } from '../lib/core.js'
import { format } from './Stats'
import type { Period, Rank } from '../types'

const labels = { year: '누적 · 연간', month: '월간', week: '주간' }
const titles = { year: '올해', month: '이번 달', week: '이번 주' }

export function Rankings({ load, demo }: { load: (period: Period) => Promise<Rank[]>; demo: boolean }) {
  const [period, setPeriod] = useState<Period>('year')
  const [rows, setRows] = useState<Rank[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    setRows(null)
    setError('')
    load(period).then(rows => { if (current) setRows(rows) }).catch(error => { if (current) setError(error.message) })
    return () => { current = false }
  }, [period, load, retry])
  return <>
    <div className="intro"><div><h1>끝까지 올라간 사람들.</h1><p>처치한 보스 레벨, 그다음 보스에게 남긴 피해 순서로 비교합니다.</p></div></div>
    <div className="rank-tabs" role="tablist" aria-label="랭킹 기간">{(Object.keys(labels) as Period[]).map(kind => <button key={kind} role="tab" aria-selected={kind === period} data-rank={kind} onClick={() => setPeriod(kind)}>{labels[kind]}</button>)}</div>
    <section className="panel">
      <div className="section-head"><h2>{titles[period]}의 베스트</h2><small>{periods()[period]}부터 · 한국 시간</small></div>
      <div id="ranking-content" role="tabpanel">
        {error ? <><p className="error">{error}</p><button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></> :
          !rows ? <p className="loading">순위를 불러오는 중…</p> :
          rows.length ? <div style={{ overflowX: 'auto' }}><table className="rank-table"><thead><tr><th>순위</th><th>트레이너</th><th>처치 완료</th><th>다음 보스 피해</th></tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i} className={row.is_me ? 'me' : ''}><td>{row.rank}</td><td>{row.nickname} {row.is_me && <span className="pill">나</span>}<small>자가 입력 기록</small></td><td>Lv. {format(row.cleared)}</td><td>{format(row.damage)} HP{row.cleared < CAP ? <><small>Lv.{format(row.cleared + 1)}</small><div className="mini-progress"><i style={{ width: `${row.damage / hpAt(row.cleared + 1) * 100}%` }} /></div></> : <small>탑 정복</small>}</td></tr>)}</tbody>
          </table></div> : <div className="empty"><h2>아직 이번 기간의 기록이 없어요.</h2><p>보스에게 첫 공격을 남기고 순위에 참여하세요.</p><a href="#battle">보스 도전하기 →</a></div>}
      </div>
    </section>
    <div className="callout">매년 1월 1일 · 매월 1일 · 매주 월요일 00:00에 새 집계가 시작됩니다. 보스 진행도는 유지되고 해당 기간의 공격이 있어야 참여합니다. {demo && '지금은 내 체험 기록만 표시합니다.'}</div>
  </>
}
