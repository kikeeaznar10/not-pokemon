/**
 * OverworldScene — draws one zone's Tiled map and lets the player walk on it (M3), and moves between
 * maps through warps (M4).
 *
 * - Start it with {@link OverworldData}: the zone id (a key of `zones.json`) and optionally the tile and
 *   facing; without a position the map's `default` spawn point is used.
 * - The map was loaded and checked at boot (`GameData.maps`); its JSON goes into Phaser's tilemap
 *   cache under the map path (e.g. `maps/test.tmj`). Tileset images and the player sheet are loaded by
 *   Preload.
 * - Layers: `ground` (depth 0), `deco` (1), the player (2), `above` (3); `collision` is never drawn.
 *   Blocking: solid tiles and the map edges, except off-map tiles covered by a step warp.
 * - Camera: follows the player, clamped to the map. A map smaller than the screen (interiors) is
 *   centred on a black background.
 * - Warps (`src/logic/warp.ts`): finishing a step on a `step` warp, or pressing A while standing still
 *   facing an `action` warp, locks input, fades out (`WARP_FADE_MS`), restarts this scene on the
 *   target, fades in and unlocks. Safe steps are reset on every map entry.
 * - Debug teleport (M4): `debug:teleport` moves the player to a zone's `default` spawn the same way;
 *   while `debug:menu` is open the player does not move.
 * - NPCs (M5): every `npcs.json` entry whose `map` is this zone appears on its spawn tile and wanders
 *   (`src/world/npc.ts`, rules in `src/logic/npc-wander.ts`). NPCs never step onto solid tiles, warp
 *   tiles, the player or another NPC; the player can never step onto an NPC. While a step is in progress
 *   both its tiles count as taken, for the player and for NPCs.
 * - Talking (M5): standing still, A while facing an NPC (one standing on, or arriving at, the tile in
 *   front) makes it turn to the player and stop; its lines (`src/logic/talk.ts`) show in the DialogBox
 *   with its `voice`. The player cannot move until the last box closes. NPCs take priority over
 *   `action` warps.
 * - Battles (M6): {@link OverworldScene.startBattle} locks input, flashes the screen for `BATTLE_FLASH_MS`,
 *   then launches the BattleScene and puts this scene to sleep (map, player and NPCs keep their state).
 *   On `battle:ended` it wakes up on the same tile, fades in and resets the safe steps. The debug command
 *   `debug:battle` starts a wild battle against a fresh flexymon of any species.
 * - Wild encounters (M7): after every completed step that is not a warp, `checkStep`
 *   (`src/logic/encounter.ts`) rolls against the map's `encounters` rectangles and the zone's groups
 *   in zones.json; on success the player stops on that tile and a wild battle starts. Safe steps:
 *   `SAFE_STEPS` after every map entry and battle. The debug menu can switch encounters off
 *   (`src/core/debug-flags.ts`).
 * - Enemy NPCs (M8): after every completed player step, and every NPC step while the player stands
 *   still, the `ready` enemies on the map look for the player (`findSpotter`, `src/logic/enemy-npc.ts`:
 *   straight line in front, at most `sight` tiles, no solid tile or NPC between). A spotted player halts
 *   on that tile; input stays locked while the NPC shows a "!" bubble for `NPC_ALERT_MS`, walks up to the
 *   adjacent tile (the tiles on its way are reserved, so no wanderer steps in), both turn to face each
 *   other, the NPC says its `dialogue`, and an `npc` battle against a fresh copy of its `team` starts.
 *   While one NPC walks up, no other NPC looks. Pressing A facing a `ready` enemy starts the same
 *   sequence (without the walk); a `cooldown` enemy only says its `defeatDialogue`. After a win (the
 *   BattleScene already paid the reward and set `cooldown`) the NPC says its `defeatDialogue`, then
 *   wanders again (back into its rectangle, see `npc-wander.ts`). Cooldowns are refreshed
 *   (`refreshCooldowns`) on map entry and after every player or NPC step.
 * - Healer, storage, shops (M9): talking to a `healer` fully heals the team and the storage box, then it
 *   says "Tus flexymon están como nuevos." and its dialogue, and an auto-save is requested
 *   (`save:request` `healer`). A `storage` NPC opens the StorageScene and a `shopkeeper` its ShopScene
 *   after their dialogue; while one is open this scene is paused (locked) and it resumes on
 *   `overlay:closed`.
 * - Losing (M8): the BattleScene applies the Losing rule to the game state; on `battle:ended` with
 *   `lose` this scene restarts at the respawn point (`start.json › respawn`), fades in and shows
 *   `lose.woke_up` ("Te has despertado en la oficina...").
 * - Emits `zone:entered` once built (main.ts plays the zone music) and `player:moved` after placing
 *   the player and after every step.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { getGameData } from '../data/game-data';
import { gameState, setGameState } from '../core/session';
import type { Facing, Zone } from '../data/schemas';
import { findSpawn, isBlocked, type MapInfo } from '../data/tiled';
import { t } from '../i18n';
import type { BattleKind } from '../logic/battle';
import { BATTLE_FLASH_MS, NPC_ALERT_MS, WARP_FADE_MS } from '../logic/constants';
import {
  findSpotter,
  isEnemy,
  npcTeam,
  placedEnemies,
  refreshCooldowns,
  type Lookout,
} from '../logic/enemy-npc';
import type { FlexymonInstance } from '../logic/instance';
import { oppositeFacing } from '../logic/npc-wander';
import { createInstance } from '../logic/instance';
import { checkStep, resetSafeSteps } from '../logic/encounter';
import { debugFlags } from '../core/debug-flags';
import { FACING_DELTA, npcState, type NpcState, type Point } from '../logic/npc-state';
import { talkAction, talkLines } from '../logic/talk';
import { healParty } from '../logic/team';
import { blockedWithWarps, insideWarp, warpAt, warpDestination, type WarpTarget } from '../logic/warp';
import { ChoiceBox, type ChoiceState } from '../ui/choice-box';
import { DialogBox, type DialogState } from '../ui/dialog-box';
import { cameraBounds } from '../world/camera';
import { NpcActor, npcsOnMap } from '../world/npc';
import { BATTLE_SCENE, type BattleSceneData } from './battle-scene';
import { SHOP_SCENE, type ShopSceneData } from './shop-scene';
import { STORAGE_SCENE } from './storage-scene';
import { Player } from '../world/player';

/** Scene key of {@link OverworldScene}. */
export const OVERWORLD_SCENE = 'Overworld';

