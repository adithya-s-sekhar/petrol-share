import { useEffect, useState } from 'react'

function viewportMatches(query: string) {
  const maxWidth = query.match(/max-width:\s*(\d+)px/)
  const minWidth = query.match(/min-width:\s*(\d+)px/)
  if (maxWidth) return window.innerWidth <= Number(maxWidth[1])
  if (minWidth) return window.innerWidth >= Number(minWidth[1])
  return false
}

export function useMediaQuery(query: string) {
  const getMatches = () => window.matchMedia?.(query).matches ?? viewportMatches(query)
  const [matches, setMatches] = useState(getMatches)

  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (media) {
      const update = () => setMatches(media.matches)
      update()
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    const updateFromViewport = () => setMatches(viewportMatches(query))
    updateFromViewport()
    window.addEventListener('resize', updateFromViewport)
    return () => window.removeEventListener('resize', updateFromViewport)
  }, [query])

  return matches
}
