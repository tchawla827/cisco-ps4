import { formatCurrency } from '../format'
import type { RollupChangeView } from '../types/department'

interface ChangeCardProps {
  change: RollupChangeView
  preview: boolean
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
}

function signedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${prefix}INR ${Math.abs(value).toLocaleString('en-US')}`
}

export function ChangeCard({ change, preview }: ChangeCardProps) {
  const headcountDelta = change.after.team_headcount - change.before.team_headcount
  const payrollDelta = change.after.team_payroll - change.before.team_payroll

  return (
    <article className={`impact-card change-card${preview ? ' impact-card--preview' : ''}`}>
      <span className="impact-card__label">Δ CHANGED</span>
      <div className="impact-card__identity">
        <strong>{change.employee_id}</strong>
        <span>{change.role}</span>
      </div>
      <div className="impact-card__metric">
        <span>Headcount</span>
        <span>{change.before.team_headcount} → {change.after.team_headcount}</span>
        <strong>{signed(headcountDelta)}</strong>
      </div>
      <div className="impact-card__metric">
        <span>Payroll</span>
        <span>{formatCurrency(change.before.team_payroll)} → {formatCurrency(change.after.team_payroll)}</span>
        <strong>{signedCurrency(payrollDelta)}</strong>
      </div>
    </article>
  )
}
