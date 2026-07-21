import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  it('builds a route with repeated stop occurrences', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Stop 1 name'), 'A')
    await user.type(screen.getByLabelText('Stop 2 name'), 'B')
    for (const name of ['C', 'B', 'A']) {
      await user.click(screen.getByRole('button', { name: 'Add another stop' }))
      await user.type(screen.getByLabelText(`Stop ${screen.getAllByRole('listitem').length} name`), name)
    }

    expect(screen.getByLabelText('Stop 3 name')).toHaveValue('C')
    expect(screen.getByLabelText('Stop 4 name')).toHaveValue('B')
    expect(screen.getByLabelText('Stop 5 name')).toHaveValue('A')
    expect(screen.getAllByLabelText(/Distance from/)).toHaveLength(4)
  })

  it('calculates totals, warns about an unassigned leg, and then shows a reconciled split', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Stop 1 name'), 'Home')
    await user.type(screen.getByLabelText('Stop 2 name'), 'Work')
    await user.type(screen.getByLabelText(/Distance from Home to Work/), '30')
    await user.type(screen.getByLabelText('Fuel economy'), '15')
    await user.type(screen.getByLabelText('Price per litre'), '100')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    await user.type(screen.getByLabelText('Person 1 name'), 'Asha')

    expect(screen.getByText('₹200.00')).toBeInTheDocument()
    expect(screen.getByText('Some legs have no riders')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Asha rode from Home to Work' }))

    const resultsCard = screen.getByRole('heading', { name: 'Journey summary' }).closest<HTMLElement>('.results-card')!
    const split = within(resultsCard).getByText('Asha').closest<HTMLElement>('.split-row')!
    expect(within(split).getByText('₹200.00')).toBeInTheDocument()
    expect(screen.queryByText('Some legs have no riders')).not.toBeInTheDocument()
  })

  it('announces validation and requires confirmation before reset', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Calculate split' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)

    await user.type(screen.getByLabelText('Stop 1 name'), 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Reset trip' }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('Keep me')
    await user.click(screen.getByRole('button', { name: 'Reset trip' }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('')
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
