import { Columns2, RefreshCw, RotateCcw } from 'lucide-react'

import type { ScenarioView } from '../types/department'

interface AppHeaderProps {
  scenarios: ScenarioView[]
  scenario: string
  loading: boolean
  hasDepartment: boolean
  compareOpen: boolean
  onScenarioChange: (scenario: string) => void
  onLoad: () => void
  onReset: () => void
  onCompareToggle: () => void
}

export function AppHeader({
  scenarios,
  scenario,
  loading,
  hasDepartment,
  compareOpen,
  onScenarioChange,
  onLoad,
  onReset,
  onCompareToggle,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__identity">
        <span className="app-header__eyebrow">UNIVERSITY OPERATIONS</span>
        <span className="app-header__title">Department payroll</span>
      </div>

      <div className="app-header__controls" aria-label="Department controls">
        <label className="scenario-control">
          <span>Scenario</span>
          <select
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value)}
            disabled={loading || scenarios.length === 0}
            aria-label="Scenario"
          >
            {scenarios.length === 0 ? <option>Loading scenarios</option> : null}
            {scenarios.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="command-button command-button--primary" type="button" onClick={onLoad} disabled={loading}>
          <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
          <span>{loading ? 'Loading' : 'Load'}</span>
        </button>
        <button className="command-button" type="button" onClick={onReset} disabled={loading || !hasDepartment}>
          <RotateCcw aria-hidden="true" size={16} strokeWidth={2} />
          <span>Reset</span>
        </button>
        <button
          className={`icon-command${compareOpen ? ' icon-command--active' : ''}`}
          type="button"
          onClick={onCompareToggle}
          aria-pressed={compareOpen}
          aria-label="Toggle comparison workspace"
          title="Compare original and current department"
          disabled={!hasDepartment}
        >
          <Columns2 aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
