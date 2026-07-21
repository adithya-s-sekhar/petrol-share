import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createBlankTripDraft } from './domain'
import { loadCurrentTrip, saveCurrentTrip, tripStorageConfig } from './persistence/tripStorage'

afterEach(() => vi.restoreAllMocks())
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

  it('announces validation and requires confirmation before reset', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Calculate split' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)

    await user.type(screen.getByLabelText('Stop 1 name'), 'Keep me')
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
    render(<App />)

    const firstStop = await screen.findByLabelText('Stop 1 name')
    await user.type(firstStop, 'Rapid edits')
    expect(screen.getByText('Saving…')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 1500 })
    const loaded = await loadCurrentTrip()
    expect(loaded.status).toBe('restored')
    if (loaded.status === 'restored') expect(loaded.draft.stops[0].name).toBe('Rapid edits')
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
