import { PLAN_DAYS, findPlanExercise, type PlanExercise } from '../data/plan';
import { effectivePlannedLb } from './progression';
import { plannedLoadLb, setsFor } from './program';
import { currentDelta } from './stats';
import type { ExerciseLog, LoadAdjustment, WorkoutSession } from './types';
import { availableLoadsLb, snapToInventory, type InventoryItem, type Unit } from './weights';

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Carga propuesta para un ejercicio en una semana: plan + ajustes aprobados + inventario. */
export function proposedLoad(ex: PlanExercise, week: number, inventory: InventoryItem[], adjustments: LoadAdjustment[], unit: Unit) {
  const planLb = plannedLoadLb(ex, week);
  const target = effectivePlannedLb(planLb, currentDelta(adjustments, ex.id), ex.loadType);
  const snap = snapToInventory(target, availableLoadsLb(inventory, ex.loadType, ex.unilateral), unit);
  return { planLb, targetLb: target, ...snap };
}

export function createSession(params: {
  date: string;
  week: number;
  dayKey: 'A' | 'B' | 'C' | 'D';
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  unit: Unit;
  skipWarmup?: boolean;
}): WorkoutSession {
  const day = PLAN_DAYS[params.dayKey];
  const now = new Date().toISOString();
  const exercises: ExerciseLog[] = day.exercises.map((ex) => ({
    exerciseId: ex.id,
    status: 'pending',
    plannedSets: setsFor(ex, params.week),
    plannedLoadLb: proposedLoad(ex, params.week, params.inventory, params.adjustments, params.unit).loadLb,
    sets: [],
  }));
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
  return findPlanExercise(log.exerciseId)?.nameEs ?? log.exerciseId;
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
