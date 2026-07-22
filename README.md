# Petrol Share

Petrol Share is a mobile-first, installable web app for dividing a trip's fuel cost fairly among the people who travelled on each leg. It works without accounts, saves the current trip on the device, and keeps the app available offline after an initial production visit.

Petrol Share is made with [Codex](https://openai.com/codex/).

[Use Petrol Share](https://adithya-s-sekhar.github.io/petrol-share/)

## Prerequisites

- [Node.js 24](https://nodejs.org/) (the version used by CI)
- [pnpm 11](https://pnpm.io/installation)

The repository declares its pnpm version in `package.json`. With a current Node.js installation, Corepack can install and select it:

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
```

For normal local development, `pnpm install` is also sufficient. Keep `pnpm-lock.yaml` in sync when dependencies change.

## Local development

Start Vite's development server with hot module replacement:

```sh
pnpm dev
```

Vite prints the local URL, normally `http://localhost:5173/`. Development and ordinary production builds use `/` as the application base.

Run the project checks with:

```sh
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:pwa
```

Install Playwright's local browser binaries once with `pnpm exec playwright install`, then use `pnpm test:e2e` to start a local Vite server and run the complete end-to-end suite in Chromium, Firefox, and WebKit. The E2E suite is intentionally run locally rather than as a GitHub Actions job and must pass before raising a pull request.

`pnpm test:watch` runs Vitest in watch mode. `pnpm build` first type-checks the project and then writes the production app and generated PWA files to `dist/`. To inspect that build locally, run `pnpm preview` after building. The service worker is generated only for a production build, not by the development server.

## How costs are calculated

The route is an ordered list of stops; every adjacent pair is one leg with its own distance. Repeated place names are allowed because each stop represents a distinct visit.

For each leg:

```text
leg fuel (litres) = leg distance (km) / fuel economy (km/l)
leg cost          = leg fuel × price per litre
person's share    = leg cost / number of people assigned to that leg
```

A person's unrounded total is the sum of their shares for all assigned legs. Their travelled distance is likewise the sum of those legs. Everyone assigned to a leg gets an equal share; there is no special driver share or weighted pricing. Journey distance, fuel, and cost are calculated from all legs, independently of the assignments.

### Currency rounding

Calculations retain their unrounded values internally. Displayed shares use the selected currency's minor-unit precision reported by `Intl.NumberFormat`: for example, JPY has no decimal places, USD has two, and KWD has three.

To ensure displayed person shares add up exactly to the rounded journey total, Petrol Share uses deterministic largest-remainder reconciliation:

1. Convert each unrounded share to minor units and initially allocate its floor.
2. Round the total journey cost to minor units.
3. Give the remaining units, one at a time, to the people with the largest fractional remainders.
4. Resolve equal remainders by the order in which people were added.

For example, a JPY 100 leg shared by three people is displayed as JPY 34, JPY 33, and JPY 33 in creation order, rather than three independently rounded JPY 33 shares.

## Validation and incomplete assignments

The **Check trip details** action validates the whole draft. Once the draft is valid, results appear and update automatically as inputs change. A calculable trip requires:

- at least two named stops and exactly one correctly ordered leg per adjacent stop pair;
- a finite, positive distance for every leg;
- at least one person, with non-empty, case-insensitively unique names;
- finite, positive fuel economy and price-per-litre values;
- a supported three-letter currency code; and
- valid, non-duplicated IDs and references between stops, legs, and assignments.

Incomplete editor fields are intentionally allowed while entering a trip and are autosaved. Validation messages appear after attempting to view results, and focus moves to the first invalid field.

Assignments have a separate completeness rule. Once the other fields are valid, overall journey distance, fuel, and cost remain visible even if a leg has no riders. The app names every unassigned leg but withholds all per-person results until every leg has at least one assigned person. Assign the driver too if the driver should share the cost.

Editing route order can change which stops are adjacent. A leg's distance and assignments are preserved only while the same two stop IDs remain adjacent in the same direction; obsolete legs and their assignments are removed.

## Local persistence and recovery

Petrol Share stores one current draft locally in the browser's IndexedDB database `petrol-share`, in the `trips` object store under the `current-trip` key. There is no trip list or history. Complete and incomplete edits are autosaved after a 500 ms debounce, and the save status is shown at the top of the app.

On startup, the editor waits for storage hydration before it is shown, preventing a blank draft from overwriting saved data. A structurally valid saved draft is restored, including incomplete fields. If no record exists, a fresh two-stop draft is created. If the record is corrupt, uses an unsupported schema version, or IndexedDB cannot be read, the app starts a safe blank draft and displays a recovery notice instead of crashing. Recovery does not attempt to repair or expose the invalid record; the next edit replaces the current-trip entry.

`Reset trip` asks for confirmation, then replaces the current draft with a blank two-stop trip and autosaves it. Browser storage is device-, browser-, and origin-specific. Clearing site data, using a different browser/device, or changing the deployed origin loses access to that saved trip.

## PWA installation, offline use, and updates

After visiting a production build in a supported browser, use the browser's install action (its wording varies by browser) to install Petrol Share. Installation is not offered by the Vite development server.

The generated service worker precaches the built application shell and uses `index.html` as the fallback for navigation. After the first successful online production visit, the installed app and previously saved trip can be used offline. The app does not need a network connection for calculations or local persistence. A first visit cannot work offline, and clearing the browser's site data removes both cached files and the local trip.

Service-worker registration uses automatic updates. When a new deployment is detected, the new worker activates and takes control without an in-app prompt; a refresh or later launch shows the newest assets. Existing IndexedDB data is retained as long as it remains compatible with the current schema.

## Optional map-assisted distances

Every leg can still be entered and edited manually, including while offline. The **Look up road distance** action is optional and makes no background requests. In its dialog, **Find places** sends the two displayed search terms to the public Nominatim service; after the user chooses both suggestions, **Use road distance** sends only their coordinates to the public OSRM demo server. Those providers receive normal web-request metadata such as the user's IP address. OpenStreetMap attribution and this privacy disclosure are displayed before either request.

Provider calls are isolated behind `src/maps/routeProvider.ts`, with no credentials in the client and mocked unit and Playwright coverage. The current public endpoints are suitable for modest demo traffic and can rate-limit or refuse requests. A higher-traffic deployment should implement the same interface using a server-side proxy and a provider plan whose credentials, acceptable-use limits, attribution, and privacy terms fit the deployment. Lookup failures and rate limits leave all existing trip data untouched so manual/offline operation remains available.

## GitHub Pages deployment

The workflow in `.github/workflows/ci.yml` runs linting, tests, a root-base production build, and PWA artifact verification for every pull request and for pushes to `main`.

Only a push to `main` runs the Pages build and deployment jobs. That build executes:

```sh
pnpm build:pages
pnpm verify:pwa:pages
```

`build:pages` sets `VITE_BASE_PATH=/petrol-share/`, so asset URLs, manifest scope, and start URL work at `https://<owner>.github.io/petrol-share/`. The `/petrol-share/` base is deployment-only: local development, tests, and the normal `pnpm build` continue to use `/`.

For a different deployment subpath, set `VITE_BASE_PATH` for the build. Values with or without surrounding slashes are normalized:

```sh
VITE_BASE_PATH=/another-path/ pnpm build
```

The workflow uploads `dist/` as the Pages artifact and deploys it through GitHub's Pages actions. Repository Pages settings must use **GitHub Actions** as the source.

## First-release constraints

This release deliberately has:

- no accounts or authentication;
- no cloud sync or cross-device sharing;
- no saved-trip history;
- no import or export; and
- no automatic or background map lookup; map-assisted distances are always opt-in.

Enter route distances manually and keep the browser's site data if the current trip must remain available.