/** Where to put the player. `fadeIn` is set by warps (the screen starts black and fades in). */
export interface OverworldData {
  map: string;
  x?: number;
  y?: number;
  facing?: Facing;
  fadeIn?: boolean;
  /** Dialogue strings shown once the scene has faded in (M8: the "woke up" message after a loss). */
  messages?: string[];
}

/** What {@link OverworldScene.startBattle} needs: the opponent species, the kind and an optional seed. */
export interface BattleRequest {
  speciesId: string;
  kind?: BattleKind;
  seed?: number;
}

/** An enemy NPC sequence in progress (M8): "!" bubble → walk up → dialogue → battle → defeat dialogue. */
interface Engagement {
  npc: NpcActor;
  /** Tiles still to walk (reserved: other NPCs may not step onto them). */
  path: Point[];
  phase: 'alert' | 'walk' | 'talk' | 'battle' | 'defeat';
}

/** One NPC as the E2E hooks see it. `state` is `null` for NPCs that are not enemies. */
export interface NpcView {
  id: string;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  talking: boolean;
  state: NpcState | null;
  alert: boolean;
}

/** Number of white flashes in the battle transition. */
const BATTLE_FLASHES = 3;

/** Longest frame time fed to movement (ms), so a stalled tab does not teleport the player. */
const MAX_FRAME_MS = 250;

/** Tile layers drawn, with their depth. */
const DRAWN_LAYERS: [name: string, depth: number][] = [
  ['ground', 0],
  ['deco', 1],
  ['above', 3],
];

