const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza' })
const monthFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const dayMs = 86400000

export function today() {
  return dateFormat.format(new Date()).split('/').reverse().join('-')
}
export function monthOf(date: string) { return date.slice(0, 7) + '-01' }
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
}
export function daysBetween(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / dayMs
}
export function monthsBetween(start: string, end: string) {
  return (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7))
}
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(0)
  next.setUTCFullYear(year, month + months, 0)
  const last = next.getUTCDate()
  next.setUTCFullYear(year, month - 1 + months, Math.min(day, last))
  return next.toISOString().slice(0, 10)
}
export function endOfMonth(date: string) { return addDays(addMonths(monthOf(date), 1), -1) }
export function dateInMonth(month: string, day: number) {
  return month.slice(0, 8) + String(Math.min(day, Number(endOfMonth(month).slice(-2)))).padStart(2, '0')
}
export function weekday(date: string) { return new Date(date).getUTCDay() }
export function monthLabel(date: string) { return monthFormat.format(new Date(date)) }
export function brDate(date: string) { return date.split('-').reverse().join('/') }
export function shortDate(date: string) { return brDate(date).slice(0, 5) }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function brl(cents: number) { return currency.format(cents / 100) }
export function toCents(value: string) {
  const raw = value.trim().replace(/\s/g, '')
  const grouped = /^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)
  const normalized = (grouped ? raw.replace(/\./g, '') : raw).replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return NaN
  return Math.round(Number(normalized) * 100)
}
export function fromCents(value: number) { return (value / 100).toFixed(2).replace('.', ',') }
