import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CollapsiblePanel } from './CollapsiblePanel'

afterEach(() => cleanup())

describe('CollapsiblePanel', () => {
  it('renders its title and children when expanded', () => {
    render(
      <CollapsiblePanel title="Employees" eyebrow="ROSTER" collapsed={false} onToggleCollapsed={vi.fn()} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('panel body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse employees/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('hides its body and title when collapsed, keeping only the toggle', () => {
    render(
      <CollapsiblePanel title="Employees" collapsed onToggleCollapsed={vi.fn()} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    expect(screen.queryByText('panel body')).not.toBeInTheDocument()
    expect(screen.queryByText('Employees')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand employees/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onToggleCollapsed when the toggle button is clicked', () => {
    const onToggleCollapsed = vi.fn()
    render(
      <CollapsiblePanel title="Employees" collapsed={false} onToggleCollapsed={onToggleCollapsed} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    screen.getByRole('button', { name: /collapse employees/i }).click()

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
  })
})
