export type Entry = { code: string; value: number; reps: number }
export type RecordInput = { body_weight: number; reference_sex: string; entries: Entry[] }
export type Stats = { power: number; hits: number; crit: number; max_hp: number }
export type Card = {
  id?: string
  input: RecordInput
  result: { axes: Record<string, number | null>; class: string; stats: Stats; version: string }
  created_at: string
}
export type Player = {
  level: number; cleared: number; boss_hp: number; hp: number; stats: Stats
  status: string; version: number; tickets: number
}
export type State = {
  player: Player; card: Card | null; profile: { nickname: string; avatar: string }
  daily_available: boolean; claimed: string[]; has_workout: boolean
  achievements: { label: string }[]
}
export type Period = 'year' | 'month' | 'week'
export type Rank = { rank: number; nickname: string; cleared: number; damage: number; is_me: boolean }
export type Attack = { player: Player; kills: number; effective: number; criticals: number; counter: number }
export type Request =
  | { action: 'record'; payload: RecordInput }
  | { action: 'start' | 'claim'; payload: { kind: string } }
  | { action: 'attack'; payload?: undefined }
