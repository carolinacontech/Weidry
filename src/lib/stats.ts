import { EXERCISES, PROGRAM_WEEKS, getExercise, type Mode } from '../data/plan';
import { addDays } from './dates';
import { cardioTargetForWeek, dateFor, isRecoveryWeek, isStrengthDay, programDayFor, weekDates } from './program';
import type { ExerciseSessionResult } from './progression';
import { setOption, type CardioLog, type ExerciseLog, type WorkoutSession } from './types';
import { compareOptions, totalLb, type LoadOption } from './weights';

const byTime = (a: WorkoutSession, b: WorkoutSession) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt);

export function modeOf(e: Pick<ExerciseLog, 'exerciseId' | 'substitute'>): Mode {
  return e.substitute?.mode ?? getExercise(e.exerciseId)?.mode ?? 'body';
}

/** Historial de un ejercicio (sin sustituciones), en orden cronológico. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string, opts: { skipRecovery?: boolean } = {}): ExerciseSessionResult[] {
  return sessions
    .filter((s) => s.status !== 'abandoned' && !(opts.skipRecovery && isRecoveryWeek(s.week)))
    .slice()
    .sort(byTime)
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && !e.substitute && e.sets.length > 0)
        .map((e) => ({
          date: s.date,
          plannedSets: e.plannedSets,
          sets: e.sets.map((x) => ({
            reps: x.reps,
            option: setOption(x),
            // Registros v1 sin RIR: se tratan como "no registrado".
            rir: x.rir ?? null,
            pain: x.pain,
            techniqueOk: x.techniqueOk,
          })),
        })),
    );
}

export function topOption(r: ExerciseSessionResult): LoadOption | undefined {
  return r.sets.map((s) => s.option).sort(compareOptions).pop();
}

export function sessionVolume(s: WorkoutSession): number {
  let v = 0;
  for (const e of s.exercises) {
    const ex = getExercise(e.exerciseId);
    if (ex?.timed && !e.substitute) continue;
    const mode = modeOf(e);
    for (const set of e.sets) v += set.reps * totalLb(setOption(set), set.mode ?? mode);
  }
  return Math.round(v);
}

/** Series de trabajo de glúteo (ejercicios marcados como glúteo, sin sustituciones). */
export function gluteSets(s: WorkoutSession): number {
  return s.exercises.filter((e) => !e.substitute && EXERCISES[e.exerciseId]?.glute).reduce((a, e) => a + e.sets.length, 0);
}

export interface WeekSummary {
  week: number;
  strengthDone: number;
  strengthPlanned: number;
  cardioMinutes: number;
  cardioTarget: number;
  volumeLb: number;
  gluteSets: number;
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
      gluteSets: done.reduce((a, s) => a + gluteSets(s), 0),
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
      if (date < todayIso || (date === todayIso && completed.has(k))) {
        due++;
        if (completed.has(k)) doneCount++;
      }
    }
    if (w < lastWeek || pd.status === 'after') {
      const dates = weekDates(w);
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
  const dates = pd.week === null ? Array.from({ length: 7 }, (_, i) => addDays(addDays(todayIso, -pd.dow), i)) : weekDates(pd.week);
  return {
    minutes: cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0),
    target: pd.week === null ? 150 : cardioTargetForWeek(pd.week),
    week: pd.week,
  };
}

/** Evolución de fuerza en un ejercicio: primera y última sesión (carga y mejores reps). */
export function strengthProgress(sessions: WorkoutSession[], exerciseId: string) {
  const h = exerciseHistory(sessions, exerciseId);
  if (!h.length) return null;
  const summary = (r: ExerciseSessionResult) => {
    const top = topOption(r)!;
    const reps = Math.max(...r.sets.filter((s) => compareOptions(s.option, top) === 0).map((s) => s.reps));
    return { date: r.date, option: top, reps };
  };
  return { first: summary(h[0]), last: summary(h[h.length - 1]), sessions: h.length };
}
