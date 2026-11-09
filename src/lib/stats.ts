import { findPlanExercise, PROGRAM_WEEKS } from '../data/plan';
import { addDays } from './dates';
import { cardioTargetForWeek, dateFor, isStrengthDay, programDayFor, weekDates } from './program';
import type { ExerciseSessionResult } from './progression';
import type { CardioLog, LoadAdjustment, WorkoutSession } from './types';

/** Historial de un ejercicio (sin sustituciones), en orden cronológico. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): ExerciseSessionResult[] {
  return sessions
    .filter((s) => s.status !== 'abandoned')
    .slice()
    .sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt))
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && !e.substitute && e.sets.length > 0)
        .map((e) => ({
          date: s.date,
          loadLb: Math.max(...e.sets.map((x) => x.loadLb)),
          sets: e.sets.map((x) => ({ reps: x.reps, loadLb: x.loadLb, difficulty: x.difficulty, pain: x.pain, techniqueOk: x.techniqueOk })),
        })),
    );
}

/** Delta aprobado vigente para un ejercicio (el más reciente). */
export function currentDelta(adjustments: LoadAdjustment[], exerciseId: string): number | undefined {
  const list = adjustments.filter((a) => a.exerciseId === exerciseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return list.length ? list[list.length - 1].deltaLb : undefined;
}

export function sessionVolume(s: WorkoutSession): number {
  let v = 0;
  for (const e of s.exercises) {
    const plan = findPlanExercise(e.exerciseId);
    const factor = (e.substitute?.loadType ?? plan?.loadType) === 'each' ? 2 : 1;
    for (const set of e.sets) if (!plan?.timed) v += set.reps * set.loadLb * factor;
  }
  return Math.round(v);
}

export interface WeekSummary {
  week: number;
  strengthDone: number;
  strengthPlanned: number;
  cardioMinutes: number;
  cardioTarget: number;
  volumeLb: number;
}

export function weekSummaries(sessions: WorkoutSession[], cardio: CardioLog[]): WeekSummary[] {
  const out: WeekSummary[] = [];
  for (let w = 1; w <= PROGRAM_WEEKS; w++) {
    const dates = weekDates(w);
    const done = sessions.filter((s) => s.status === 'completed' && s.week === w);
    out.push({
      week: w,
      strengthDone: new Set(done.map((s) => s.dayKey)).size,
      strengthPlanned: 4,
      cardioMinutes: cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0),
      cardioTarget: cardioTargetForWeek(w),
      volumeLb: done.reduce((a, s) => a + sessionVolume(s), 0),
    });
  }
  return out;
}

export interface Adherence {
  strengthDone: number;
  strengthDue: number;
  pct: number | null;
  cardioPct: number | null;
}

/**
 * Adherencia hasta hoy: sesiones de fuerza completadas / programadas en días ya vividos
 * (incluido hoy solo si ya se completó). Cardio: minutos acumulados / meta prorrateada de semanas completas + semana actual.
 */
export function adherence(sessions: WorkoutSession[], cardio: CardioLog[], todayIso: string): Adherence {
  const pd = programDayFor(todayIso);
  if (pd.status === 'before') return { strengthDone: 0, strengthDue: 0, pct: null, cardioPct: null };
  const lastWeek = pd.status === 'after' ? PROGRAM_WEEKS : pd.week!;
  let due = 0;
  let doneCount = 0;
  let cardioTarget = 0;
  let cardioDone = 0;
  for (let w = 1; w <= lastWeek; w++) {
    const completed = new Set(sessions.filter((s) => s.status === 'completed' && s.week === w).map((s) => s.dayKey));
    for (let dow = 0; dow < 7; dow++) {
      const date = dateFor(w, dow);
      const k = programDayFor(date).dayKey;
      if (!isStrengthDay(k)) continue;
      const isPast = date < todayIso;
      const isToday = date === todayIso;
      if (isPast || (isToday && completed.has(k))) {
        due++;
        if (completed.has(k)) doneCount++;
      }
    }
    const dates = weekDates(w);
    if (w < lastWeek || pd.status === 'after') {
      cardioTarget += cardioTargetForWeek(w);
      cardioDone += cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0);
    }
  }
  return {
    strengthDone: doneCount,
    strengthDue: due,
    pct: due ? Math.round((doneCount / due) * 100) : null,
    cardioPct: cardioTarget ? Math.min(100, Math.round((cardioDone / cardioTarget) * 100)) : null,
  };
}

export function cardioThisWeek(cardio: CardioLog[], todayIso: string): { minutes: number; target: number; week: number | null } {
  const pd = programDayFor(todayIso);
  if (pd.week === null) {
    const monday = addDays(todayIso, -pd.dow);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    return { minutes: cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0), target: 150, week: null };
  }
  const dates = weekDates(pd.week);
  return {
    minutes: cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0),
    target: cardioTargetForWeek(pd.week),
    week: pd.week,
  };
}
