/**
 * `npm run offline` — package the production build as one HTML file anyone can open from disk.
 *
 * Browsers block `fetch` / XHR on `file://` pages, so a zipped `dist/` cannot be played by double-clicking
 * `index.html`. This tool (run after `npm run build`) writes `dist-offline/flexymon.html` with the JS bundle
 * inlined and every shipped file of `dist/` embedded as a `data:` URL, plus a tiny shim (run before the game)
 * that sends the game's `fetch` and `XMLHttpRequest` calls for those relative paths to the embedded copies.
 * The frozen test world (`test-world/`, `maps/test/`) and the `README.md` files are left out.
 * It then zips that file as `dist-offline/flexymon.zip` (Node's zlib only, no extra dependency).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const DIST = 'dist';
const OUT_DIR = 'dist-offline';
const HTML_NAME = 'flexymon.html';
const ZIP_NAME = 'flexymon.zip';

/** MIME type per extension of the files the game loads. */
const MIME: Record<string, string> = {
  json: 'application/json',
  tmj: 'application/json',
  png: 'image/png',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
};

/** Paths (relative to `dist/`, `/`-separated) that the offline file never needs. */
function isExcluded(path: string): boolean {
  return (
    path === 'index.html' ||
    path.endsWith('README.md') ||
    path.startsWith('test-world/') ||
    path.startsWith('maps/test/') ||
    /^assets\/index-.*\.js$/.test(path)
  );
}

/** Every file under `dir`, as `/`-separated paths relative to `root`. */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).split(sep).join('/')];
  });
}

/**
 * Shim run before the game: maps a URL relative to the page (e.g. `./data/flexymon.json`) to its embedded
 * `data:` URL and patches `fetch` and `XMLHttpRequest.open` to use it. Unknown URLs pass through unchanged.
 */
function shim(files: Record<string, string>): string {
  return `(function () {
  var files = ${JSON.stringify(files)};
  var base = document.baseURI.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  function embedded(u) {
    var href;
    try { href = new URL(String(u), document.baseURI).href; } catch (e) { return null; }
    if (href.indexOf(base) !== 0) return null;
    var path = decodeURIComponent(href.slice(base.length).replace(/[?#].*$/, ''));
    return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var hit = typeof input === 'string' || input instanceof URL ? embedded(input) : null;
    return hit ? realFetch(hit) : realFetch(input, init);
  };
  var realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    var hit = embedded(url);
    if (hit) args[1] = hit;
    return realOpen.apply(this, args);
  };
})();`;
}

/** Escapes a script body so it cannot close its `<script>` tag early. */
function scriptSafe(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

/** Minimal ZIP writer (deflate, no ZIP64): enough for a handful of files of a few MB. */
function zip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // DOS date/time for "now" (the zip only needs a plausible timestamp).
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, packed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** Builds `dist-offline/flexymon.html` and `dist-offline/flexymon.zip` from `dist/`. */
function main(): void {
  const indexPath = join(DIST, 'index.html');
  let html: string;
  try {
    html = readFileSync(indexPath, 'utf8');
  } catch {
    throw new Error(`${indexPath} not found: run "npm run build" first (or use "npm run offline").`);
  }

  const files: Record<string, string> = {};
  for (const path of listFiles(DIST).filter((p) => !isExcluded(p))) {
    const mime = MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
    if (!mime)
      throw new Error(`No MIME type for dist/${path}: add its extension to MIME in tools/make-offline.ts`);
    files[path] = `data:${mime};base64,${readFileSync(join(DIST, path)).toString('base64')}`;
  }

  const scriptTag = /<script type="module" crossorigin src="\.\/(assets\/index-[^"]+\.js)"><\/script>/;
  const match = scriptTag.exec(html);
  if (!match?.[1]) throw new Error('Could not find the module script tag in dist/index.html');
  const bundle = readFileSync(join(DIST, match[1]), 'utf8');
  html = html.replace(
    scriptTag,
    () =>
      `<script>${scriptSafe(shim(files))}</script>\n    <script type="module">${scriptSafe(bundle)}</script>`,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const htmlBuf = Buffer.from(html, 'utf8');
  writeFileSync(join(OUT_DIR, HTML_NAME), htmlBuf);
  writeFileSync(join(OUT_DIR, ZIP_NAME), zip([{ name: HTML_NAME, data: htmlBuf }]));
  const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
  process.stdout.write(
    `Embedded ${Object.keys(files).length} files.\n` +
      `${OUT_DIR}/${HTML_NAME} (${mb(htmlBuf.length)} MB)\n` +
      `${OUT_DIR}/${ZIP_NAME} (${mb(statSync(join(OUT_DIR, ZIP_NAME)).size)} MB)\n`,
  );
}

main();
