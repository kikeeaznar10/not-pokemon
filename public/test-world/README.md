# test-world — the frozen M0–M13 content (M14)

`data/` holds the ten content files exactly as they were at the end of M13 (3 flexymon, the test maps), with the
map paths moved to `maps/test/`. The real game never loads them; dev and E2E builds do with `?world=test` or
`localStorage['flexymon.e2e.world'] = 'test'` (`src/data/world.ts`). The unit tests' fixture and the browser tests
written before M14 depend on these numbers: do not edit them, and add real content to `public/data/` instead.
