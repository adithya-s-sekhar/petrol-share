import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-IN' })

afterEach(() => {
  cleanup()
})
