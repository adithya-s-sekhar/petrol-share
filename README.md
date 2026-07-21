# Petrol Share

Split petrol costs fairly across every leg of a shared trip. Petrol Share is an installable PWA that keeps the application shell and saved trip available offline after the first visit.

## Development

```sh
pnpm install
pnpm dev
```

The default build uses `/` as its base path:

```sh
pnpm build
```

Use the Pages build when deploying to `https://<owner>.github.io/petrol-share/`:

```sh
pnpm build:pages
```

For another subpath, set `VITE_BASE_PATH` when building. It accepts values with or without surrounding slashes.

## PWA behavior

The generated service worker precaches the application shell, falls back to `index.html` for offline navigation, and activates updates automatically. A supported browser can install the app after its first production visit.

## Tooling

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
