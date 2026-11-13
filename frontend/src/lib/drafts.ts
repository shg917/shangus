import { METRICS } from './core.js'
import type { RecordInput } from '../types'

export const emptyDraft = (): RecordInput => ({ body_weight: 75, reference_sex: 'm', entries: [] })
export const draftKey = (scope: string) => 'fitcard-draft-v2:' + scope
export function readDraft(scope: string): { input: RecordInput; pending: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(scope)) ?? 'null')
      ?? (scope === 'guest' || scope === 'demo' ? {
        input: JSON.parse(localStorage.getItem('fitcard-record-draft') ?? 'null'),
        pending: localStorage.getItem('fitcard-pending-record') === 'true',
      } : null)
    const input = saved?.input
    if (!input || !Array.isArray(input.entries)) return { input: emptyDraft(), pending: false }
    const entries = METRICS.flatMap(metric => {
      const entry = input.entries.find((item: RecordInput['entries'][number] | null) => item?.code === metric.code)
      return entry && Number.isFinite(entry.value)
        ? [{ code: metric.code, value: entry.value, reps: Number.isFinite(entry.reps) ? entry.reps : 1 }]
        : []
    })
    return {
      input: {
        body_weight: Number.isFinite(input.body_weight) ? input.body_weight : 75,
        reference_sex: input.reference_sex === 'f' ? 'f' : 'm', entries,
      },
      pending: saved.pending === true,
    }
  } catch {
    return { input: emptyDraft(), pending: false }
  }
}
export function writeDraft(scope: string, input: RecordInput, pending: boolean) {
  localStorage.setItem(draftKey(scope), JSON.stringify({ input, pending }))
}

export const oauthDraftKey = 'fitcard-oauth-draft'
export function takeOAuthDraft(): RecordInput | null {
  const raw = sessionStorage.getItem(oauthDraftKey)
  sessionStorage.removeItem(oauthDraftKey)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
