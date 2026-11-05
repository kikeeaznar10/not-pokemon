/**
 * IntroScene (M11) — plays the new-game script in `public/data/intro.json` on the `start.json › spawn` map,
 * then hands control to the player in the overworld.
 *
 * - Start it with {@link IntroSceneData} (the player's name). The new game is built from `start.json`
 *   (`newGameState`: starter, euros, slots, items) as soon as the scene starts; nothing is saved until the
 *   overworld enters its first map.
 * - The map is drawn like the overworld's (`drawZoneMap`); the player stands on the spawn tile and the
 *   coworker (`intro.json › coworker`, drawn like an NPC) on its own tile. If the script has a `fade_in`
 *   step the screen starts black.
 * - Steps, in order: `fade_in` (camera fade from black, `ms`), `wait` (`ms`), `walk` (the actor walks one tile
 *   per direction at walking speed), `face`, `say` (the coworker's lines in the DialogBox with its voice;
 *   `{name}` / `{starter}` filled by `fillIntroText`), `handover` (the jingle plays and "¡Recibes a
 *   {starter}!" shows; then, if the name matches `secret-names.json`, its items go into the bag and its
 *   message shows — `src/logic/intro.ts`). The player's input is ignored throughout, except A in dialogue.
 * - When the last step ends, the player's tile and facing go into the game state and the OverworldScene
 *   starts there (no fade, same map, so control simply begins). The coworker exists only in this scene, so the
 *   script walks it out of view first.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import { log } from '../core/log';
import { sfxVolume } from '../core/options';
import { rng } from '../core/rng';
import { setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import type { Facing, IntroStep, Npc } from '../data/schemas';
import { isBlocked, type MapInfo } from '../data/tiled';
import { t } from '../i18n';
import { applySecretName, fillIntroText, findSecretName } from '../logic/intro';
import { newGameState } from '../logic/new-game';
import { FACING_DELTA } from '../logic/npc-state';
import type { GameState } from '../logic/save';
import { DialogBox, type DialogState } from '../ui/dialog-box';
import { NpcActor } from '../world/npc';
import { Player } from '../world/player';
import { drawZoneMap } from '../world/zone-map';
import { OVERWORLD_SCENE, type OverworldData } from './overworld-scene';

/** Scene key of {@link IntroScene}. */
export const INTRO_SCENE = 'Intro';

/** What the intro needs: the name chosen in the NameScene. */
export interface IntroSceneData {
  name: string;
}

/** The intro as data (for the E2E hooks). */
export interface IntroView {
  /** Index and type of the step running (`done` once the overworld is starting). */
  step: number;
  type: IntroStep['type'] | 'done';
  name: string;
  player: { x: number; y: number; facing: Facing };
  coworker: { x: number; y: number; facing: Facing };
  /** The open dialogue box, or `null`. */
  dialogue: DialogState | null;
  /** True once the handover ran (starter received, secret name applied). */
  handedOver: boolean;
  /** The message of the secret name that matched, or `null`. */
  secretMessage: string | null;
  /** Times the handover jingle was played. */
  jinglePlays: number;
}

/** Longest frame time fed to movement (ms), like the overworld. */
const MAX_FRAME_MS = 250;

/** The scripted new-game intro. */
export class IntroScene extends Phaser.Scene {
  private name_ = '';
  private state!: GameState;
  private info!: MapInfo;
  private player!: Player;
  private coworker!: NpcActor;
  private dialog!: DialogBox;
  private steps: readonly IntroStep[] = [];
  private index = -1;
  /** Directions still to walk in the current `walk` step. */
  private path: Facing[] = [];
  private done = false;
  private handedOver = false;
  private secretMessage: string | null = null;
  private jinglePlays = 0;

  constructor() {
    super(INTRO_SCENE);
  }

  init(data: IntroSceneData): void {
    const gd = getGameData();
    this.name_ = data.name;
    this.state = newGameState(gd, rng, data.name);
    this.steps = gd.intro.steps;
    this.index = -1;
    this.path = [];
    this.done = false;
    this.handedOver = false;
    this.secretMessage = null;
    this.jinglePlays = 0;
  }

