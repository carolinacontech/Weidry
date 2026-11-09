import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { AppDB } from '../src/lib/db';

describe('migración v1 → v2', () => {
  it('conserva el historial y sustituye el inventario por el equipamiento real', async () => {
    const name = 'mig-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({ kv: 'key', sessions: 'id, date, status, dayKey, week', measurements: '++id, date', cardio: '++id, date', adjustments: '++id, exerciseId, createdAt' });
    await v1.open();
    await v1.table('kv').bulkPut([
      { key: 'inventory', value: [{ id: 'inv-3', value: 3, unit: 'lb', count: 2 }] },
      { key: 'settings', value: { onboarded: true, askDifficulty: false } },
    ]);
    await v1.table('sessions').put({ id: 'old', date: '2026-11-09', status: 'completed', dayKey: 'A', week: 1, exercises: [] });
    await v1.table('cardio').add({ date: '2026-11-11', minutes: 40, activity: 'Caminata' });
    await v1.table('adjustments').add({ exerciseId: 'goblet-squat', createdAt: 'x', deltaLb: 2 });
    v1.close();

    const db = new AppDB(name);
    await db.open();
    const inv = (await db.kv.get('inventory'))!.value as { kind: string; value: number }[];
    expect(inv.filter((i) => i.kind === 'fixed').map((i) => i.value)).toEqual([10, 15, 20]);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.cardio.count()).toBe(1);
    expect(await db.adjustments.count()).toBe(0);
    const settings = (await db.kv.get('settings'))!.value as Record<string, unknown>;
    expect(settings.askRir).toBe(false);
    expect(settings.onboarded).toBe(true);
    db.close();
  });
});
