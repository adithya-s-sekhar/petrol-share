import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders in the shared browser-like test environment', () => {
    render(<App />)

    expect(screen.getByText('App')).toBeInTheDocument()
    expect(indexedDB).toBeDefined()
  })
})
