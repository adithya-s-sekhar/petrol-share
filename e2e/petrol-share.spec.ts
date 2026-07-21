import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Plan the route. Split the ride.' })).toBeVisible()
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
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Home')
  await expect(page.getByLabel('Stop 2 name')).toHaveValue('Office')
  await expect(page.getByLabel('Asha rode from Home to Office')).toBeChecked()
  await expect(page.getByLabel('Ben rode from Home to Office')).toBeChecked()
  await expect(summary).toContainText('₹200.00')
})

test('shows validation and only resets a trip after confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Calculate split' }).click()

  await expect(page.getByLabel('Stop 1 name')).toBeFocused()
  await expect(page.getByText('Stop name is required').first()).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'At least one person is required' })).toBeVisible()

  await page.getByLabel('Stop 1 name').fill('Keep me')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Reset trip' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('Keep me')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reset trip' }).click()
  await expect(page.getByLabel('Stop 1 name')).toHaveValue('')
  await expect(page.getByLabel('Stop 2 name')).toHaveValue('')
})

test('provides mobile assignment cards without horizontal overflow', async ({ page }) => {
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

test('keeps the accessible desktop assignment matrix', async ({ page }) => {
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
