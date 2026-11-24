import { Wallet } from 'lucide-react'
import { appName } from '../lib/supabase'

export function Brand() {
  return <div className="brand">
    <div className="brand-icon"><Wallet size={18} strokeWidth={1.8} aria-hidden="true" /></div>
    <strong>{appName}</strong>
  </div>
}
