import { ArrowDown, Route } from 'lucide-react'
import { distanceFromKm, type TripDraft, type UnitSystem } from '../../../domain'
import { classes } from '../../styles'

type Props = {
  draft: TripDraft
  unitSystem: UnitSystem
  distanceUnit: string
}

export function RouteOverview({ draft, unitSystem, distanceUnit }: Props) {
  const hasUsableRoute = draft.stops.some(({ name }) => name.trim()) || draft.legs.some(({ distanceKm }) => distanceKm !== null)
  if (!hasUsableRoute) return null

  return (
    <section className={classes('route-overview')} aria-labelledby="route-overview-title">
      <div className={classes('route-overview-heading')}>
        <Route aria-hidden="true" />
        <div>
          <h3 id="route-overview-title">Route overview</h3>
          <p>Stop order and entered distances</p>
        </div>
      </div>
      <p className={classes('sr-only')}>{draft.stops.map((stop, index) => {
        const leg = draft.legs[index]
        const distance = leg?.distanceKm === null ? 'distance not entered' : leg ? `${distanceFromKm(leg.distanceKm, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${distanceUnit}` : ''
        return `Stop ${index + 1}: ${stop.name.trim() || 'unnamed'}${distance ? `; next leg ${distance}` : ''}`
      }).join('. ')}</p>
      <div className={classes('route-overview-list')} aria-hidden="true">
        {draft.stops.map((stop, index) => {
          const leg = draft.legs[index]
          const name = stop.name.trim() || `Stop ${index + 1}`
          return (
            <div key={stop.id}>
              <div><span aria-hidden="true">{index + 1}</span><strong>{name}</strong></div>
              {leg && (
                <div className={classes('route-overview-leg')}>
                  <ArrowDown aria-hidden="true" />
                  <span>{leg.distanceKm === null ? 'Distance not entered' : `${distanceFromKm(leg.distanceKm, unitSystem).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${distanceUnit}`}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
