import { formatCurrency } from '../format'
import type { TransferImpactView } from '../types/department'
import type { BannerMessage } from './MessageBanner'

interface TransferDropConfirmProps {
  employeeId: string
  newManagerId: string
  impact: TransferImpactView | null
  loading: boolean
  error: BannerMessage | null
  onConfirm: () => void
  onCancel: () => void
}

export function TransferDropConfirm({
  employeeId,
  newManagerId,
  impact,
  loading,
  error,
  onConfirm,
  onCancel,
}: TransferDropConfirmProps) {
  return (
    <div className="drop-confirm" role="dialog" aria-label="Confirm transfer">
      <p className="drop-confirm__title">
        Move <strong>{employeeId}</strong> to report to <strong>{newManagerId}</strong>?
      </p>
      {impact ? (
        <div className="drop-confirm__impact">
          <span>Subtree moved: {impact.moved_headcount} people · {formatCurrency(impact.moved_payroll)}</span>
          <span>Rollups affected: {impact.changed_rollup_ids.join(', ') || 'none'}</span>
        </div>
      ) : null}
      {error ? <p className="drop-confirm__error">{error.message}</p> : null}
      <div className="drop-confirm__actions">
        <button type="button" className="command-button" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className="command-button command-button--primary"
          onClick={onConfirm}
          disabled={loading || impact === null}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
