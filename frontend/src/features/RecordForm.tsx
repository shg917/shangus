import { AXES, METRICS, SAMPLE, metricScore } from '../lib/core.js'
import { useState, type FormEvent } from 'react'
import { formatTime, parseTime } from '../lib/record-format'
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
      entries: METRICS.filter(metric => String(data.get(metric.code) ?? '').trim() !== '').map(metric => ({
        code: metric.code,
        value: metric.axis === 'cardio' ? parseTime(String(data.get(metric.code))) : Number(data.get(metric.code)),
        reps: metric.lift ? Number(data.get(metric.code + '-reps')) : 1,
      })),
    }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(collect(event.currentTarget))
  }
  return <>
    <div className="intro"><div><h1>기록을 골라,<br />나의 스탯으로.</h1>
      <p>14개 종목 중 하나만 입력해도 카드를 만들 수 있어요.</p></div></div>
    <div className="grid">
      <form key={revision} id="record-form" className="panel" onSubmit={onSubmit} onChange={event => change(collect(event.currentTarget))}>
        <div className="section-head"><h2>나의 운동 기록</h2>
          <button id="sample" type="button" className="text-button" onClick={() => { change(structuredClone(SAMPLE)); setRevision(value => value + 1) }}>예시 불러오기 ↗</button></div>
        <div className="body-fields">
          <label>체중 (kg)<input name="body_weight" type="number" min="25" max="300" step="0.1" required defaultValue={draft.body_weight || ''} /></label>
          <label>점수 계산 기준<select name="reference_sex" defaultValue={draft.reference_sex}><option value="m">남성 기준</option><option value="f">여성 기준</option></select></label>
        </div>
        {AXES.map(([axis, label]) => <fieldset className="record-axis" key={axis}>
          <legend>{label}<span>선택 입력</span></legend>
          <div className="metric-grid">{METRICS.filter(metric => metric.axis === axis).map(metric => {
            const entry = draft.entries.find(item => item.code === metric.code)
            const score = entry && Number.isFinite(entry.value) && entry.value >= metric.min && entry.value <= metric.max && draft.body_weight >= 25
              ? metricScore(entry, draft) : null
            const running = axis === 'cardio'
            return <div key={metric.code} className="metric">
              <label htmlFor={`metric-${metric.code}`}>{metric.label}</label>
              <div className="entry">
                <input id={`metric-${metric.code}`} name={metric.code} type={running ? 'text' : 'number'}
                  min={metric.min} max={metric.max} step={metric.lift ? .5 : 1}
                  pattern={running ? '[0-9]+|[0-9]{1,2}:[0-5][0-9](:[0-5][0-9])?' : undefined}
                  inputMode={running ? 'text' : 'decimal'} placeholder={running ? '분:초 / 시:분:초' : '선택'}
                  defaultValue={entry ? running ? formatTime(entry.value) : entry.value : ''} />
                {!running && <span className="unit">{metric.unit}</span>}
                {metric.lift && <><input className="reps" name={metric.code + '-reps'} type="number" min="1" max="12" aria-label={metric.label + ' 반복 횟수'} defaultValue={entry?.reps ?? 1} /><span className="unit">회</span></>}
              </div>
              <small>{metric.protocol}{running && ' · 초 단위 입력도 가능'}</small>
              <output className="metric-score" htmlFor={`metric-${metric.code}`}>{score == null ? '미입력' : `종목 점수 ${score.toFixed(1)} / 100`}</output>
            </div>
          })}</div>
        </fieldset>)}
        <div className="form-bottom"><p className="muted">종목별 임시 게임 점수입니다. 같은 축은 입력한 종목의 최고 점수를 반영합니다.</p>
          <button type="submit" className="primary" disabled={busy}>{saved ? '기록 갱신 · 즉시 반영' : '내 카드 만들기'} →</button></div>
      </form>
      <aside className="stack">
        <section className="panel"><h2>4가지 능력으로<br />만드는 나의 카드</h2>
          <ol className="steps">{[['근력', '기본 공격력'], ['근지구력', '턴당 타격 수'], ['순발력', '치명타 확률'], ['심폐지구력', '최대 HP']].map(([axis, value]) => <li key={axis}><div><strong>{axis}</strong>{value}</div></li>)}</ol>
          <p className="muted">입력하지 않은 축은 미측정으로 표시합니다. 전투는 해당 축의 기본 능력치로 시작합니다.</p>
        </section>
        <section className="panel"><h3>측정 기준</h3><p className="muted">푸시업·풀업은 연속 수행, 싯업은 1분 기록을 사용합니다. 달리기는 해당 거리를 완주한 시간을 넣어주세요.</p>
          <div className="callout">O.H.P와 D.L은 같은 무게도 다르게 환산됩니다. 종목을 추가하면 각 종목의 점수를 비교할 수 있어요.</div>
        </section>
      </aside>
    </div>
  </>
}
