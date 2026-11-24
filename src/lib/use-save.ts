import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFinance } from './context'

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23505') return 'Já existe um registro com esses dados.'
    if (error.code === '23503') return 'O registro está vinculado a outros dados.'
    if (error.code === '23514') return 'Revise os valores e as datas do formulário.'
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if (/^A recorrência/.test(error.message)) return error.message
  }
  return 'Não foi possível concluir a ação. Tente novamente.'
}

export function useSave() {
  const { notice, user } = useFinance()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (action: { run: () => Promise<void>; message: string; done?: () => void }) => {
      await action.run()
      await client.invalidateQueries({ queryKey: ['finance', user?.id ?? 'demo'] })
    },
    onSuccess: (_, action) => { notice(action.message); action.done?.() },
    onError: error => notice(errorMessage(error), true),
  })
}
