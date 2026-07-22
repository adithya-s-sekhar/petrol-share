import { CODEX_URL } from '../../constants'

export function AppFooter() {
  return (
    <footer>
      <span>Made for fair journeys.</span>
      <a href={CODEX_URL} target="_blank" rel="noreferrer">
        Made with Codex
      </a>
    </footer>
  )
}
