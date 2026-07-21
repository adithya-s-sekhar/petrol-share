# Petrol Share Implementation Plan

## Summary

Build the current Vite scaffold into a mobile-first, offline-capable React application for defining an ordered journey, assigning people to individual legs, and splitting fuel costs equally among each leg's occupants.

The implementation will use a single autosaved trip, configurable ISO currency defaulting to INR, and deterministic minor-unit rounding so displayed person totals exactly match the rounded journey total.

## Implementation Changes

### Trip editor and interface

- Replace the placeholder UI with one responsive page containing:
  - Ordered itinerary editor.
  - Fuel economy, fuel price, and currency controls.
  - People and leg-assignment matrix.
  - Journey totals and per-person results.
- Model the itinerary as ordered stop occurrences so names may repeat for return journeys such as `A → B → C → B → A`.
- Allow stops to be added, renamed, removed, and moved. Each adjacent pair forms a leg with its own positive distance in kilometres.
- Preserve a leg's distance and assignments when its two adjacent stop IDs remain unchanged. Create a blank leg and discard obsolete assignments when route editing changes adjacency.
- Allow people to be added, renamed, and removed. Require trimmed, case-insensitively unique names.
- Use accessible labelled controls, keyboard-operable actions, validation messages, responsive tables/cards, and Lucide icons. Confirm before resetting the complete trip.

### Types, validation, and calculations

- Introduce these core domain interfaces:
  - `TripDraft`: schema version, ordered stops, legs, people, fuel settings, and update timestamp.
  - `Stop`: stable ID and display name.
  - `Leg`: stable ID, source/destination stop IDs, and distance in kilometres.
  - `Person`: stable ID, name, and assigned leg IDs.
  - `FuelSettings`: fuel economy in km/L, price per litre, and ISO 4217 currency code.
  - `TripResult` and `PersonResult`: journey totals, travelled distance, assigned legs, raw cost, and reconciled display cost.
- Validate persisted and editable data with Zod:
  - At least two named stops and one person.
  - Finite, positive leg distances, fuel economy, and fuel price.
  - Valid leg references and person assignments.
  - A three-letter currency accepted by `Intl.NumberFormat`.
- Calculate:
  - `totalDistanceKm = sum(leg distances)`.
  - `totalLitres = totalDistanceKm / fuelEconomyKmpl`.
  - `totalCost = totalLitres × fuelPricePerLitre`.
  - Each person's distance as the sum of their assigned legs.
  - Each person's raw cost as the sum of each assigned leg's fuel cost divided by that leg's occupant count.
- Continue showing valid journey totals when assignments are incomplete, but withhold the final per-person cost split and identify every positive-distance leg without an occupant.
- Determine currency precision through `Intl.NumberFormat`. Reconcile person costs using the largest-remainder method:
  - Round the journey total to minor units.
  - Floor each aggregated raw person share to minor units.
  - Distribute remaining units by descending fractional remainder, resolving ties by person creation order.
  - Format all monetary output with the selected currency.
- Keep calculation and route-normalization logic as pure functions independent of React.

### Persistence, PWA, and deployment

- Use native IndexedDB with one database/object store record for the current `TripDraft`.
- Autosave complete and incomplete edits after a short debounce and restore them before rendering the editor.
- Validate restored data with Zod. If it is missing, outdated, or corrupt, initialize a safe two-stop blank draft and let the user reset without crashing.
- Add loading and saved-state feedback and prevent the initial blank state from overwriting persisted data before hydration finishes.
- Configure `vite-plugin-pwa` with:
  - An installable manifest, standalone display, Petrol Share branding, theme colors, and base-aware start URL/scope.
  - 192px, 512px, maskable, and Apple touch icons.
  - Precached application assets and automatic service-worker updates.
  - Offline navigation support for the single-page application.
- Add `lucide-react`, Vitest, React Testing Library, `user-event`, `jest-dom`, `jsdom`, and `fake-indexeddb`; add `test` and `test:watch` package scripts.
- Configure Vite's production base as `/petrol-share/` only in the GitHub Pages workflow, retaining `/` for local development.
- Add GitHub Actions that:
  - On pull requests and pushes, install with frozen pnpm lockfile, lint, test, and build.
  - On successful pushes to `main`, upload `dist` and deploy it to GitHub Pages with the required Pages permissions and concurrency protection.
- Replace the scaffold README with local development, calculation, persistence, testing, PWA installation, and deployment documentation.

## Test Plan

- Unit-test totals for single and multi-leg journeys, repeated locations, differing occupant groups, and people travelling only part of a route.
- Verify equal per-leg division, per-person distances and leg lists, and conservation of unrounded cost.
- Test deterministic rounding for currencies with zero, two, and three minor digits, including tied remainders and totals that would otherwise differ by one minor unit.
- Test invalid numbers, duplicate names, stale references, malformed persisted data, and unoccupied legs.
- Test route mutations preserve unchanged legs while removing obsolete assignments.
- Test the UI flow for building an `A → B → C → B → A` trip, assigning passengers, editing inputs, viewing totals, validation, and resetting.
- Test IndexedDB hydration, debounced autosave, reload restoration, and corrupt-record recovery with `fake-indexeddb`.
- Run lint, tests, TypeScript compilation, production build, and a PWA manifest/service-worker build check as acceptance gates.

## Assumptions and Acceptance Criteria

- All distances use kilometres, fuel economy uses kilometres per litre, and fuel price is entered per litre.
- Every occupant assigned to a leg, including a driver if applicable, receives one equal share; there is no driver-specific or weighted pricing.
- Stops with the same name are allowed because each visit is a distinct itinerary occurrence.
- The first release stores exactly one autosaved current trip and does not include accounts, cloud synchronization, trip history, import/export, or route-distance lookup.
- The feature is complete when a user can construct the example journey from `project.md`, assign different passenger combinations, reload the app offline without losing the trip, and see person costs whose formatted sum exactly equals the formatted journey cost.
