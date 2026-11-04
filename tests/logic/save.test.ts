import { describe, expect, it } from 'vitest';
import { parseSave, serializeSave, type GameState } from '../../src/logic/save';
import { gameData, inst } from './helpers';

const data = gameData();

const state = (): GameState => ({
  player: { name: 'Rogelio', map: 'test', x: 4, y: 6, facing: 'down' },
  euros: 340,
  teamSlots: 2,
  team: [inst('portatil', 'a1', { bonus: { hp: 4, attack: 0, defense: 1, speed: 0 }, currentHp: 31 })],
  storage: [],
  items: { cafe: 2 },
  npcs: { becario_rio: 'cooldown' },
});

/** Serialize, then let `edit` change the raw JSON object. */
const saved = (edit: (raw: Record<string, unknown> & ReturnType<typeof state>) => void = () => undefined) => {
  const raw = JSON.parse(serializeSave(state(), new Date('2026-11-04T21:00:00Z')));
  edit(raw);
  return JSON.stringify(raw);
};

describe('save', () => {
  it('round-trips the plan example format', () => {
    const text = serializeSave(state(), new Date('2026-11-04T21:00:00Z'));
    expect(JSON.parse(text)).toMatchObject({ version: 1, savedAt: '2026-11-04T21:00:00.000Z', euros: 340 });
    const r = parseSave(text, data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.team).toEqual(state().team);
    expect(r.state.player).toEqual(state().player);
    expect(r.savedAt).toBe('2026-11-04T21:00:00.000Z');
    expect(r.state.npcs).toEqual({ becario_rio: 'cooldown' });
    expect(r.warnings).toEqual([]);
  });

  it('garbage JSON and schema failures are reported, never thrown', () => {
    expect(parseSave('{not json', data)).toMatchObject({ ok: false, reason: 'invalid_json' });
    expect(parseSave('null', data)).toMatchObject({ ok: false, reason: 'invalid_schema' });
    expect(
      parseSave(
        saved((r) => (r.version = 2 as never)),
        data,
      ),
    ).toMatchObject({ ok: false, reason: 'invalid_schema' });
    expect(
      parseSave(
        saved((r) => (r.euros = -1)),
        data,
      ),
    ).toMatchObject({
      ok: false,
      reason: 'invalid_schema',
      detail: expect.stringContaining('euros'),
    });
  });

  it('drops unknown flexymon, items and NPCs with warnings', () => {
    const r = parseSave(
      saved((raw) => {
        raw.team.push({ ...inst('raton', 'gone'), speciesId: 'dragon' });
        raw.items = { cafe: 2, espada: 1, redbull: 0 };
        raw.npcs = { fantasma: 'ready' };
      }),
      data,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.team.map((m) => m.uid)).toEqual(['a1']);
    expect(r.state.items).toEqual({ cafe: 2 });
    expect(r.state.npcs).toEqual({});
    expect(r.warnings.join('\n')).toMatch(/dragon[\s\S]*espada[\s\S]*fantasma/);
  });

  it('clamps bonus and HP that no longer fit the content', () => {
    const r = parseSave(
      saved((raw) => {
        raw.team[0]!.bonus.attack = 50; // base 12 → max bonus 12
        raw.team[0]!.currentHp = 500;
      }),
      data,
    );
    expect(r.ok && r.state.team[0]).toMatchObject({ bonus: { attack: 12 }, currentHp: 44 });
    expect(r.ok && r.warnings).toHaveLength(2);
  });

  it('moves extra team members to storage, fills an empty team, fails with no flexymon', () => {
    const over = parseSave(
      saved((raw) => {
        raw.team.push(inst('raton', 'r'), inst('teclado', 't'));
      }),
      data,
    );
    expect(over.ok && over.state.team.map((m) => m.uid)).toEqual(['a1', 'r']);
    expect(over.ok && over.state.storage.map((m) => m.uid)).toEqual(['t']);
    const empty = parseSave(
      saved((raw) => {
        raw.storage = raw.team;
        raw.team = [];
      }),
      data,
    );
    expect(empty.ok && empty.state.team.map((m) => m.uid)).toEqual(['a1']);
    const none = parseSave(
      saved((raw) => (raw.team = [])),
      data,
    );
    expect(none).toMatchObject({ ok: false, reason: 'empty_team' });
  });

  it('an unknown map puts the player at the respawn point', () => {
    const r = parseSave(
      saved((raw) => (raw.player.map = 'atlantida')),
      data,
    );
    expect(r.ok && r.state.player).toEqual({ name: 'Rogelio', ...data.start.respawn });
  });
});
