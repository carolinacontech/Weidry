import { describe, expect, it } from 'vitest';
import { EXERCISES, PLAN_DAYS } from '../src/data/plan';
import { createSession, proposedOption } from '../src/lib/session';
import type { WorkoutSession } from '../src/lib/types';
import { DEFAULT_INVENTORY } from '../src/lib/weights';

const goblet = EXERCISES['goblet-squat'];
const gobletSlot = PLAN_DAYS.A.slots.find((s) => s.exerciseId === 'goblet-squat')!;
const base = { ex: goblet, slot: gobletSlot, inventory: DEFAULT_INVENTORY, adjustments: [], sessions: [] as WorkoutSession[], unit: 'lb' as const };

function doneSession(week: number, lb: number, startedAt = '2026-11-09T10:00:00.000Z'): WorkoutSession {
  return {
    id: `s${week}-${lb}`,
    date: '2026-11-09',
    week,
    dayKey: 'A',
    status: 'completed',
    startedAt,
    updatedAt: startedAt,
    phase: 'summary',
    exerciseIndex: 0,
    exercises: [
      { exerciseId: 'goblet-squat', status: 'done', plannedSets: 2, sets: [{ setNumber: 1, reps: 10, option: { kind: 'db', lb }, loadLb: lb, rir: 2, pain: false, techniqueOk: true, completedAt: startedAt }] },
    ],
  };
}

describe('propuesta de carga', () => {
  it('sin historial usa la tabla del plan', () => {
    expect(proposedOption({ ...base, week: 1 }).option).toEqual({ kind: 'db', lb: 10 });
  });

  it('con historial NO sube sola aunque la tabla suba: mantiene tu nivel y lo indica', () => {
    const p = proposedOption({ ...base, week: 3, sessions: [doneSession(2, 10)] });
    expect(p.option).toMatchObject({ kind: 'db', lb: 10 });
    expect(p.planOption).toMatchObject({ kind: 'db', lb: 15 });
    expect(p.belowPlan).toBe(true);
  });

  it('un cambio aprobado se convierte en la nueva propuesta', () => {
    const adj = [{ exerciseId: 'goblet-squat', createdAt: '2026-11-09T11:00:00.000Z', option: { kind: 'db' as const, lb: 15 }, reason: 'test' }];
    expect(proposedOption({ ...base, week: 4, sessions: [doneSession(3, 10)], adjustments: adj }).option).toMatchObject({ kind: 'db', lb: 15 });
  });

  it('semana de recuperación: la opción más ligera entre tu nivel y la tabla', () => {
    const p = proposedOption({ ...base, week: 5, sessions: [doneSession(4, 15)] });
    expect(p.option).toMatchObject({ kind: 'db', lb: 10 });
    expect(p.recovery).toBe(true);
  });

  it('tras la recuperación vuelve a tu nivel (no se queda en la carga de descarga)', () => {
    const sessions = [doneSession(4, 15, '2026-12-03T10:00:00.000Z'), doneSession(5, 10, '2026-12-10T10:00:00.000Z')];
    expect(proposedOption({ ...base, week: 6, sessions }).option).toMatchObject({ kind: 'db', lb: 15 });
  });

  it('si el inventario pierde una mancuerna, propone la inferior disponible', () => {
    const inv = DEFAULT_INVENTORY.filter((i) => !(i.kind === 'fixed' && i.value === 15));
    const p = proposedOption({ ...base, inventory: inv, week: 4, sessions: [doneSession(3, 15)] });
    expect(p.option).toMatchObject({ kind: 'db', lb: 10 });
  });

  it('crea sesiones con menos series en semanas 5 y 9', () => {
    const s5 = createSession({ date: '2026-12-07', week: 5, dayKey: 'A', inventory: DEFAULT_INVENTORY, adjustments: [], sessions: [], unit: 'lb' });
    const s4 = createSession({ date: '2026-11-30', week: 4, dayKey: 'A', inventory: DEFAULT_INVENTORY, adjustments: [], sessions: [], unit: 'lb' });
    expect(s5.exercises[0].plannedSets).toBeLessThan(s4.exercises[0].plannedSets);
  });
});
