<!-- Pull requests go to `develop`. Only a release (develop → main) targets `main`, and merging it publishes the game. -->

## What changed

-

## Why

## Documentation

<!-- Which docs were updated (docs/*.md, folder README.md, doc comments)? Write "None needed" and why if none. -->

## Checklist

- [ ] Targets `develop` (or is a release from `develop` to `main`)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass
- [ ] `npx playwright test` passes
- [ ] Checked in the running game (how: by hand, or Playwright + screenshots)
- [ ] No `console.log` outside `log()`; no hard-coded content; no Spanish text in `.ts` files
- [ ] Docs updated in this same PR (see CONTRIBUTING.md › Documentation)