/** The walking-around scene. */
export class OverworldScene extends Phaser.Scene {
  private target!: OverworldData;
  private zone!: Zone;
  private info!: MapInfo;
  private player: Player | null = null;
  /** Solid tiles and map edges for the player (warp tiles outside the map are open). */
  private blocked: (x: number, y: number) => boolean = () => true;
  private npcs: NpcActor[] = [];
  private dialog: DialogBox | null = null;
  private choice: ChoiceBox | null = null;
  /** Result of the last {@link openChoice} (`undefined` = none chosen yet). For the E2E hooks. */
  private lastChoice: number | null | undefined = undefined;
  /** True during a warp fade: the player cannot move. */
  private locked = false;
  private debugMenuOpen = false;
  /** Enemy NPC sequence in progress (M8), or `null`. */
  private engagement: Engagement | null = null;
  /** Key of the overlay scene open over this one (M9: Shop, Storage), or `null`. */
  private overlay: string | null = null;
  /** Steps left without encounter rolls (`SAFE_STEPS` after every map entry and battle). */
  safeSteps = 0;

  constructor() {
    super(OVERWORLD_SCENE);
  }

  init(data: OverworldData): void {
    this.target = data;
    this.player = null;
    this.npcs = [];
    this.dialog = null;
    this.choice = null;
    this.locked = false;
    this.engagement = null;
    this.overlay = null;
    const zone = getGameData().zones.get(data.map);
    if (!zone) throw new Error(`Overworld: unknown zone "${data.map}"`);
    this.zone = zone;
  }

  create(): void {
    const loaded = getGameData().maps.get(this.zone.id);
    if (!loaded) throw new Error(`Overworld: map of "${this.zone.id}" not loaded`);
    this.info = loaded.info as MapInfo;
    const info = this.info;
    const file = this.zone.file;
    if (!this.cache.tilemap.exists(file)) {
      this.cache.tilemap.add(file, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: structuredClone(loaded.json),
      });
    }

    const map = this.make.tilemap({ key: file });
    const tilesets = info.tilesetImages
      .map((ts) => map.addTilesetImage(ts.name, ts.path))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
    for (const [name, depth] of DRAWN_LAYERS) {
      if (map.getLayerIndex(name) === null) continue;
      map.createLayer(name, tilesets)?.setDepth(depth);
    }
    this.blocked = blockedWithWarps(info, info.warps, (x, y) => isBlocked(info, x, y));

