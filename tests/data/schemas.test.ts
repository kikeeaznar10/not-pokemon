import { describe, expect, it } from 'vitest';
import { validateGameData } from '../../src/data/loader';
import { errorsAfter, validFiles } from './fixture';

describe('schemas: valid fixture', () => {
  it('the shipped public/data passes', () => {
    const result = validateGameData(validFiles());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

describe('schemas: one broken fixture per rule', () => {
  it('flexymon: 1 to 3 attacks', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][0].attacks = []))).toEqual([
      'flexymon.json › [0].attacks › needs 1 to 3 attacks',
    ]);
    expect(errorsAfter((f) => f['flexymon.json'][0].attacks.push('pulsacion'))).toEqual([
      'flexymon.json › [0].attacks › needs 1 to 3 attacks',
    ]);
  });

  it('flexymon: stats are whole numbers 1–999', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][1].stats.hp = 0))[0]).toMatch(
      /^flexymon\.json › \[1\]\.stats\.hp › /,
    );
    expect(errorsAfter((f) => (f['flexymon.json'][1].stats.speed = 1000))[0]).toMatch(/\[1\]\.stats\.speed/);
    expect(errorsAfter((f) => (f['flexymon.json'][1].stats.attack = 2.5))[0]).toMatch(/\[1\]\.stats\.attack/);
  });

  it('flexymon: sprite paths are PNGs, cry is a sound', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][0].sprite.icon = 'portatil.gif'))).toEqual([
      'flexymon.json › [0].sprite.icon › must be a path like assets/….png',
    ]);
    expect(errorsAfter((f) => (f['flexymon.json'][0].cry = 'assets/cry.wav'))).toEqual([
      'flexymon.json › [0].cry › must be a path like assets/….ogg',
    ]);
  });

  it('ids are snake_case; required fields; unknown fields rejected', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][0].id = 'Portatil'))).toEqual([
      'flexymon.json › [0].id › must be a snake_case id',
    ]);
    expect(errorsAfter((f) => delete f['flexymon.json'][0].name)[0]).toMatch(
      /^flexymon\.json › \[0\]\.name › /,
    );
    expect(errorsAfter((f) => (f['flexymon.json'][0].nmae = 'x'))).toEqual([
      'flexymon.json › [0] › Unrecognized key: "nmae"',
    ]);
  });

  it('attacks: ranges for accuracy and effects', () => {
    expect(errorsAfter((f) => (f['attacks.json'][0].accuracy = 0))[0]).toMatch(
      /^attacks\.json › \[0\]\.accuracy/,
    );
    expect(errorsAfter((f) => (f['attacks.json'][0].effect.power = 201))[0]).toMatch(/\[0\]\.effect\.power/);
    expect(errorsAfter((f) => (f['attacks.json'][1].effect.percent = 101))[0]).toMatch(
      /\[1\]\.effect\.percent/,
    );
    expect(errorsAfter((f) => (f['attacks.json'][2].effect.turns = 10))[0]).toMatch(/\[2\]\.effect\.turns/);
    expect(errorsAfter((f) => (f['attacks.json'][2].effect.stat = 'hp'))[0]).toMatch(/\[2\]\.effect\.stat/);
    expect(errorsAfter((f) => (f['attacks.json'][0].effect.type = 'poison'))[0]).toMatch(
      /\[0\]\.effect\.type/,
    );
  });

  it('attacks: heal/buff must target self, damage/debuff must target enemy', () => {
    expect(errorsAfter((f) => (f['attacks.json'][0].target = 'self'))).toEqual([
      'attacks.json › [0].target › a damage attack must target "enemy"',
    ]);
    expect(errorsAfter((f) => (f['attacks.json'][1].target = 'enemy'))).toEqual([
      'attacks.json › [1].target › a heal attack must target "self"',
    ]);
    expect(errorsAfter((f) => (f['attacks.json'][2].target = 'self'))).toEqual([
      'attacks.json › [2].target › a debuff attack must target "enemy"',
    ]);
    expect(errorsAfter((f) => (f['attacks.json'][5].target = 'enemy'))).toEqual([
      'attacks.json › [5].target › a buff attack must target "self"',
    ]);
  });

  it('items: price null or ≥ 0, usableIn values, effect types', () => {
    expect(errorsAfter((f) => (f['items.json'][0].price = -1))[0]).toMatch(/^items\.json › \[0\]\.price/);
    expect(errorsAfter((f) => (f['items.json'][0].usableIn = ['menu']))[0]).toMatch(/\[0\]\.usableIn\[0\]/);
    expect(errorsAfter((f) => (f['items.json'][0].usableIn = ['battle', 'battle']))).toEqual([
      'items.json › [0].usableIn › has duplicates',
    ]);
    expect(errorsAfter((f) => (f['items.json'][0].effect = { type: 'revive', percent: 0 }))[0]).toMatch(
      /\[0\]\.effect\.percent/,
    );
    for (const effect of [{ type: 'heal_full' }, { type: 'catch' }, { type: 'revive', percent: 50 }]) {
      expect(errorsAfter((f) => (f['items.json'][0].effect = effect))).toEqual([]);
    }
  });

  it('npcs: per-type required fields', () => {
    expect(errorsAfter((f) => delete f['npcs.json'][1].sight)[0]).toMatch(/^npcs\.json › \[1\]\.sight/);
    expect(errorsAfter((f) => delete f['npcs.json'][1].defeatDialogue)[0]).toMatch(/\[1\]\.defeatDialogue/);
    expect(errorsAfter((f) => delete f['npcs.json'][1].reward)[0]).toMatch(/\[1\]\.reward/);
    expect(errorsAfter((f) => (f['npcs.json'][1].team = []))).toEqual([
      'npcs.json › [1].team › needs 1 to 6 flexymon',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][1].team = Array(7).fill('raton')))).toEqual([
      'npcs.json › [1].team › needs 1 to 6 flexymon',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][0].type = 'shopkeeper'))[0]).toMatch(
      /^npcs\.json › \[0\]\.shop/,
    );
    expect(errorsAfter((f) => (f['npcs.json'][0].type = 'wizard'))[0]).toMatch(/^npcs\.json › \[0\]\.type/);
    // A talker must not carry enemy fields.
    expect(errorsAfter((f) => (f['npcs.json'][0].sight = 3))).toEqual([
      'npcs.json › [0] › Unrecognized key: "sight"',
    ]);
    for (const type of ['healer', 'storage'])
      expect(errorsAfter((f) => (f['npcs.json'][0].type = type))).toEqual([]);
  });

  it('npcs: reward min ≤ max, stepEveryMs min ≤ max, dialogue not empty', () => {
    expect(errorsAfter((f) => (f['npcs.json'][1].reward = { min: 200, max: 100 }))).toEqual([
      'npcs.json › [1].reward.min › min must not be greater than max',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][1].wander.stepEveryMs = [3000, 1200]))).toEqual([
      'npcs.json › [1].wander.stepEveryMs › min must not be greater than max',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][0].dialogue = []))).toEqual([
      'npcs.json › [0].dialogue › needs at least one line',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][0].dialogue = ['  ']))).toEqual([
      'npcs.json › [0].dialogue[0] › must not be empty',
    ]);
  });

  it('npcs: spawn must be inside the wander rectangle', () => {
    // Rectangle x 36..43, y 20..24.
    expect(errorsAfter((f) => (f['npcs.json'][1].spawn = { x: 43, y: 24 }))).toEqual([]);
    expect(errorsAfter((f) => (f['npcs.json'][1].spawn = { x: 44, y: 22 }))).toEqual([
      'npcs.json › [1].spawn › spawn must be inside the wander rectangle',
    ]);
    expect(errorsAfter((f) => (f['npcs.json'][1].spawn = { x: 40, y: 19 }))).toEqual([
      'npcs.json › [1].spawn › spawn must be inside the wander rectangle',
    ]);
  });

  it('zones: file path, rate 1–100, weights positive', () => {
    expect(errorsAfter((f) => (f['zones.json'][0].file = 'valencia.json'))).toEqual([
      'zones.json › [0].file › must be a path like maps/….tmj',
    ]);
    expect(errorsAfter((f) => (f['zones.json'][0].encounters.jardin_turia.rate = 0))[0]).toMatch(
      /^zones\.json › \[0\]\.encounters\.jardin_turia\.rate/,
    );
    expect(
      errorsAfter((f) => (f['zones.json'][0].encounters.jardin_turia.flexymon[0].weight = 0))[0],
    ).toMatch(/\[0\]\.encounters\.jardin_turia\.flexymon\[0\]\.weight/);
  });

  it('start: euros, team slots and item counts in range', () => {
    expect(errorsAfter((f) => (f['start.json'].euros = 1_000_000))[0]).toMatch(/^start\.json › euros/);
    expect(errorsAfter((f) => (f['start.json'].teamSlots = 7))[0]).toMatch(/^start\.json › teamSlots/);
    expect(errorsAfter((f) => (f['start.json'].items.cafe = 100))[0]).toMatch(/^start\.json › items\.cafe/);
    expect(errorsAfter((f) => (f['start.json'].spawn.facing = 'north'))[0]).toMatch(
      /^start\.json › spawn\.facing/,
    );
  });

  it('car: pairs are two ids, at least one pair', () => {
    expect(errorsAfter((f) => (f['car.json'].unlockPairs = []))).toEqual([
      'car.json › unlockPairs › needs at least one pair',
    ]);
    expect(errorsAfter((f) => f['car.json'].unlockPairs[0].push('cafe'))[0]).toMatch(
      /^car\.json › unlockPairs\[0\]/,
    );
  });

  it('shops: at least one item, no duplicates', () => {
    expect(errorsAfter((f) => (f['shops.json'].tienda_alboraya = []))).toEqual([
      'shops.json › tienda_alboraya › a shop needs at least one item',
    ]);
  });

  it('reports schema errors in every file at once', () => {
    const errors = errorsAfter((f) => {
      f['flexymon.json'][0].stats.hp = 0;
      f['car.json'].lockedDialogue = [];
    });
    expect(errors.map((e) => e.split(' › ')[0])).toEqual(['flexymon.json', 'car.json']);
  });
});
