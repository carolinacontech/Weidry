import { describe, expect, it } from 'vitest';
import { DEFAULT_INVENTORY, ladderFor, optionIndex, resolveRx } from '../src/lib/weights';
import { CARDIO_MINUTES_PER_WEEK, EXERCISES, PLAN_DAYS, PROGRAM_WEEKS } from '../src/data/plan';
import { cardioTargetForWeek, dateFor, isRecoveryWeek, plannedRx, programCalendar, programDayFor, setsFor, setsForWeek } from '../src/lib/program';

describe('programa de 13 semanas', () => {
  it('empieza el lunes 2026-11-09 con Fuerza A', () => {
    const d = programDayFor('2026-11-09');
    expect(d).toMatchObject({ week: 1, dow: 0, dayKey: 'A', status: 'active' });
  });

  it('respeta la semana tipo', () => {
    const keys = Array.from({ length: 7 }, (_, i) => programDayFor(dateFor(1, i)).dayKey);
    expect(keys).toEqual(['A', 'B', 'cardio', 'C', 'D', 'cardio', 'rest']);
  });

  it('tiene 91 días y termina el domingo de la semana 13', () => {
    const cal = programCalendar();
    expect(cal).toHaveLength(91);
    expect(cal[90]).toMatchObject({ date: '2027-02-07', week: 13, dayKey: 'rest' });
    expect(programDayFor('2027-02-08').status).toBe('after');
    expect(programDayFor('2026-11-08').status).toBe('before');
  });

  it('series por semana según el plan (con semanas 5 y 9 de recuperación)', () => {
    expect(Array.from({ length: 13 }, (_, i) => setsForWeek(i + 1))).toEqual([2, 2, 3, 3, 2, 3, 3, 3, 2, 3, 3, 3, 3]);
  });

  it('core siempre dos series', () => {
    const plank = PLAN_DAYS.A.slots.find((e) => e.exerciseId === 'front-plank')!;
    expect(setsFor(plank, 4)).toBe(2);
  });

  it('cardio semanal', () => {
    expect(Array.from({ length: 13 }, (_, i) => cardioTargetForWeek(i + 1))).toEqual([...CARDIO_MINUTES_PER_WEEK]);
  });

  it('cada ejercicio tiene 13 prescripciones y solo usa 10/15/20 lb, peso corporal o alternativa ligera', () => {
    for (const day of Object.values(PLAN_DAYS))
      for (const slot of day.slots) {
        const ex = EXERCISES[slot.exerciseId];
        expect(ex, slot.exerciseId).toBeDefined();
        expect(slot.rx).toHaveLength(PROGRAM_WEEKS);
        for (const r of slot.rx) {
          if (r.kind === 'db') expect([10, 15, 20]).toContain(r.lb);
          if (r.kind === 'light') expect(ex.allowLight).toBe(true);
          if (r.kind === 'body' && ex.mode !== 'body') expect(ex.allowBody).toBe(true);
        }
      }
  });

  it('semanas 5 y 9: menos series y nunca más carga que la semana anterior', () => {
    const order = (r: ReturnType<typeof plannedRx>) => (r.kind === 'body' ? 0 : r.kind === 'light' ? 1 : r.lb);
    for (const w of [5, 9]) {
      expect(isRecoveryWeek(w)).toBe(true);
      expect(setsForWeek(w)).toBeLessThan(setsForWeek(w - 1));
      for (const day of Object.values(PLAN_DAYS)) for (const slot of day.slots) expect(order(plannedRx(slot, w))).toBeLessThanOrEqual(order(plannedRx(slot, w - 1)));
    }
  });

  it('no hay saltos de más de un escalón entre semanas consecutivas', () => {
    for (const day of Object.values(PLAN_DAYS))
      for (const slot of day.slots) {
        const lad = ladderFor(EXERCISES[slot.exerciseId], DEFAULT_INVENTORY);
        const idx = (w: number) => optionIndex(lad, resolveRx(slot.rx[w - 1], lad).option);
        for (let w = 2; w <= PROGRAM_WEEKS; w++) expect(idx(w) - idx(w - 1), `${slot.exerciseId} S${w}`).toBeLessThanOrEqual(1);
      }
  });

  it('prioriza glúteos: cada día de tren inferior tiene al menos 4 ejercicios de glúteo', () => {
    for (const k of ['A', 'C'] as const) expect(PLAN_DAYS[k].slots.filter((s) => EXERCISES[s.exerciseId].glute).length).toBeGreaterThanOrEqual(4);
  });
});