    const spawn = findSpawn(info) ?? { x: 0, y: 0 };
    const x = this.target.x ?? spawn.x;
    const y = this.target.y ?? spawn.y;
    this.player = new Player(this, x, y, this.target.facing ?? 'down');
    this.npcs = npcsOnMap(getGameData().npcs.values(), this.zone.id).map(
      (n) => new NpcActor(this, n, rng, t('npc.alert')),
    );
    this.dialog = new DialogBox(this);
    this.choice = new ChoiceBox(this);
    this.safeSteps = resetSafeSteps();

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x000000);
    const b = cameraBounds(map.widthInPixels, map.heightInPixels);
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.startFollow(this.player.sprite, true, 1, 1, -TILE_SIZE / 2, -TILE_SIZE / 2);
    const messages = this.target.messages ?? [];
    const showMessages = () => {
      if (messages.length) this.dialog?.open(messages);
    };
    if (this.target.fadeIn) {
      this.locked = true;
      cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.locked = false;
        showMessages();
      });
    } else showMessages();
    this.updateCooldowns(x, y);

    const offs = [
      events.on('debug:teleport', ({ map: zoneId }) => this.teleport(zoneId)),
      events.on('debug:battle', ({ speciesId }) => {
        this.startBattle({ speciesId });
      }),
      events.on('battle:ended', ({ result }) => this.returnFromBattle(result)),
      events.on('debug:menu', ({ open }) => {
        this.debugMenuOpen = open;
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));

    log(`Overworld: entered ${this.zone.id} at ${x},${y}`);
    events.emit('zone:entered', { zone: this.zone.id });
    this.emitMoved();
  }

  override update(_time: number, delta: number): void {
    const player = this.player;
    if (!player) return;
    const dt = Math.min(delta, MAX_FRAME_MS);
    const talking = this.isTalking();
    if (this.dialog?.isOpen) this.dialog.update(dt);
    else if (this.choice?.isOpen) this.choice.update();
    let npcStepped = false;
    for (const npc of this.npcs) {
      const evs = npc.update(dt, (nx, ny) => this.blockedForNpc(npc, nx, ny), rng);
      if (evs.some((e) => e.type === 'step_end')) npcStepped = true;
    }
    this.updateEngagement();

    const frozen = this.locked || this.debugMenuOpen || talking || this.engagement !== null;
    const dir = frozen ? null : input.direction();
    const fresh = dir !== null && input.justPressed(dir);
    const moves = player.update(dir, dt, (px, py) => this.blockedForPlayer(px, py), fresh);
    if (moves.some((m) => m.type === 'step_end')) {
      this.emitMoved();
      const s = player.state;
      const warp = warpAt(this.info.warps, s.x, s.y, 'step');
      if (warp) {
        this.warpTo(warpDestination(warp, s));
        return;
      }
      const end = moves.find((m) => m.type === 'step_end'); // At most one per frame.
      if (end?.type === 'step_end') {
        this.updateCooldowns(end.x, end.y);
        if (this.lookForPlayer(end)) return;
        if (this.encounterStep(end.x, end.y)) return;
      }
    } else if (npcStepped && !frozen && !player.state.step) {
      const s = player.state;
      this.updateCooldowns(s.x, s.y);
      if (this.lookForPlayer(s)) return;
    }
    if (!frozen && input.justPressed('a') && !player.state.step) {
      const s = player.state;
      const d = FACING_DELTA[s.facing];
      const npc = this.npcs.find((n) => {
        const at = n.arrival();
        return at.x === s.x + d.x && at.y === s.y + d.y;
      });
      if (npc) {
        this.talkTo(npc);
        return;
      }
      const warp = warpAt(this.info.warps, s.x + d.x, s.y + d.y, 'action');
      if (warp) this.warpTo(warpDestination(warp, s));
    }
  }

  /**
   * Start a battle against one fresh flexymon of `speciesId` (zero bonus, full HP). Refused (returns
   * false) while input is locked, a box is open or the player is mid-step; also while asleep in a battle.
   */
  startBattle(req: BattleRequest): boolean {
    const player = this.player;
    const species = getGameData().flexymon.get(req.speciesId);
    if (!player || !species || this.isLocked() || player.state.step || !this.sys.isActive()) return false;
    this.launchBattle({
      kind: req.kind ?? 'wild',
      opponent: [createInstance(species, rng)],
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    });
    return true;
  }

  /** Lock input, flash `BATTLE_FLASH_MS`, then launch the BattleScene with `data` and sleep. */
  private launchBattle(data: BattleSceneData): void {
    this.locked = true;
    const cam = this.cameras.main;
    const each = BATTLE_FLASH_MS / BATTLE_FLASHES;
    for (let i = 0; i < BATTLE_FLASHES; i++) {
      this.time.delayedCall(i * each, () => cam.flash(each, 255, 255, 255, true));
    }
    this.time.delayedCall(BATTLE_FLASH_MS, () => {
      log(`Overworld: ${data.kind} battle vs ${data.opponent.map((o) => o.speciesId).join(', ')}`);
      this.scene.launch(BATTLE_SCENE, data);
      this.scene.sleep();
    });
  }

  /**
   * Enemy NPCs (M8): if a `ready` enemy on this map sees the player standing on `at`, halt the player
   * there and start its sequence. Returns true if one did. Nobody looks while a sequence runs.
   */
  private lookForPlayer(at: Point): boolean {
    if (this.engagement || this.locked || !this.player) return false;
    const lookouts: Lookout[] = this.npcs.flatMap((n) =>
      isEnemy(n.npc)
        ? [
            {
              id: n.npc.id,
              x: n.state.x,
              y: n.state.y,
              facing: n.state.facing,
              sight: n.npc.sight,
              free: !n.state.step && !n.state.talking,
            },
          ]
        : [],
    );
    const seen = findSpotter(
      lookouts,
      gameState().npcs,
      at,
      (x, y) => isBlocked(this.info, x, y) || this.npcs.some((n) => n.occupies(x, y)),
    );
    const actor = seen && this.npcs.find((n) => n.npc.id === seen.id);
    if (!seen || !actor) return false;
    this.player.halt(at.x, at.y);
    this.emitMoved();
    log(`Overworld: spotted by ${seen.id} at distance ${seen.distance}`);
    actor.engage();
    this.engage(actor, seen.path);
    return true;
  }

  /** Start an enemy sequence with `actor` (already paused): "!" bubble for `NPC_ALERT_MS`, then walk `path`. */
  private engage(actor: NpcActor, path: Point[]): void {
    const engagement: Engagement = { npc: actor, path: [...path], phase: 'alert' };
    this.engagement = engagement;
    actor.showAlert(true);
    this.time.delayedCall(NPC_ALERT_MS, () => {
      actor.showAlert(false);
      if (this.engagement === engagement) engagement.phase = 'walk';
    });
  }

  /**
   * Each frame of the `walk` phase: step the NPC along its path (waiting while the next tile is taken);
   * once adjacent, both face each other and the NPC says its `dialogue`, then the battle starts.
   */
  private updateEngagement(): void {
    const e = this.engagement;
    const player = this.player;
    if (!e || e.phase !== 'walk' || !player || e.npc.state.step) return;
    const next = e.path[0];
    if (next) {
      if (this.blockedForNpc(e.npc, next.x, next.y)) return;
      e.path.shift();
      e.npc.stepTo(next);
      return;
    }
    const p = player.state;
    const n = e.npc.state;
    const toPlayer: Facing = p.x > n.x ? 'right' : p.x < n.x ? 'left' : p.y > n.y ? 'down' : 'up';
    e.npc.face(toPlayer);
    player.face(oppositeFacing(toPlayer));
    e.phase = 'talk';
    this.dialog?.open(e.npc.npc.dialogue, {
      voice: e.npc.npc.voice,
      onClose: () => this.startNpcBattle(e),
    });
  }

  /** The enemy finished talking: battle against a fresh copy of its team. */
  private startNpcBattle(e: Engagement): void {
    const npc = e.npc.npc;
    if (!isEnemy(npc)) return;
    e.phase = 'battle';
    const opponent: FlexymonInstance[] = npcTeam(npc, getGameData().flexymon, rng);
    this.launchBattle({ kind: 'npc', opponent, npcId: npc.id });
  }

  /** Return `cooldown` enemies to `ready` when the player (on tile x, y) is far enough or elsewhere. */
  private updateCooldowns(x: number, y: number): void {
    const gs = gameState();
    const positions = new Map(this.npcs.map((n) => [n.npc.id, { x: n.state.x, y: n.state.y }]));
    const enemies = placedEnemies(getGameData().npcs.values(), this.zone.id, positions);
    const next = refreshCooldowns(gs.npcs, enemies, { map: this.zone.id, x, y });
    if (next !== gs.npcs) setGameState({ ...gs, npcs: { ...next } });
  }

  /**
   * Wild encounters (M7): run the encounter rules for a step that just ended on (x, y). On an encounter
   * the player halts on that tile (a step already started by a held key is dropped) and a wild battle
   * starts. With the debug flag `encounters` off nothing rolls, but safe steps still run down.
   * Returns true if a battle started.
   */
  private encounterStep(x: number, y: number): boolean {
    if (!debugFlags.encounters) {
      this.safeSteps = Math.max(0, this.safeSteps - 1);
      return false;
    }
    const result = checkStep(
      {
        safeSteps: this.safeSteps,
        rects: this.info.encounters,
        groups: this.zone.encounters,
        x,
        y,
        tileHasEncounter: this.info.encounter[y * this.info.width + x] === true,
      },
      rng,
    );
    this.safeSteps = result.safeSteps;
    if (result.speciesId === null || !this.player) return false;
    this.player.halt(x, y);
    this.emitMoved();
    log(`Overworld: wild ${result.speciesId} at ${x},${y}`);
    return this.startBattle({ speciesId: result.speciesId });
  }

  /**
   * After a battle. Lost (M8): restart at the respawn point already in the game state, with the "woke up"
   * message. Otherwise wake up on the same tile: fade in, reset safe steps, unlock; after beating an
   * enemy NPC it first says its `defeatDialogue`.
   */
  private returnFromBattle(result: 'win' | 'lose' | 'fled'): void {
    if (!this.sys.isSleeping()) return;
    this.scene.wake();
    if (result === 'lose') {
      const p = gameState().player;
      log(`Overworld: lost, waking up at ${p.map} ${p.x},${p.y}`);
      this.scene.restart({
        map: p.map,
        x: p.x,
        y: p.y,
        facing: p.facing,
        fadeIn: true,
        messages: [t('lose.woke_up')],
      } satisfies OverworldData);
      return;
    }
    this.safeSteps = resetSafeSteps();
    const cam = this.cameras.main;
    cam.resetFX();
    cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.locked = false;
      const e = this.engagement;
      if (!e) return;
      const npc = e.npc.npc;
      if (result !== 'win' || !isEnemy(npc)) {
        e.npc.finishTalk(rng);
        this.engagement = null;
        return;
      }
      e.phase = 'defeat';
      this.dialog?.open(npc.defeatDialogue, {
        voice: npc.voice,
        onClose: () => {
          e.npc.finishTalk(rng);
          this.engagement = null;
        },
      });
    });
    this.emitMoved();
  }

  /** Lock input, fade out, then restart on the target (which fades in and unlocks). */
  warpTo(target: WarpTarget): void {
    if (this.locked || this.engagement) return;
    this.locked = true;
    const cam = this.cameras.main;
    cam.fadeOut(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data: OverworldData = { ...target, fadeIn: true };
      this.scene.restart(data);
    });
  }

  /**
   * Start a conversation with `npc`; the player is frozen until the last box closes. A `ready` enemy
   * starts its battle sequence instead (M8); a `cooldown` one says its `defeatDialogue`. M9: a healer heals
   * the team and storage first and asks for an auto-save afterwards; a storage NPC opens the storage box
   * and a shopkeeper its shop after their dialogue (see {@link openOverlay}).
   */
  private talkTo(npc: NpcActor): void {
    const player = this.player;
    if (!player || !this.dialog) return;
    npc.beginTalk(player.state.facing);
    const state = npcState(gameState().npcs, npc.npc.id);
    if (isEnemy(npc.npc) && state === 'ready') {
      log(`Overworld: challenged ${npc.npc.id}`);
      this.engage(npc, []);
      return;
    }
    log(`Overworld: talking to ${npc.npc.id}`);
    const action = talkAction(npc.npc);
    if (action === 'heal') {
      const gs = gameState();
      setGameState({ ...gs, ...healParty(gs, getGameData().flexymon) });
      log(`Overworld: ${npc.npc.id} healed the team and storage`);
    }
    const target = npc.npc;
    this.dialog.open(talkLines(target, t, state), {
      voice: target.voice,
      onClose: () => {
        if (action === 'storage') return this.openOverlay(npc, STORAGE_SCENE, {});
        if (action === 'shop' && target.type === 'shopkeeper') {
          return this.openOverlay(npc, SHOP_SCENE, { shopId: target.shop } satisfies ShopSceneData);
        }
        npc.finishTalk(rng);
        if (action === 'heal') events.emit('save:request', { reason: 'healer' });
      },
    });
  }

  /**
   * Open an overlay scene (M9: Shop, Storage) over this one: launch it and pause this scene (map, player
   * and NPCs freeze, still drawn underneath). On `overlay:closed` this scene resumes and `npc` goes back
   * to wandering.
   */
  private openOverlay(npc: NpcActor, key: string, data: object): void {
    this.overlay = key;
    const off = events.on('overlay:closed', ({ scene }) => {
      if (scene !== key) return;
      off();
      this.overlay = null;
      this.scene.resume();
      npc.finishTalk(rng);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.scene.launch(key, data);
    this.scene.pause();
  }

  /** Player blocking: solid tiles, map edges (except warp tiles) and any tile an NPC occupies. */
  private blockedForPlayer(x: number, y: number): boolean {
    return this.blocked(x, y) || this.npcs.some((n) => n.occupies(x, y));
  }

  /**
   * NPC blocking: solid tiles, map edges, warp tiles, the player's tiles, the other NPCs' tiles and (M8)
   * the tiles an approaching enemy still has to walk.
   */
  private blockedForNpc(self: NpcActor, x: number, y: number): boolean {
    if (isBlocked(this.info, x, y)) return true;
    const e = this.engagement;
    if (e && e.npc !== self && e.path.some((p) => p.x === x && p.y === y)) return true;
    if (this.info.warps.some((w) => insideWarp(w, x, y))) return true;
    const p = this.player?.state;
    if (p && ((p.x === x && p.y === y) || (p.step && p.step.to.x === x && p.step.to.y === y))) return true;
    return this.npcs.some((n) => n !== self && n.occupies(x, y));
  }

  /** True while a dialogue or choice box is open. */
  isTalking(): boolean {
    return !!(this.dialog?.isOpen || this.choice?.isOpen);
  }

  /** The NPCs on this map with their tile and state (for hooks and tests). */
  npcList(): NpcView[] {
    const states = gameState().npcs;
    return this.npcs.map((n) => {
      const s = n.state;
      return {
        id: n.npc.id,
        x: s.x,
        y: s.y,
        facing: s.facing,
        moving: s.step !== null,
        talking: s.talking,
        state: isEnemy(n.npc) ? npcState(states, n.npc.id) : null,
        alert: n.alerting,
      };
    });
  }

  /** The open dialogue box, or `null`. */
  dialogState(): DialogState | null {
    return this.dialog?.state() ?? null;
  }

  /** The open choice box, or `null`. */
  choiceState(): ChoiceState | null {
    return this.choice?.state() ?? null;
  }

  /**
   * Open a ChoiceBox with `options` (test hook; real uses arrive with M7/M9). The player is frozen until
   * it closes; the result is read with {@link choiceResult}.
   */
  openChoice(options: string[]): void {
    this.lastChoice = undefined;
    this.choice?.open(options, {
      onChoose: (i) => {
        this.lastChoice = i;
      },
    });
  }

  /** Index chosen in the last {@link openChoice}, `null` if cancelled, `undefined` if none yet. */
  choiceResult(): number | null | undefined {
    return this.lastChoice;
  }

  /** Debug: go to a zone's `default` spawn (tile 0, 0 if the map has none). */
  private teleport(zoneId: string): void {
    const loaded = getGameData().maps.get(zoneId);
    if (!loaded || !this.player || !this.sys.isActive()) return;
    const spawn = findSpawn(loaded.info as MapInfo) ?? { x: 0, y: 0 };
    this.warpTo({ map: zoneId, x: spawn.x, y: spawn.y, facing: 'down' });
  }

  /** The player's tile and facing (for hooks and the debug overlay), or `null` before the map is built. */
  playerTile(): { map: string; x: number; y: number; facing: Facing; moving: boolean } | null {
    if (!this.player) return null;
    const s = this.player.state;
    return { map: this.zone.id, x: s.x, y: s.y, facing: s.facing, moving: s.step !== null };
  }

  /**
   * True while the player cannot move: warp fade, debug menu, a dialogue/choice box, an enemy sequence, an
   * open shop or storage box (M9).
   */
  isLocked(): boolean {
    return (
      this.locked ||
      this.debugMenuOpen ||
      this.isTalking() ||
      this.engagement !== null ||
      this.overlay !== null
    );
  }

  private emitMoved(): void {
    const t = this.playerTile();
    if (t) events.emit('player:moved', { map: t.map, x: t.x, y: t.y, facing: t.facing });
  }
}
