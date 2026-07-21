import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createBlankTripDraft } from './domain'
import { loadCurrentTrip, saveCurrentTrip, tripStorageConfig } from './persistence/tripStorage'

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
})
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(tripStorageConfig.databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
})

describe('App', () => {
  it('builds a route with repeated stop occurrences', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'A')
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

    await user.type(await screen.findByLabelText('Stop 1 name'), 'Home')
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

  it('builds and fairly splits the representative return journey through visible controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    const stopNames = ['A', 'B', 'C', 'B', 'A']
    for (let index = 2; index < stopNames.length; index += 1) {
      await user.click(await screen.findByRole('button', { name: 'Add another stop' }))
    }
    for (const [index, name] of stopNames.entries()) {
      await user.type(screen.getByLabelText(`Stop ${index + 1} name`), index === 2 ? 'X' : name)
    }
    await user.clear(screen.getByLabelText('Stop 3 name'))
    await user.type(screen.getByLabelText('Stop 3 name'), 'C')

    const distanceInputs = screen.getAllByLabelText(/Distance from .+ to .+ in kilometres/)
    for (const [index, distance] of ['10', '20', '30', '40'].entries()) {
      await user.type(distanceInputs[index], distance)
    }
    await user.type(screen.getByLabelText('Fuel economy'), '10')
    await user.type(screen.getByLabelText('Price per litre'), '100')

    for (const name of ['Asha', 'Ben']) {
      await user.click(screen.getByRole('button', { name: 'Add person' }))
      await user.type(screen.getByLabelText(`Person ${screen.getAllByLabelText(/Person \d+ name/).length} name`), name)
    }

    const ashaAssignments = screen.getAllByRole<HTMLInputElement>('checkbox', { name: /^Asha rode/ })
    const benAssignments = screen.getAllByRole<HTMLInputElement>('checkbox', { name: /^Ben rode/ })
    await user.click(ashaAssignments[0])
    await user.click(benAssignments[2])

    const warning = screen.getByText('Some legs have no riders').closest<HTMLElement>('.warning-notice')!
    expect(within(warning).getAllByRole('listitem')).toHaveLength(2)
    expect(within(warning).getByText('B → C')).toBeInTheDocument()
    expect(within(warning).getByText('B → A')).toBeInTheDocument()
    expect(screen.queryByText('₹750.00')).not.toBeInTheDocument()

    for (const checkbox of ashaAssignments) {
      if (!checkbox.checked) await user.click(checkbox)
    }
    await user.click(benAssignments[1])

    expect(screen.queryByText('Some legs have no riders')).not.toBeInTheDocument()
    const results = screen.getByRole('heading', { name: 'Journey summary' }).closest<HTMLElement>('.results-card')!
    expect(within(results).getByText('100 km')).toBeInTheDocument()
    expect(within(results).getByText('10 L')).toBeInTheDocument()
    expect(within(results).getByText('₹1,000.00')).toBeInTheDocument()
    expect(within(within(results).getByText('Asha').closest<HTMLElement>('.split-row')!).getByText('₹750.00')).toBeInTheDocument()
    expect(within(within(results).getByText('Ben').closest<HTMLElement>('.split-row')!).getByText('₹250.00')).toBeInTheDocument()
  })

  it('keeps assignment information and keyboard actions available at mobile width', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    window.dispatchEvent(new Event('resize'))
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'A')
    await user.type(screen.getByLabelText('Stop 2 name'), 'B')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    await user.type(screen.getByLabelText('Person 1 name'), 'Asha')

    const assignment = screen.getByRole('checkbox', { name: 'Asha rode from A to B' })
    expect(screen.getByRole('columnheader', { name: 'AB' })).toBeInTheDocument()
    assignment.focus()
    await user.keyboard(' ')
    expect(assignment).toBeChecked()

    const addStop = screen.getByRole('button', { name: 'Add another stop' })
    addStop.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Stop 3 name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset trip' })).toBeInTheDocument()
  })

  it('announces validation and requires confirmation before reset', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Calculate split' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    const firstStop = screen.getByLabelText('Stop 1 name')
    expect(firstStop).toHaveFocus()
    expect(firstStop).toHaveAccessibleDescription('Stop name is required')
    expect(screen.getByText('At least one person is required')).toHaveAttribute('role', 'alert')

    await user.type(firstStop, 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Reset trip' }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('Keep me')
    await user.click(screen.getByRole('button', { name: 'Reset trip' }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('')
    expect(confirm).toHaveBeenCalledTimes(2)

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 1500 })
    const stored = await loadCurrentTrip()
    expect(stored.status).toBe('restored')
    if (stored.status === 'restored') expect(stored.draft.stops.every(({ name }) => name === '')).toBe(true)
  })

  it('restores a complete saved trip before showing the editor', async () => {
    const draft = createBlankTripDraft({ createId: (() => {
      let id = 0
      return () => `id-${++id}`
    })(), now: () => new Date('2026-07-22T00:00:00.000Z') })
    draft.stops[0].name = 'Home'
    draft.stops[1].name = 'Office'
    draft.legs[0].distanceKm = 24
    draft.people = [{ id: 'person-1', name: 'Asha', assignedLegIds: [draft.legs[0].id] }]
    draft.fuelSettings = { fuelEconomyKmpl: 12, fuelPricePerLitre: 100, currency: 'INR' }
    await saveCurrentTrip(draft)

    render(<App />)

    expect(screen.getByText('Loading your trip…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Stop 1 name')).toHaveValue('Home')
    expect(screen.getByLabelText('Stop 2 name')).toHaveValue('Office')
    expect(screen.getByLabelText(/Distance from Home to Office/)).toHaveValue(24)
    expect(screen.getByLabelText('Person 1 name')).toHaveValue('Asha')
    expect(screen.getByRole('checkbox', { name: 'Asha rode from Home to Office' })).toBeChecked()
    expect(screen.getByLabelText('Fuel economy')).toHaveValue(12)
    expect(screen.getByLabelText('Price per litre')).toHaveValue(100)
  })

  it('debounces rapid incomplete edits and persists the latest draft', async () => {
    const user = userEvent.setup()
    const view = render(<App />)

    const firstStop = await screen.findByLabelText('Stop 1 name')
    await user.type(firstStop, 'Rapid edits')
    expect(screen.getByText('Saving…')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 1500 })
    const loaded = await loadCurrentTrip()
    expect(loaded.status).toBe('restored')
    if (loaded.status === 'restored') expect(loaded.draft.stops[0].name).toBe('Rapid edits')

    view.unmount()
    render(<App />)
    expect(await screen.findByLabelText('Stop 1 name')).toHaveValue('Rapid edits')
  })

  it.each([
    ['an outdated record', { schemaVersion: 0 }],
    ['a malformed record', { schemaVersion: 1, stops: 'broken' }],
  ])('recovers safely from %s', async (_description, record) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(tripStorageConfig.databaseName, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(tripStorageConfig.storeName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(tripStorageConfig.storeName, 'readwrite')
    transaction.objectStore(tripStorageConfig.storeName).put(record, tripStorageConfig.currentTripKey)
    await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve() })
    database.close()

    render(<App />)

    expect(await screen.findByLabelText('Stop 1 name')).toHaveValue('')
    expect(screen.getByText(/could not be restored/)).toBeInTheDocument()
  })
})
