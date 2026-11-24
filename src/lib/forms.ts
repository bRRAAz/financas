import { z } from 'zod'
import { toCents } from './dates'

export const nameField = (limit = 160) => z.string().trim().min(1, 'Informe um nome ou descrição.').max(limit, 'Texto muito longo.')
export const dateField = z.iso.date({ error: 'Informe uma data válida.' })
export const monthField = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe um mês válido.')
export const moneyField = (mode: 'positive' | 'nonnegative' | 'signed' = 'positive') => z.string().refine(value => {
  const amount = toCents(value)
  return Number.isSafeInteger(amount) && Math.abs(amount) <= 2147483647
    && (mode === 'signed' || (mode === 'positive' ? amount > 0 : amount >= 0))
}, { message: 'Informe um valor válido em reais.' })
export const frequencyField = z.enum(['weekly', 'fortnightly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'])
export const integerField = (min: number, max: number) => z.string().refine(value =>
  /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, { message: `Informe um número entre ${min} e ${max}.` })
export const optional = (schema: z.ZodType<string, string>) => z.union([z.literal(''), schema])
