# Working on this repo

- Any edits to this repo should be done in a separate branch.
- Any changes committed should have a tracking issue on github.
- If no issue is present it should be created first.
- Changes should always land through pull requests.

## When given an issue url do the following

- Read and understand the issue
- Read the codebase to understand what all to do
- Create a relevant branch for the issue.
- Implement the issue following [Guidelines](#guidelines)
- Run the complete end-to-end suite locally with `pnpm test:e2e` and ensure it passes before raising a PR.
- Run playwright tests at mobile and desktop layout to find overflowing buttons, layouts, layouts that only overflow when some buttons are pressed and fix it.
- Commit and raise a pr against the issue.

## Guidelines

- Reusable minimal components, hooks, utilities and providers.
- Tailwind for styling, no duplicated code.
- DRY and SOLID principles.
- Best practices for react state management and performance must be followed.