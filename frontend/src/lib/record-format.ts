import type { Entry } from '../types'
import { METRICS } from './core.js'

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const rest = Math.floor(seconds % 60)
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`
}

export function parseTime(value: string) {
  if (!value.includes(':')) return Number(value)
  if (!/^\d{1,2}:[0-5]\d(?::[0-5]\d)?$/.test(value)) return NaN
  return value.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0)
}

export function formatEntry(entry: Entry) {
  const metric = METRICS.find(item => item.code === entry.code)
  if (!metric) return ''
  if (metric.axis === 'cardio') return formatTime(entry.value)
  return `${entry.value} ${metric.unit}${metric.lift ? ' × ' + entry.reps + '회' : ''}`
}
