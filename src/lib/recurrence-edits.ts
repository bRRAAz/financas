import { addDays, daysBetween } from './dates'
import { occurrenceAt, occurrences } from './finance'
import type { Exception, Recurrence } from './types'

export function splitRecurrence(previous: Recurrence, cutoff: string, plannedDate: string, patch: Partial<Recurrence>,
  scope: 'future' | 'all', exceptions: Exception[]) {
  const startingOccurrence = occurrences(previous, cutoff, cutoff)[0]
  if (!startingOccurrence) throw new Error('A recorrência já foi alterada. Atualize a página.')
  const isAll = scope === 'all'
  const offset = isAll ? 0 : startingOccurrence.index
  const effectiveCutoff = isAll ? previous.start_date : cutoff
  const difference = daysBetween(cutoff, plannedDate)
  const start = isAll ? addDays(previous.start_date, difference) : plannedDate
  const next: Recurrence = {
    ...previous, ...patch, id: crypto.randomUUID(), start_date: start,
    anchor_day: difference === 0 ? previous.anchor_day ?? Number(previous.start_date.slice(-2)) : Number(start.slice(-2)),
    repeat_count: patch.repeat_count !== undefined ? patch.repeat_count : previous.repeat_count === null ? null : previous.repeat_count - offset,
    end_date: patch.end_date !== undefined ? patch.end_date : previous.end_date && addDays(previous.end_date, difference),
    superseded: false,
  }
  const dates: Record<string, string> = {}
  for (const item of exceptions) {
    if (item.recurrence_id !== previous.id || item.occurrence_date < effectiveCutoff) continue
    if (item.occurrence_date === cutoff && item.status === 'pending') continue
    const match = occurrences(previous, item.occurrence_date, item.occurrence_date)[0]
    if (!match || match.index < offset) continue
    const mapped = occurrenceAt(next, match.index - offset)
    if (occurrences(next, mapped, mapped).length) dates[item.occurrence_date] = mapped
  }
  return { next, dates, cutoff: effectiveCutoff }
}
