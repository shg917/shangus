import { METRICS, SAMPLE } from '../lib/core.js'
import { useState, type FormEvent } from 'react'
import type { RecordInput } from '../types'

export function RecordForm({ draft, change, submit, busy, saved }: {
  draft: RecordInput; change: (draft: RecordInput) => void
  submit: (draft: RecordInput) => void; busy: boolean; saved: boolean
}) {
  const [revision, setRevision] = useState(0)
  function collect(form: HTMLFormElement): RecordInput {
    const data = new FormData(form)
    return {
      body_weight: Number(data.get('body_weight')),
      reference_sex: String(data.get('reference_sex')),
      entries: METRICS.filter(metric => data.get(metric.code) !== '').map(metric => ({
        code: metric.code, value: Number(data.get(metric.code)),
        reps: metric.lift ? Number(data.get(metric.code + '-reps')) : 1,
      })),
    }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(collect(event.currentTarget))
  }
  return <>
    <div className="intro"><div><h1>오늘의 기록,<br />내일의 전투력.</h1>
      <p>자신 있는 종목 하나부터. 모든 종목은 선택 입력이에요.</p></div></div>
    <div className="grid">
      <form key={revision} id="record-form" className="panel" onSubmit={onSubmit} onChange={event => change(collect(event.currentTarget))}>
        <div className="section-head"><h2>나의 운동 기록</h2>
          <button id="sample" type="button" className="text-button" onClick={() => { change(structuredClone(SAMPLE)); setRevision(value => value + 1) }}>예시 불러오기 ↗</button></div>
        <div className="body-fields">
          <label>체중 (kg)<input name="body_weight" type="number" min="25" max="300" step="0.1" required defaultValue={draft.body_weight || ''} /></label>
          <label>점수 계산 기준<select name="reference_sex" defaultValue={draft.reference_sex}><option value="m">남성 기준</option><option value="f">여성 기준</option></select></label>
        </div>
        <div className="metric-grid">{METRICS.map(metric => {
          const entry = draft.entries.find(item => item.code === metric.code)
          return <div key={metric.code} className="metric">
            <label htmlFor={`metric-${metric.code}`}>{metric.label}</label>
            <div className="entry">
              <input id={`metric-${metric.code}`} name={metric.code} type="number" min={metric.code === 'run5k' ? 600 : metric.lift ? 0.5 : 1} max={metric.max} step={metric.lift ? 0.5 : 1} placeholder="선택" defaultValue={entry?.value ?? ''} />
              <span className="unit">{metric.unit}</span>
              {metric.lift && <><input className="reps" name={metric.code + '-reps'} type="number" min="1" max="12" required aria-label={metric.label + ' 반복 횟수'} defaultValue={entry?.reps ?? 1} /><span className="unit">회</span></>}
            </div>
            <small>{metric.lift ? '1회는 실제 1RM · 2~12회는 추정 1RM' : metric.code === 'run5k' ? '예: 30분 = 1,800초' : metric.code === 'plank' ? '카드에 표시 · 전투 능력치에는 미반영' : '미입력은 미측정으로 표시'}</small>
          </div>
        })}</div>
        <div className="form-bottom"><p className="muted">자가 입력 기록을 게임 점수로 환산합니다.</p>
          <button type="submit" className="primary" disabled={busy}>{saved ? '기록 갱신 · 즉시 반영' : '내 카드 만들기'} →</button></div>
      </form>
      <aside className="stack">
        <section className="panel"><h2>기록으로 시작하는<br />나의 성장</h2><ol className="steps">
          <li><div><strong>나를 표현하는 카드</strong>종목별 기준으로 계산한 5축 프로필</div></li>
          <li><div><strong>기록이 전투 능력치로</strong>공격력 · 타격 수 · 치명타 · HP</div></li>
          <li><div><strong>9,999층까지 도전</strong>초과 피해는 다음 보스까지 이어져요</div></li>
        </ol></section>
        <section className="panel"><h3>더 강해졌다면, 바로 반영.</h3>
          <p className="muted">새 기록은 진행 중인 전투에도 적용됩니다. 최대 HP가 늘어도 현재 HP는 자동 회복되지 않아요.</p>
          <div className="callout">OHP 70kg과 데드리프트 70kg은 서로 다른 기준으로 평가합니다. 같은 축의 여러 종목은 최고 환산값을 사용합니다.</div>
        </section>
      </aside>
    </div>
  </>
}
