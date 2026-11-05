# Deploying Flexymon

Flexymon is a fully static site: `npm run build` writes everything to `dist/` (one `index.html`, one JS bundle,
the content JSON, the maps, the art and the sounds). Any static host can serve it. No server code, database or
environment variables are needed.

**Which host, and whether the link needs a password, is still an open question** (docs/PROGRESS.md). Nothing has
been deployed yet. The steps for each option are below; pick one and record the choice in docs/PROGRESS.md.

## 1. Build and check locally

```bash
nvm use                 # Node 22 (.nvmrc)
npm ci                  # exact dependency versions from package-lock.json
npm run lint && npm run typecheck && npm test
npm run build           # sprite atlas (npm run atlas) + typecheck + vite build → dist/
npm run preview         # serves dist/ at http://localhost:4173 — play it once on desktop and on a phone
npx playwright test     # optional: the browser tests (they build their own copy with test hooks)
```

Build with plain `npm run build` for the real site. **Do not set `VITE_E2E=1`** for a deployment: that switch adds
the test hooks (`window.__E2E__`) and lets the URL load the frozen test world.

`npm start` does the install, the build and the preview in one go.

To try the build on a phone on the same Wi-Fi: `npm run preview -- --host`, then open the printed network address.

## Sharing without a host

`npm run offline` writes `dist-offline/flexymon.zip`: one `flexymon.html` with everything inside. Unzip it and
double-click the HTML to play in any desktop browser, with no server (details in `tools/README.md`).

## 2. Sub-paths

`vite.config.ts` sets `base: './'`, so every URL in the build is relative. The same `dist/` works at the root of a
domain (`https://flexymon.example.com/`) and under a sub-path (`https://example.com/juegos/flexymon/`) with no
change. Only set an absolute `base` (e.g. `base: '/flexymon/'`) if a host requires it.

The browser save (`localStorage`, key `flexymon.save.v1`) belongs to the site's origin (scheme + domain + port):
moving the game to another domain starts players with an empty save.

## 3. Upload `dist/`

Upload the **contents** of `dist/` (so `index.html` is at the top). The folders `dist/test-world/` and
`dist/maps/test/` are the frozen test world: production builds never load them, and they can be left in or deleted.

### Netlify

- Drag and drop: <https://app.netlify.com/drop>, drop the `dist` folder. A random `*.netlify.app` URL is created at
  once; rename it under Site settings.
- Or connected to the repository: build command `npm run build`, publish directory `dist`, Node version 22
  (environment variable `NODE_VERSION=22`).
- Password: *Site protection* (a shared password) is only on paid plans.

### Cloudflare Pages

- Workers & Pages › Create › Pages › connect the repository: framework preset *None*, build command
  `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22`.
- Or upload directly: `npx wrangler pages deploy dist --project-name flexymon` (needs a Cloudflare login).
- Password / company-only access: put the site behind *Cloudflare Access* (Zero Trust › Access › Applications) and
  allow the company's e-mail domain.

### GitHub Pages

- Settings › Pages › Source: *GitHub Actions*, with a workflow that runs `npm ci && npm run build` on Node 22 and
  publishes `dist/` (`actions/upload-pages-artifact` + `actions/deploy-pages`). The site is
  `https://<owner>.github.io/<repo>/`, a sub-path, which `base: './'` already handles.
- GitHub Pages sites are public on most plans (private Pages need GitHub Enterprise Cloud). Check the open question
  about real company and place names before publishing there.

### Company web server

Copy the contents of `dist/` into any folder the server publishes (nginx, Apache, IIS…), for example
`rsync -av --delete dist/ user@server:/var/www/flexymon/`. Recommended server settings:

- serve `.json` and `.tmj` as `application/json`, `.ogg` as `audio/ogg`, `.mp3` as `audio/mpeg`;
- gzip or brotli for `.js`, `.json`, `.tmj` and `.html` (the JS bundle is 1.6 MB, about 430 kB gzipped);
- long cache times for `assets/index-*.js` (its name changes on every build); short or no cache for `index.html`
  and `data/*.json` (content changes keep their names).

A password can be added with the server's basic authentication (nginx `auth_basic`, Apache `.htpasswd`).

## 4. After deploying

- Open the URL on a desktop browser and on a phone in landscape: the title appears, *Nueva partida* starts the
  intro, and the game saves (reload: *Continuar* is offered).
- Hand coworkers only the URL. Controls are shown on the phone; on desktop: arrows / WASD to move, Z = A, X = B,
  Enter = Start, M = minimap.
- Updating the game: build again and upload `dist/` again. Saves survive updates; a save that no longer fits the
  content (a removed flexymon…) is repaired on load, and an unreadable one is kept as `flexymon.save.broken`.

## Measured size and speed (M15)

Production build: about 2.3 MB on disk; about 0.7 MB is transferred with gzip, in about 90 requests (the sprites
come in one atlas image). Time to the title screen, measured with Chromium's network throttling on a Pixel 7
profile: 2.6 s on "fast 4G" (9 Mbit/s, 60 ms) and 5.9 s on "slow 4G" (1.6 Mbit/s, 150 ms). Without the atlas it was
3.1 s and 7.4 s. Frame rate while walking: 60 FPS, also with the CPU slowed 4×.
