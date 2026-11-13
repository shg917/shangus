import type { Stats as Values } from '../types'

export const format = (value: number) => value.toLocaleString('ko-KR')

export function Stats({ values }: { values: Values }) {
  return <div className="stats">
    <div className="stat"><b>{format(values.power)}</b><span>근력 → 기본 공격력</span></div>
    <div className="stat"><b>{format(values.hits)}<small> 타</small></b><span>근지구력 → 타격 수</span></div>
    <div className="stat"><b>{values.crit}%</b><span>순발력 → 치명타</span></div>
    <div className="stat"><b>{format(values.max_hp)}</b><span>심폐 → 최대 HP</span></div>
  </div>
}
