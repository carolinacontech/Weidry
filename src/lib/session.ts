import { PLAN_DAYS, getExercise, type Exercise, type PlanSlot } from '../data/plan';
import { isRecoveryWeek, plannedRx, setsFor } from './program';
import { exerciseHistory, topOption } from './stats';
import type { ExerciseLog, LoadAdjustment, WorkoutSession } from './types';
import { compareOptions, ladderFor, nearestAtOrBelow, resolveRx, type InventoryItem, type LoadOption, type Unit } from './weights';

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface Proposal {
  /** Carga propuesta para hoy (siempre una opción de tu inventario). */
  option: LoadOption;
  /** Lo que indica la tabla del plan para esa semana, resuelto a tu inventario. */
  planOption: LoadOption;
  /** La propuesta está por debajo de la tabla del plan (aún no se cumplió el criterio para subir). */
  belowPlan: boolean;
  /** Semana de recuperación: se usa la opción más ligera entre tu nivel y el plan. */
  recovery: boolean;
  note?: string;
  ladder: LoadOption[];
}

/**
 * Propuesta de carga:
 * 1. Sin historial ni ajustes → la tabla del plan de esa semana (ajustada a tu inventario).
 * 2. Con historial → tu "nivel actual": el último cambio aprobado o la carga que usaste en tu última
 *    sesión (fuera de semanas de recuperación). Las subidas de la tabla NO se aplican solas: se
 *    sugieren solo cuando se cumple el criterio de RIR y tú las apruebas.
 * 3. Semanas 5 y 9 → la opción más ligera entre tu nivel y la tabla (descarga).
 */
export function proposedOption(params: {
  ex: Exercise;
  slot: PlanSlot;
  week: number;
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  sessions: WorkoutSession[];
  unit: Unit;
}): Proposal {
  const { ex, slot, week, inventory, adjustments, sessions, unit } = params;
  const ladder = ladderFor(ex, inventory);
  const plan = resolveRx(plannedRx(slot, week), ladder, unit);
  const recovery = isRecoveryWeek(week);

  // Nivel actual: lo más reciente entre ajuste aprobado y última sesión (no de recuperación).
  const adj = adjustments.filter((a) => a.exerciseId === ex.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  const relevant = sessions
    .filter((s) => s.status !== 'abandoned' && !isRecoveryWeek(s.week))
    .filter((s) => s.exercises.some((e) => e.exerciseId === ex.id && !e.substitute && e.sets.length > 0))
    .sort((a, b) => (a.updatedAt ?? a.startedAt).localeCompare(b.updatedAt ?? b.startedAt));
  const lastSession = relevant[relevant.length - 1];
  let level: LoadOption | undefined;
  if (lastSession) {
    const h = exerciseHistory([lastSession], ex.id);
    level = h.length ? topOption(h[h.length - 1]) : undefined;
  }
  // Un ajuste aprobado en el resumen de una sesión prevalece sobre la carga usada en esa misma sesión.
  if (adj && (!lastSession || adj.createdAt >= lastSession.startedAt)) level = adj.option;

  if (!level || ladder.length === 0) {
    return { option: plan.option, planOption: plan.option, belowPlan: false, recovery, note: plan.note, ladder };
  }
  // El nivel debe existir en el inventario actual.
  let option = nearestAtOrBelow(ladder, level)!;
  let note: string | undefined;
  if (compareOptions(option, level) !== 0) note = 'La carga que usabas ya no está en tu inventario: se propone la opción inferior disponible.';
  if (recovery && compareOptions(plan.option, option) < 0) {
    option = plan.option;
    note = 'Semana de recuperación: menos series y una carga más ligera.';
  }
  return { option, planOption: plan.option, belowPlan: compareOptions(option, plan.option) < 0, recovery, note: note ?? plan.note, ladder };
}

export function createSession(params: {
  date: string;
  week: number;
  dayKey: 'A' | 'B' | 'C' | 'D';
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  sessions: WorkoutSession[];
  unit: Unit;
  skipWarmup?: boolean;
}): WorkoutSession {
  const day = PLAN_DAYS[params.dayKey];
  const now = new Date().toISOString();
  const exercises: ExerciseLog[] = day.slots.map((slot) => {
    const ex = getExercise(slot.exerciseId)!;
    return {
      exerciseId: ex.id,
      status: 'pending',
      plannedSets: setsFor(slot, params.week),
      plannedOption: proposedOption({ ex, slot, week: params.week, inventory: params.inventory, adjustments: params.adjustments, sessions: params.sessions, unit: params.unit }).option,
      sets: [],
    };
  });
  return {
    id: uid(),
    date: params.date,
    week: params.week,
    dayKey: params.dayKey,
    status: 'in_progress',
    startedAt: now,
    updatedAt: now,
    phase: params.skipWarmup ? 'work' : 'warmup',
    exerciseIndex: 0,
    exercises,
  };
}

export function nextPendingIndex(s: WorkoutSession, from: number): number {
  const n = s.exercises.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (s.exercises[idx].status === 'pending') return idx;
  }
  return -1;
}

export function exerciseName(log: ExerciseLog): string {
  if (log.substitute) return log.substitute.name;
  return getExercise(log.exerciseId)?.nameEs ?? log.exerciseId;
}

export function sessionProgress(s: WorkoutSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of s.exercises) {
    if (e.status === 'skipped') continue;
    total += e.plannedSets;
    done += Math.min(e.sets.length, e.plannedSets);
  }
  return { done, total };
}