  create(): void {
    const gd = getGameData();
    const spawn = gd.start.spawn;
    const zone = gd.zones.get(spawn.map);
    if (!zone) throw new Error(`Intro: unknown zone "${spawn.map}"`);
    this.info = drawZoneMap(this, zone);
    this.player = new Player(this, spawn.x, spawn.y, spawn.facing);
    const c = gd.intro.coworker;
    const npc: Npc = {
      id: 'intro_coworker',
      type: 'talker',
      name: c.name,
      sprite: c.sprite,
      voice: c.voice,
      map: zone.id,
      spawn: { x: c.x, y: c.y },
      facing: c.facing,
      wander: null,
      dialogue: [c.name],
    };
    this.coworker = new NpcActor(this, npc, rng);
    this.coworker.engage();
    this.dialog = new DialogBox(this);
    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 1, 1, -TILE_SIZE / 2, -TILE_SIZE / 2);
    // With a `fade_in` step the screen starts black until that step reveals the map.
    if (this.steps.some((s) => s.type === 'fade_in')) cam.fadeOut(0, 0, 0, 0);
    log(`Intro: "${this.name_}" on ${zone.id}`);
    this.next();
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    const dt = Math.min(delta, MAX_FRAME_MS);
    if (this.dialog.isOpen) this.dialog.update(dt);
    const step = this.steps[this.index];
    this.coworker.update(dt, (x, y) => this.blocked(x, y, 'coworker'), rng);
    if (step?.type === 'walk' && step.actor === 'coworker') this.walkCoworker();
    if (step?.type === 'walk' && step.actor === 'player') this.walkPlayer(dt);
    else this.player.update(null, dt, () => true); // The player's own input is ignored here.
  }

  /** The intro as data. */
  view(): IntroView {
    const step = this.steps[this.index];
    const p = this.player.state;
    const c = this.coworker.state;
    return {
      step: this.index,
      type: this.done ? 'done' : (step?.type ?? 'done'),
      name: this.name_,
      player: { x: p.x, y: p.y, facing: p.facing },
      coworker: { x: c.x, y: c.y, facing: c.facing },
      dialogue: this.dialog.state(),
      handedOver: this.handedOver,
      secretMessage: this.secretMessage,
      jinglePlays: this.jinglePlays,
    };
  }

  /** Start the next step (or finish). */
  private next(): void {
    this.index += 1;
    const step = this.steps[this.index];
    if (!step) return this.finish();
    const gd = getGameData();
    const starter = gd.flexymon.get(gd.start.starter)?.name ?? gd.start.starter;
    switch (step.type) {
      case 'fade_in': {
        const cam = this.cameras.main;
        cam.resetFX();
        if (step.ms <= 0) return this.next();
        cam.fadeIn(step.ms, 0, 0, 0);
        this.time.delayedCall(step.ms, () => this.next());
        return;
      }
      case 'wait':
        this.time.delayedCall(step.ms, () => this.next());
        return;
      case 'walk':
        this.path = [...step.path];
        return;
      case 'face':
        if (step.actor === 'player') this.player.face(step.facing);
        else this.coworker.face(step.facing);
        return this.next();
      case 'say':
        this.dialog.open(
          step.lines.map((l) => fillIntroText(l, { name: this.name_, starter })),
          { voice: gd.intro.coworker.voice, onClose: () => this.next() },
        );
        return;
      case 'handover': {
        const lines = [t('intro.received', { starter })];
        const secret = findSecretName(this.name_, gd.secretNames);
        if (secret) {
          this.state = applySecretName(this.state, secret);
          this.secretMessage = secret.message;
          lines.push(secret.message);
          log(`Intro: secret name "${secret.name}"`);
        }
        this.handedOver = true;
        if (this.cache.audio.exists(gd.intro.jingle)) {
          this.sound.play(gd.intro.jingle, { volume: sfxVolume() });
          this.jinglePlays += 1;
        }
        this.dialog.open(lines, { onClose: () => this.next() });
        return;
      }
    }
  }

  /** Walk the player one tile per remaining direction; next step when the path is done. */
  private walkPlayer(dt: number): void {
    const dir = this.path[0];
    if (!dir) {
      if (!this.player.state.step) this.next();
      return;
    }
    const moves = this.player.update(dir, dt, (x, y) => this.blocked(x, y, 'player'), true);
    const end = moves.find((m) => m.type === 'step_end');
    if (end?.type === 'step_end') {
      this.path.shift();
      // Do not let a held direction carry the player one tile further than the script says.
      if (this.path.length === 0) this.player.halt(end.x, end.y);
    }
  }

  /** Walk the coworker one tile per remaining direction; next step when the path is done. */
  private walkCoworker(): void {
    if (this.coworker.state.step) return;
    const dir = this.path.shift();
    if (!dir) return this.next();
    const s = this.coworker.state;
    const d = FACING_DELTA[dir];
    this.coworker.stepTo({ x: s.x + d.x, y: s.y + d.y });
  }

  /** Map blocking for the intro (checked at boot, so this only guards against surprises). */
  private blocked(x: number, y: number, who: 'player' | 'coworker'): boolean {
    if (isBlocked(this.info, x, y)) return true;
    if (who === 'player') return this.coworker.occupies(x, y);
    const p = this.player.state;
    return (p.x === x && p.y === y) || (p.step !== null && p.step.to.x === x && p.step.to.y === y);
  }

  /** Save the final position into the new game and start the overworld there. */
  private finish(): void {
    if (this.done) return;
    this.done = true;
    const gd = getGameData();
    const p = this.player.state;
    const map = gd.start.spawn.map;
    setGameState({ ...this.state, player: { ...this.state.player, map, x: p.x, y: p.y, facing: p.facing } });
    log(`Intro: done, control at ${map} ${p.x},${p.y}`);
    this.scene.start(OVERWORLD_SCENE, { map, x: p.x, y: p.y, facing: p.facing } satisfies OverworldData);
  }
}
