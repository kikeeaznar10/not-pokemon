/**
 * BootScene — the first scene. Loads and validates every content JSON and every zone's map
 * (`src/data/loader.ts`, map checks in `src/data/map-checks.ts`) from `public/data/` — or, in dev / E2E builds, the
 * frozen test world (`src/data/world.ts`, M14).
 * Load warnings (unused encounter groups, M7) are logged with `warn()` and do not stop the game.
 * On success it stores the {@link GameData} and launches Preload (which stops Boot once loaded, so
 * some scene is always active); on any error it starts the ErrorScene
 * with one `file › path › message` line per problem.
 */
import Phaser from 'phaser';
import { events } from '../core/events';
import { error, log, warn } from '../core/log';
import { formatDataError } from '../data/errors';
import { setGameData } from '../data/game-data';
import { loadGameData } from '../data/loader';
import { dataDir } from '../data/world';
import { ERROR_SCENE, type ErrorSceneData } from './error-scene';
import { PRELOAD_SCENE } from './preload-scene';

/** Scene key of {@link BootScene}. */
export const BOOT_SCENE = 'Boot';

/** First scene: loads and validates content, then hands over to Preload (or Error). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE);
  }

  create(): void {
    log('Boot: loading data');
    const base = import.meta.env.BASE_URL;
    void loadGameData(`${base}${dataDir()}`, undefined, { mapsBaseUrl: base }).then((result) => {
      if (result.ok) {
        for (const w of result.warnings ?? []) warn(formatDataError(w));
        setGameData(result.data);
        events.emit('data:loaded');
        // Launch (not start) so Boot stays active while Preload loads; Preload stops Boot when done.
        this.scene.launch(PRELOAD_SCENE);
        return;
      }
      const lines = result.errors.map(formatDataError);
      for (const line of lines) error(line);
      events.emit('data:error', lines);
      const data: ErrorSceneData = { lines };
      this.scene.start(ERROR_SCENE, data);
    });
  }
}
