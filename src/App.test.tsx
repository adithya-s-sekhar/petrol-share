import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createBlankTripDraft } from './domain'
import { loadCurrentTrip, saveCurrentTrip, tripStorageConfig } from './persistence/tripStorage'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
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
  it('shows persistent labels, driver guidance, and searchable currency descriptions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Stop 1')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(screen.getByText('Passenger 1')).toBeVisible()
    expect(screen.getByText('Include the driver if they share the cost.')).toBeVisible()
    expect(screen.getByText(/Indian Rupee/)).toBeInTheDocument()
  })

  it('changes display units without changing the normalized journey cost', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'Home')
    await user.type(screen.getByLabelText('Stop 2 name'), 'Office')
    await user.type(screen.getByLabelText('Distance from Home to Office in kilometres'), '100')
    await user.type(screen.getByLabelText('Fuel economy'), '10')
    await user.type(screen.getByLabelText('Price per litre'), '100')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    await user.type(screen.getByLabelText('Person 1 name'), 'Asha')

    expect(screen.getByText('₹1,000.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'US customary' }))
    expect(screen.getByLabelText('Distance from Home to Office in miles')).toHaveValue(62.137119)
    expect(screen.getByLabelText('Fuel economy')).toHaveValue(23.521458)
    expect(screen.getByText('₹1,000.00')).toBeInTheDocument()
  })

  it('follows the system theme and persists explicit theme choices', async () => {
    const listeners = new Set<() => void>()
    let systemIsDark = true
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return systemIsDark },
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    })))
    const user = userEvent.setup()
    const view = render(<App />)

    const toggle = await screen.findByRole('button', { name: 'Theme: system. Switch theme' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    systemIsDark = false
    listeners.forEach((listener) => listener())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(toggle)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('petrol-share-theme')).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Theme: light. Switch theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    view.unmount()
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Theme: dark. Switch theme' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

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

  it('adds return stops without retyping and reuses reverse distances', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'A')
    await user.type(screen.getByLabelText('Stop 2 name'), 'B')
    await user.type(screen.getByLabelText('Distance from A to B in kilometres'), '10')
    await user.click(screen.getByRole('button', { name: 'Add another stop' }))
    await user.type(screen.getByLabelText('Stop 3 name'), 'C')
    await user.type(screen.getByLabelText('Distance from B to C in kilometres'), '20')

    await user.click(screen.getByRole('button', { name: 'Return to B' }))
    await user.click(screen.getByRole('button', { name: 'Return to A' }))

    expect(screen.getByLabelText('Stop 4 name')).toHaveValue('B')
    expect(screen.getByLabelText('Stop 5 name')).toHaveValue('A')
    expect(screen.getByLabelText('Distance from C to B in kilometres')).toHaveValue(20)
    expect(screen.getByLabelText('Distance from B to A in kilometres')).toHaveValue(10)
    expect(screen.getAllByText('Auto-filled')).toHaveLength(2)

    await user.clear(screen.getByLabelText('Distance from B to A in kilometres'))
    await user.type(screen.getByLabelText('Distance from B to A in kilometres'), '11')
    expect(screen.getAllByText('Auto-filled')).toHaveLength(1)
    expect(screen.getAllByText('Manual')).toHaveLength(3)
  })

  it('fills a blank reverse distance when the outward distance is entered later', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'A')
    await user.type(screen.getByLabelText('Stop 2 name'), 'B')
    await user.click(screen.getByRole('button', { name: 'Add another stop' }))
    await user.type(screen.getByLabelText('Stop 3 name'), 'A')

    await user.type(screen.getByLabelText('Distance from A to B in kilometres'), '12')
    await user.tab()

    expect(screen.getByLabelText('Distance from B to A in kilometres')).toHaveValue(12)
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
      await user.clear(distanceInputs[index])
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
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Riders from A to B' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeInTheDocument()
    assignment.focus()
    await user.keyboard(' ')
    expect(assignment).toBeChecked()

    const addStop = screen.getByRole('button', { name: 'Add another stop' })
    addStop.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Stop 3 name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset trip' })).toBeInTheDocument()
  })

  it('announces validation and uses a keyboard-accessible reset dialog', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Check trip details' }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    const firstStop = screen.getByLabelText('Stop 1 name')
    await waitFor(() => expect(firstStop).toHaveFocus())
    expect(firstStop).toHaveAccessibleDescription('Stop name is required')
    expect(screen.getByText('At least one person is required')).toHaveAttribute('role', 'alert')

    await user.type(firstStop, 'Keep me')
    const resetButton = screen.getByRole('button', { name: 'Reset trip' })
    await user.click(resetButton)
    const dialog = screen.getByRole('alertdialog', { name: 'Reset the complete trip?' })
    expect(dialog).toHaveAccessibleDescription(/stops, people, distances, assignments, and fuel settings/)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('Keep me')
    await waitFor(() => expect(resetButton).toHaveFocus())

    await user.click(resetButton)
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset trip' }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('')
    await waitFor(() => expect(screen.getByLabelText('Stop 1 name')).toHaveFocus())

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 1500 })
    const stored = await loadCurrentTrip()
    expect(stored.status).toBe('restored')
    if (stored.status === 'restored') expect(stored.draft.stops.every(({ name }) => name === '')).toBe(true)
  })

  it('undoes stop and rider removal with distances and assignments restored', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Stop 1 name'), 'A')
    await user.type(screen.getByLabelText('Stop 2 name'), 'B')
    await user.click(screen.getByRole('button', { name: 'Add another stop' }))
    await user.type(screen.getByLabelText('Stop 3 name'), 'C')
    await user.type(screen.getByLabelText('Distance from A to B in kilometres'), '12')
    await user.type(screen.getByLabelText('Distance from B to C in kilometres'), '23')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    await user.type(screen.getByLabelText('Person 1 name'), 'Asha')
    await user.click(screen.getByLabelText('Asha rode from B to C'))

    await user.click(screen.getByRole('button', { name: 'Remove stop 2' }))
    expect(screen.queryByLabelText('Stop 3 name')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Stop 2 name')).toHaveValue('B')
    expect(screen.getByLabelText('Distance from A to B in kilometres')).toHaveValue(12)
    expect(screen.getByLabelText('Distance from B to C in kilometres')).toHaveValue(23)
    expect(screen.getByLabelText('Asha rode from B to C')).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Remove Asha' }))
    expect(screen.queryByLabelText('Person 1 name')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Person 1 name')).toHaveValue('Asha')
    expect(screen.getByLabelText('Asha rode from B to C')).toBeChecked()
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
    await userEvent.setup().click(await screen.findByRole('button', { name: /Build your route/ }))
    expect(screen.getByLabelText('Stop 1 name')).toHaveValue('Home')
    expect(screen.getByLabelText('Stop 2 name')).toHaveValue('Office')
    expect(screen.getByLabelText(/Distance from Home to Office/)).toHaveValue(24)
    await userEvent.setup().click(screen.getByRole('button', { name: /Who was riding/ }))
    expect(screen.getByLabelText('Person 1 name')).toHaveValue('Asha')
    expect(screen.getByRole('checkbox', { name: 'Asha rode from Home to Office' })).toBeChecked()
    await userEvent.setup().click(screen.getByRole('button', { name: /Fuel details/ }))
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

  it('announces a save failure and lets the user retry successfully', async () => {
    const user = userEvent.setup()
    render(<App />)

    const firstStop = await screen.findByLabelText('Stop 1 name')
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Storage unavailable')
    })
    await user.type(firstStop, 'Retry me')

    const failure = await screen.findByRole('alert', {}, { timeout: 1500 })
    expect(failure).toHaveTextContent('Could not save changes')
    expect(screen.getByRole('status')).toHaveTextContent('Not saved')
    open.mockRestore()
    await user.click(within(failure).getByRole('button', { name: 'Try saving again' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'), { timeout: 1500 })
    expect(screen.queryByText('Could not save changes')).not.toBeInTheDocument()
    const loaded = await loadCurrentTrip()
    expect(loaded.status).toBe('restored')
    if (loaded.status === 'restored') expect(loaded.draft.stops[0].name).toBe('Retry me')
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
