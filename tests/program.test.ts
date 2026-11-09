import { describe, expect, it } from 'vitest';
import { CARDIO_MINUTES_PER_WEEK, PLAN_DAYS, PROGRAM_WEEKS, allPlanExercises } from '../src/data/plan';
import { cardioTargetForWeek, dateFor, plannedLoadLb, programCalendar, programDayFor, setsFor, setsForWeek } from '../src/lib/program';

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
    const plank = PLAN_DAYS.A.exercises.find((e) => e.id === 'front-plank')!;
    expect(setsFor(plank, 4)).toBe(2);
  });

  it('cardio semanal', () => {
    expect(Array.from({ length: 13 }, (_, i) => cardioTargetForWeek(i + 1))).toEqual([...CARDIO_MINUTES_PER_WEEK]);
  });

  it('cada ejercicio con carga tiene 13 valores', () => {
    for (const ex of allPlanExercises()) {
      if (ex.loadType === 'body') expect(ex.loads).toHaveLength(0);
      else expect(ex.loads).toHaveLength(PROGRAM_WEEKS);
    }
  });

  it('cargas del plan', () => {
    const goblet = PLAN_DAYS.A.exercises[0];
    expect(plannedLoadLb(goblet, 1)).toBe(8);
    expect(plannedLoadLb(goblet, 13)).toBe(20);
    expect(plannedLoadLb(PLAN_DAYS.D.exercises[1], 8)).toBe(5);
  });
});
