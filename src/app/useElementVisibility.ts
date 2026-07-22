import { type RefObject, useEffect, useState } from 'react'

export function useElementVisibility<T extends Element>(ref: RefObject<T | null>, enabled: boolean, threshold = 0.15) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || !globalThis.IntersectionObserver) {
      setVisible(false)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold })
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, ref, threshold])

  return visible
}
