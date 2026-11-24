import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { X, Inbox, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { addMonths, brl, monthLabel } from '../lib/dates'

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)) }

const buttonVariants = cva('button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap', {
  variants: { variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost', danger: 'button-danger' },
    size: { normal: '', small: 'button-small', icon: 'button-icon' } },
  defaultVariants: { variant: 'primary', size: 'normal' },
})

export function Button({ asChild, className, size, variant, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ size, variant }), className)} {...(!asChild ? { type: 'button' } : {})} {...props} />
}

export function Card({ title, description, action, children, className }: {
  title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return <section className={cn('card', className)}>
    {(title || action) && <header className="card-heading"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</header>}
    {children}
  </section>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><Inbox aria-hidden="true" size={24} /><p>{children}</p></div>
}

export function Modal({ title, description, onClose, children, wide = false }: {
  title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className={cn('dialog', wide && 'dialog-wide')} {...(description ? {} : { 'aria-describedby': undefined })}
        onCloseAutoFocus={event => {
          // Restore focus when a dialog is opened by a plain application button.
          event.preventDefault()
          document.querySelector<HTMLElement>('main h1')?.focus()
        }}>
        <header className="dialog-heading">
          <div><Dialog.Title>{title}</Dialog.Title>
            {description && <Dialog.Description>{description}</Dialog.Description>}</div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar"><X size={20} /></Button></Dialog.Close>
        </header>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

export function Confirm({ title, children, label = 'Excluir', busy, onClose, onConfirm }: {
  title: string; children: string; label?: string; busy: boolean; onClose: () => void; onConfirm: () => void
}) {
  return <Modal title={title} description={children} onClose={onClose}>
    <div className="form-actions">
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Aguarde…' : label}</Button>
    </div>
  </Modal>
}

export function Field({ label, error, children, full }: { label: string; error?: string; children: ReactNode; full?: boolean }) {
  return <label className={cn('field', full && 'field-full')}>
    <span>{label}</span>{children}{error && <span className="field-error" role="alert">{error}</span>}
  </label>
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-wrap"><select {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span>
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return <div className="month-picker" aria-label="Período de referência">
    <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => onChange(addMonths(month, -1))}><ChevronLeft size={17} /></Button>
    <label className="month-label">
      <span className="month-name">{monthLabel(month)}</span>
      <input type="month" aria-label="Selecionar mês e ano" value={month.slice(0, 7)}
        onClick={event => { try { event.currentTarget.showPicker?.() } catch { /* Keyboard entry remains available. */ } }}
        onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) onChange(event.target.value + '-01') }} />
      <ChevronDown size={14} aria-hidden="true" />
    </label>
    <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => onChange(addMonths(month, 1))}><ChevronRight size={17} /></Button>
  </div>
}

export function Money({ value, tone = false }: { value: number; tone?: boolean }) {
  return <span className={cn('money', tone && (value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'))}>{brl(value)}</span>
}

export function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>{action}</div>
}
