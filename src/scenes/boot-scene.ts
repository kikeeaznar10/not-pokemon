/**
 * BootScene — the first scene. Loads and validates every content JSON and every zone's map
 * (`src/data/loader.ts`, map checks in `src/data/map-checks.ts`).
 * On success it stores the {@link GameData} and launches Preload (which stops Boot once loaded, so
 * some scene is always active); on any error it starts the ErrorScene
 * with one `file › path › message` line per problem.
 */
import Phaser from 'phaser';
import { events } from '../core/events';
import { error, log } from '../core/log';
import { formatDataError } from '../data/errors';
import { setGameData } from '../data/game-data';
import { loadGameData } from '../data/loader';
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
    void loadGameData(`${base}data/`, undefined, { mapsBaseUrl: base }).then((result) => {
      if (result.ok) {
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
