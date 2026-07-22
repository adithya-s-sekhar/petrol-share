import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Plan the route. Split the ride.' })).toBeVisible()
})

test('adds, assigns, edits, persists, and removes additional expenses', async ({ page }) => {
  test.setTimeout(60_000)
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('10')
  await page.getByLabel('Fuel economy').fill('10')
  await page.getByLabel('Price per litre').fill('100')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')
  await page.getByLabel('Asha rode from Home to Office').check()

  await page.getByRole('button', { name: 'Add expense' }).evaluate((button: HTMLButtonElement) => button.click())
  await page.getByLabel('Expense 1 name').fill('Parking')
  await page.getByLabel('Parking amount').fill('50')
  await page.getByLabel('Parking applies to').getByLabel('Selected riders').check()
  await page.getByLabel('Asha shares Parking').evaluate((input: HTMLInputElement) => input.click())
  await expect(page.getByText('Additional expenses').last()).toBeVisible()
  await expect(page.locator('#results').getByText('₹150.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Fuel ₹100.00 + expenses ₹50.00', { exact: true })).toBeVisible()

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Expense 1 name')).toHaveValue('Parking')
  await page.getByLabel('Parking amount').fill('60')
  await expect(page.locator('#results').getByText('₹160.00', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove Parking' }).click()
  await expect(page.getByLabel('Expense 1 name')).toHaveCount(0)
})

test('keeps additional-expense controls within a mobile viewport after scope changes', { tag: '@cross-browser' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')
  await page.getByRole('button', { name: 'Add expense' }).click()
  await page.getByLabel('Expense 1 name').fill('Parking at the railway station')
  await page.getByLabel('Parking at the railway station applies to').getByLabel('Selected riders').check()
  const scopeOptions = page.getByLabel('Parking at the railway station applies to').getByRole('radio')
  for (const radio of await scopeOptions.all()) {
    const box = await radio.boundingBox()
    expect(box?.width).toBe(18)
    expect(box?.height).toBe(18)
  }
  const riderChoice = page.locator('label').filter({ has: page.getByLabel('Asha shares Parking at the railway station') })
  await expect(riderChoice).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('keeps header actions separate at the narrowest supported viewport', { tag: '@cross-browser' }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const trips = page.getByRole('button', { name: 'Trips' })
  const saveStatus = page.getByRole('status').filter({ hasText: /Autosave|Saved|Saving/ })
  await expect(trips).toBeVisible()
  await expect(saveStatus).toBeVisible()

  const [tripsBox, statusBox] = await Promise.all([trips.boundingBox(), saveStatus.boundingBox()])
  expect(tripsBox).not.toBeNull()
  expect(statusBox).not.toBeNull()
  expect(tripsBox!.x + tripsBox!.width).toBeLessThanOrEqual(statusBox!.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('looks up an optional road distance and keeps it editable', { tag: '@cross-browser' }, async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/search**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')
    await route.fulfill({ json: [{ place_id: query === 'Home' ? 1 : 2, display_name: `${query}, Kerala`, lat: query === 'Home' ? '10' : '11', lon: query === 'Home' ? '76' : '77' }] })
  })
  await page.route('https://router.project-osrm.org/route/v1/driving/**', (route) => route.fulfill({ json: { code: 'Ok', routes: [{ distance: 42500 }] } }))

  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await expect(page.getByLabel('Distance from Home to Office in kilometres')).toHaveValue('')
  await page.getByRole('button', { name: 'Look up road distance' }).click()
  const dialog = page.getByRole('dialog', { name: 'Look up road distance' })
  await expect(dialog).toContainText('No request is made until you select an action')
  await dialog.getByRole('button', { name: 'Find places' }).click()
  await expect(dialog.getByRole('radiogroup', { name: 'Origin suggestions' })).toContainText('Home, Kerala')
  await dialog.getByRole('button', { name: 'Use road distance' }).click()
  await expect(page.getByLabel('Distance from Home, Kerala to Office, Kerala in kilometres')).toHaveValue('42.5')
  await expect(page.getByText('Looked up')).toBeVisible()
  await page.getByLabel('Distance from Home, Kerala to Office, Kerala in kilometres').fill('40')
  await expect(page.getByText('Manual')).toBeVisible()
})

test('contains long road-distance suggestions on desktop and mobile', { tag: '@cross-browser' }, async ({ page }) => {
  const longPlace = 'Central railway station entrance beside the international convention centre, Thiruvananthapuram, Kerala, India'
  await page.route('https://nominatim.openstreetmap.org/search**', (route) => route.fulfill({
    json: [{ place_id: 1, display_name: longPlace, lat: '10', lon: '76' }],
  }))
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByRole('button', { name: 'Look up road distance' }).click()
  const dialog = page.getByRole('dialog', { name: 'Look up road distance' })
  await dialog.getByRole('button', { name: 'Find places' }).click()

  for (const width of [1280, 815, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const choices = dialog.getByRole('radio')
    for (const radio of await choices.all()) {
      const box = await radio.boundingBox()
      expect(box?.width).toBe(18)
      expect(box?.height).toBe(18)
      const contained = await radio.evaluate((input) => {
        const option = input.closest('label')!
        const text = option.querySelector('span')!
        const optionRect = option.getBoundingClientRect()
        const textRect = text.getBoundingClientRect()
        return getComputedStyle(option).display === 'flex'
          && option.scrollWidth <= option.clientWidth
          && optionRect.left >= 0
          && optionRect.right <= window.innerWidth
          && textRect.left >= optionRect.left
          && textRect.right <= optionRect.right
      })
      expect(contained).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('uses vehicle and route presets and makes a safe editable round trip', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Cafe')
  await page.getByRole('button', { name: 'Add another stop' }).click()
  await page.getByLabel('Stop 3 name').fill('Office')
  await page.getByLabel('Distance from Home to Cafe in kilometres').fill('10')
  await page.getByLabel('Distance from Cafe to Office in kilometres').fill('15')
  await page.getByLabel('Fuel economy').fill('18')
  await page.getByLabel('Fuel type').fill('Petrol')

  await page.getByRole('button', { name: 'Make round trip' }).click()
  await expect(page.getByLabel('Stop 4 name')).toHaveValue('Cafe')
  await expect(page.getByLabel('Stop 5 name')).toHaveValue('Home')
  await expect(page.getByLabel('Distance from Office to Cafe in kilometres')).toHaveValue('15')
  await expect(page.getByLabel('Distance from Cafe to Home in kilometres')).toHaveValue('10')
  await page.getByLabel('Distance from Cafe to Home in kilometres').fill('11')

  await page.getByRole('button', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'Save vehicle preset' }).click()
  const vehicleDialog = page.getByRole('dialog', { name: 'Save vehicle preset' })
  await vehicleDialog.getByLabel('Preset name').fill('Family car')
  await vehicleDialog.getByLabel('Fuel economy (km/L)').fill('18')
  await vehicleDialog.getByLabel('Fuel type (optional)').fill('Petrol')
  await vehicleDialog.getByRole('button', { name: 'Save preset' }).click()
  await expect(page.getByRole('article', { name: 'Family car' })).toContainText('18 km/L · Petrol')

  await page.getByRole('article', { name: 'Untitled trip' }).getByRole('button', { name: 'Save template' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill('Preset journey')
  await page.getByLabel('Frequently used route').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Home')
  await expect(page.getByLabel('Distance from Cafe to Home in kilometres')).toHaveValue('11')

  await page.getByLabel('Fuel economy').fill('7')
  await page.getByRole('button', { name: 'Trips' }).click()
  const preset = page.getByRole('article', { name: 'Family car' })
  await preset.getByRole('button', { name: 'Use' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByLabel('Fuel economy')).toHaveValue('18')
  await expect(page.getByLabel('Fuel type')).toHaveValue('Petrol')

  await page.reload()
  await page.getByRole('button', { name: 'Trips' }).click()
  await preset.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Preset name').fill('Touring car')
  await page.getByRole('button', { name: 'Save preset' }).click()
  await expect(page.getByRole('article', { name: 'Touring car' })).toBeVisible()
  await page.getByRole('article', { name: 'Touring car' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete preset' }).click()
  await expect(page.getByRole('article', { name: 'Touring car' })).toHaveCount(0)
})

test('exports an editable link and previews it before adding it on another device', async ({ browser }) => {
  const senderContext = await browser.newContext()
  await senderContext.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => { (window as Window & { copiedEditableTrip?: string }).copiedEditableTrip = value; return Promise.resolve() },
      },
    })
  })
  const sender = await senderContext.newPage()
  await sender.goto('/')
  await sender.getByLabel('Stop 1 name').fill('Home')
  await sender.getByLabel('Stop 2 name').fill('Cafe')
  await sender.getByRole('button', { name: 'Add another stop' }).click()
  await sender.getByLabel('Stop 3 name').fill('Office')
  await sender.getByLabel('Distance from Home to Cafe in kilometres').fill('10')
  await sender.getByLabel('Distance from Cafe to Office in kilometres').fill('15')
  await sender.getByLabel('Fuel economy').fill('12')
  await sender.getByLabel('Price per litre').fill('105')
  await sender.getByRole('button', { name: 'Add person' }).click()
  await sender.getByLabel('Person 1 name').fill('Asha')
  await sender.getByLabel('Asha rode from Cafe to Office').check()
  await sender.getByRole('button', { name: 'US customary' }).click()
  await sender.getByRole('button', { name: 'Trips' }).click()
  await sender.getByRole('article', { name: 'Untitled trip' }).getByRole('button', { name: 'Rename' }).click()
  await sender.getByLabel('Trip name').fill('Shared commute')
  await sender.getByRole('button', { name: 'Save name' }).click()
  await sender.getByRole('button', { name: 'Copy editable link' }).click()
  await expect(sender.getByRole('status').filter({ hasText: /Editable trip link copied/ })).toBeVisible()
  const editableLink = await sender.evaluate(() => (window as Window & { copiedEditableTrip: string }).copiedEditableTrip)
  await senderContext.close()

  const recipientContext = await browser.newContext()
  const recipient = await recipientContext.newPage()
  await recipient.goto(editableLink)
  const preview = recipient.getByRole('dialog', { name: 'Preview imported trip' })
  await expect(preview).toContainText('Shared commute')
  await expect(preview).toContainText('Home → Cafe → Office')
  await expect(preview).toContainText('US customary')
  await expect(recipient.getByLabel('Stop 1 name')).toHaveValue('')
  await preview.getByRole('button', { name: 'Add as new trip' }).click()

  await expect(recipient.getByLabel('Stop 1 name')).toHaveValue('Home')
  await expect(recipient.getByLabel('Distance from Home to Cafe in miles')).toHaveValue('6.213712')
  await expect(recipient.getByLabel('Asha rode from Cafe to Office')).toBeChecked()
  await expect(recipient.getByRole('button', { name: 'Share summary' })).toBeVisible()
  await recipient.getByRole('button', { name: 'Trips' }).click()
  await expect(recipient.getByRole('article', { name: 'Shared commute' })).toBeVisible()
  await expect(recipient.getByRole('article', { name: 'Untitled trip' })).toBeVisible()

  const fileInput = recipient.locator('input[type=file]')
  await fileInput.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await expect(recipient.getByRole('alert')).toContainText('not a valid Petrol Share trip')
  await recipientContext.close()
})

test('manages independent saved trips, templates, and recently deleted recovery', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('25')
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()

  await page.getByRole('button', { name: 'Trips' }).click()
  const original = page.getByRole('article', { name: 'Untitled trip' })
  await original.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Trip name').fill('Commute')
  await page.getByRole('button', { name: 'Save name' }).click()

  const commute = page.getByRole('article', { name: 'Commute', exact: true })
  await commute.getByRole('button', { name: 'Duplicate' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByLabel('Stop 1 name').fill('Gym')
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()

  await page.getByRole('button', { name: 'Trips' }).click()
  await page.getByRole('article', { name: 'Commute', exact: true }).getByRole('button', { name: 'Open' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Home')

  await page.getByRole('button', { name: 'Trips' }).click()
  await page.getByRole('article', { name: 'Commute', exact: true }).getByRole('button', { name: 'Save template' }).click()
  const template = page.getByRole('article', { name: 'Commute template' })
  await expect(template).toContainText('Template')
  await template.getByRole('button', { name: 'Use template' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Home')
  await expect(page.getByText('Add people to start assigning riders.')).toBeVisible()

  await page.getByRole('button', { name: 'Trips' }).click()
  await page.getByRole('article', { name: 'Commute copy' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toContainText('Recently deleted')
  await page.getByRole('button', { name: 'Move to Recently deleted' }).click()
  await page.getByText('Recently deleted', { exact: true }).click()
  const deleted = page.getByRole('heading', { name: 'Commute copy' }).locator('xpath=ancestor::article')
  await deleted.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('article', { name: 'Commute copy' })).toContainText('Gym → Office')
})

test('keeps labels visible and switches display units without changing cost', async ({ page }) => {
  await expect(page.getByText('Stop 1', { exact: true })).toBeVisible()
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('100')
  await page.getByLabel('Fuel economy').fill('10')
  await page.getByLabel('Price per litre').fill('100')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')

  await expect(page.getByText('Passenger 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Include the driver if they share the cost.')).toBeVisible()
  await expect(page.getByText('₹1,000.00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'US customary' }).click()
  await expect(page.getByLabel('Distance from Home to Office in miles')).toHaveValue('62.137119')
  await expect(page.getByLabel('Fuel economy')).toHaveValue('23.521458')
  await expect(page.getByText('₹1,000.00', { exact: true })).toBeVisible()
})

test('calculates and persists a fair split for a local trip', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('30')
  await page.getByLabel('Fuel economy').fill('15')
  await page.getByLabel('Price per litre').fill('100')

  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 2 name').fill('Ben')
  await page.getByLabel('Asha rode from Home to Office').check()
  await page.getByLabel('Ben rode from Home to Office').check()

  const summary = page.getByRole('heading', { name: 'Journey summary' }).locator('xpath=ancestor::section')
  await expect(summary).toContainText('30 km')
  await expect(summary).toContainText('2 L')
  await expect(summary).toContainText('₹200.00')
  await expect(summary).toContainText('Asha30 km · 1 leg₹100.00')
  await expect(summary).toContainText('Ben30 km · 1 leg₹100.00')

  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Build your route/ }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Home')
  await expect(page.getByLabel('Stop 2 name')).toHaveValue('Office')
  await page.getByRole('button', { name: /Who was riding/ }).click()
  await expect(page.getByLabel('Asha rode from Home to Office')).toBeChecked()
  await expect(page.getByLabel('Ben rode from Home to Office')).toBeChecked()
  await expect(summary).toContainText('₹200.00')
})

test('checks incomplete details, focuses validation, and only resets after in-app confirmation', async ({ page }) => {
  await expect(page.getByText('Once they are valid, the split updates automatically.')).toBeVisible()
  await page.getByRole('button', { name: 'Check trip details' }).click()

  await expect(page.getByLabel('Stop 1 name')).toBeFocused()
  await expect(page.getByText('Stop name is required').first()).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'At least one person is required' })).toBeVisible()

  await page.getByLabel('Stop 1 name').fill('Keep me')
  await page.getByRole('button', { name: 'Reset trip' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset the complete trip?' })
  await expect(dialog).toContainText('distances, assignments, and fuel settings')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Keep me')
  await expect(page.getByRole('button', { name: 'Reset trip' })).toBeFocused()

  await page.getByRole('button', { name: 'Reset trip' }).click()
  await dialog.getByRole('button', { name: 'Reset trip' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('')
  await expect(page.getByLabel('Stop 2 name')).toHaveValue('')
  await expect(page.getByLabel('Stop 1 name')).toBeFocused()
})

test('undo restores removed stops, distances, riders, and assignments', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('A')
  await page.getByLabel('Stop 2 name').fill('B')
  await page.getByRole('button', { name: 'Add another stop' }).click()
  await page.getByLabel('Stop 3 name').fill('C')
  await page.getByLabel('Distance from A to B in kilometres').fill('12')
  await page.getByLabel('Distance from B to C in kilometres').fill('23')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')
  await page.getByLabel('Asha rode from B to C').check()

  await page.getByRole('button', { name: 'Remove stop 2' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Stop 2 name')).toHaveValue('B')
  await expect(page.getByLabel('Distance from A to B in kilometres')).toHaveValue('12')
  await expect(page.getByLabel('Distance from B to C in kilometres')).toHaveValue('23')
  await expect(page.getByLabel('Asha rode from B to C')).toBeChecked()

  await page.getByRole('button', { name: 'Remove Asha' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Person 1 name')).toHaveValue('Asha')
  await expect(page.getByLabel('Asha rode from B to C')).toBeChecked()
})

test('shows live results, explains the calculation, and updates after a valid edit', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('30')
  await page.getByLabel('Fuel economy').fill('15')
  await page.getByLabel('Price per litre').fill('100')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')
  await page.getByLabel('Asha rode from Home to Office').check()

  const summary = page.getByRole('heading', { name: 'Journey summary' }).locator('xpath=ancestor::section')
  await expect(summary).toContainText('This split updates automatically as you edit trip details.')
  await expect(summary).toContainText('₹200.00')
  await expect(page.getByRole('button', { name: 'Check trip details' })).toHaveCount(0)

  await page.getByText('How this was calculated').click()
  await expect(summary).toContainText('30 km ÷ 15 km/L = 2 L')
  await expect(summary).toContainText('Home → Office')
  await expect(summary).toContainText('₹200.00 each for Asha')
  await expect(summary).toContainText('largest fractional remainders')

  await page.getByLabel('Distance from Home to Office in kilometres').fill('45')
  await expect(summary).toContainText('3 L')
  await expect(summary).toContainText('₹300.00')
  await expect(summary).toContainText('45 km ÷ 15 km/L = 3 L')
})

test('provides mobile assignment cards without horizontal overflow', { tag: '@cross-browser' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const stops = Array.from({ length: 9 }, (_, index) => `Long stop name ${index + 1}`)
  await page.getByLabel('Stop 1 name').fill(stops[0])
  await page.getByLabel('Stop 2 name').fill(stops[1])
  for (let index = 2; index < stops.length; index += 1) {
    await page.getByRole('button', { name: 'Add another stop' }).click()
    await page.getByLabel(`Stop ${index + 1} name`).fill(stops[index])
  }
  for (let index = 0; index < 8; index += 1) {
    await page.getByRole('button', { name: 'Add person' }).click()
    await page.getByLabel(`Person ${index + 1} name`).fill(`Rider ${index + 1}`)
  }

  const touchTargets = [
    page.getByRole('button', { name: 'Theme: system. Switch theme' }),
    page.getByRole('button', { name: 'Reset trip' }),
    page.getByRole('button', { name: 'Move stop 2 up' }),
    page.getByRole('button', { name: 'Remove stop 2' }),
    page.getByRole('button', { name: 'Remove Rider 1' }),
  ]

  for (const target of touchTargets) {
    const box = await target.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }

  await expect(page.getByRole('table')).toBeHidden()
  const firstLeg = page.getByRole('region', { name: `Riders from ${stops[0]} to ${stops[1]}` })
  await expect(firstLeg).toContainText(stops[0])
  await expect(firstLeg).toContainText(stops[1])
  await firstLeg.getByRole('button', { name: 'Select all' }).click()
  await expect(firstLeg.getByRole('checkbox')).toHaveCount(8)
  for (const checkbox of await firstLeg.getByRole('checkbox').all()) await expect(checkbox).toBeChecked()
  await firstLeg.getByLabel(`Rider 1 rode from ${stops[0]} to ${stops[1]}`).uncheck()
  await expect(firstLeg.getByLabel(`Rider 1 rode from ${stops[0]} to ${stops[1]}`)).not.toBeChecked()

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})

test('keeps the accessible desktop assignment matrix', { tag: '@cross-browser' }, async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Passenger' })).toBeVisible()
  await expect(table.getByRole('rowheader', { name: 'Asha' })).toBeVisible()
  await table.getByLabel('Asha rode from Home to Office').check()
  await expect(table.getByLabel('Asha rode from Home to Office')).toBeChecked()
})

test('collapses completed sections into editable summaries and manages focus', async ({ page }) => {
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('48')

  await page.getByRole('button', { name: 'Done with route' }).click()
  const routeSummary = page.getByRole('button', { name: /Build your route.*2 stops · 48 km/ })
  await expect(routeSummary).toBeVisible()
  await expect(page.getByLabel('Fuel economy')).toBeFocused()

  await routeSummary.click()
  await expect(page.getByLabel('Stop 1 name')).toBeFocused()
  await page.getByLabel('Stop 2 name').fill('Studio')
  await expect(page.getByLabel('Distance from Home to Studio in kilometres')).toHaveValue('48')
})

test('keeps a mobile result shortcut visible without obscuring the result', { tag: '@cross-browser' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('Stop 1 name').fill('Home')
  await page.getByLabel('Stop 2 name').fill('Office')
  await page.getByLabel('Distance from Home to Office in kilometres').fill('30')
  await page.getByLabel('Fuel economy').fill('15')
  await page.getByLabel('Price per litre').fill('100')
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.getByLabel('Person 1 name').fill('Asha')

  const shortcut = page.getByRole('link', { name: 'View split · ₹200.00' })
  await expect(shortcut).toBeVisible()
  await shortcut.click()
  await expect(page).toHaveURL(/#results$/)
  await expect(page.getByRole('heading', { name: 'Journey summary' })).toBeInViewport()
  await expect(shortcut).toBeHidden()
})
