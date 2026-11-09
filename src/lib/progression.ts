/**
 * Lógica de progresión. NUNCA cambia cargas por sí misma: solo produce
 * sugerencias que la persona debe aprobar explícitamente.
 *
 * Reglas:
 * 1. Si hubo dolor/molestia en la última sesión → indicar parar (prioridad máxima).
 * 2. Si la última sesión fue "demasiado difícil" → sugerir bajar al siguiente peso disponible
 *    (o reducir repeticiones si no hay uno menor).
 * 3. Solo tras DOS sesiones consecutivas "fáciles" con técnica adecuada y sin dolor →
 *    sugerir la subida mínima disponible en el inventario. Si no hay peso superior o el
 *    salto es grande, sugerir primero subir repeticiones.
 * 4. En otro caso → mantener.
 */
import type { LoadType } from '../data/plan';
import { isBigJump, nextDown, nextUp } from './weights';

export type Difficulty = 'easy' | 'ok' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  ok: 'Adecuada',
  hard: 'Demasiado difícil',
};

export interface SetResult {
  reps: number;
  loadLb: number;
  difficulty?: Difficulty | null;
  pain?: boolean;
  techniqueOk?: boolean;
}

export interface ExerciseSessionResult {
  date: string;
  sets: SetResult[];
  /** Carga principal utilizada (lb). */
  loadLb: number;
}

export type SessionClass = 'pain' | 'hard' | 'easy' | 'ok' | 'unrated';

/** Clasifica una sesión de un ejercicio a partir de sus series. */
export function classifySession(r: ExerciseSessionResult): SessionClass {
  if (r.sets.length === 0) return 'unrated';
  if (r.sets.some((s) => s.pain)) return 'pain';
  const rated = r.sets.filter((s) => s.difficulty);
  if (rated.some((s) => s.difficulty === 'hard')) return 'hard';
  if (rated.length === 0) return 'unrated';
  const allEasy = rated.every((s) => s.difficulty === 'easy');
  const techniqueOk = r.sets.every((s) => s.techniqueOk !== false);
  if (allEasy && techniqueOk) return 'easy';
  return 'ok';
}

export type Suggestion =
  | { kind: 'stop_pain'; message: string }
  | { kind: 'decrease'; toLb: number; message: string }
  | { kind: 'decrease_reps'; message: string }
  | { kind: 'increase'; toLb: number; message: string }
  | { kind: 'increase_reps'; message: string }
  | { kind: 'keep'; message: string };

export interface SuggestInput {
  /** Historial del ejercicio en orden cronológico (la más reciente al final). */
  history: ExerciseSessionResult[];
  currentLoadLb: number;
  loadType: LoadType;
  /** Cargas disponibles en el inventario (lb, ascendente). */
  available: number[];
  repsMax: number;
  timed?: boolean;
}

export function suggestProgression(input: SuggestInput): Suggestion {
  const { history, currentLoadLb, loadType, available, timed } = input;
  const last = history[history.length - 1];
  if (!last) return { kind: 'keep', message: 'Aún no hay registros: empieza con la carga propuesta y ajústala a tu capacidad real.' };

  const lastClass = classifySession(last);
  if (lastClass === 'pain') {
    return {
      kind: 'stop_pain',
      message:
        'Registraste dolor o molestia. Para este ejercicio, no aumentes carga. Si el dolor fue agudo o persiste, detente y consulta con un profesional de la salud antes de continuar.',
    };
  }

  if (lastClass === 'hard') {
    if (loadType !== 'body') {
      const down = nextDown(currentLoadLb, available);
      if (down !== undefined) return { kind: 'decrease', toLb: down, message: 'La última sesión fue demasiado difícil: te sugerimos bajar al siguiente peso disponible.' };
    }
    return {
      kind: 'decrease_reps',
      message: timed
        ? 'La última sesión fue demasiado difícil: reduce unos segundos o usa la variante más fácil.'
        : 'La última sesión fue demasiado difícil: reduce 1–2 repeticiones o usa una variante más sencilla.',
    };
  }

  const prev = history[history.length - 2];
  const twoEasy = lastClass === 'easy' && prev !== undefined && classifySession(prev) === 'easy';
  if (twoEasy) {
    if (loadType === 'body') {
      return {
        kind: 'increase_reps',
        message: timed
          ? 'Dos sesiones fáciles con buena técnica: puedes sumar 5 segundos por serie.'
          : 'Dos sesiones fáciles con buena técnica: puedes sumar 1–2 repeticiones o una variante algo más exigente.',
      };
    }
    const up = nextUp(currentLoadLb, available);
    if (up === undefined) {
      return { kind: 'increase_reps', message: 'Dos sesiones fáciles, pero no tienes un peso mayor: suma 1–2 repeticiones por serie o baja más lento.' };
    }
    if (isBigJump(currentLoadLb, up)) {
      return { kind: 'increase_reps', message: 'Dos sesiones fáciles, pero el siguiente peso disponible es un salto grande: primero suma repeticiones.' };
    }
    return { kind: 'increase', toLb: up, message: 'Dos sesiones fáciles con técnica adecuada: puedes probar la subida mínima disponible.' };
  }

  return { kind: 'keep', message: 'Mantén la carga actual y sigue registrando cómo se siente.' };
}

/**
 * Carga propuesta efectiva: plan + ajuste aprobado (delta) y luego ajustada al inventario.
 * El delta se calcula al aprobar: delta = cargaAprobada - cargaDelPlan(semanaDeAprobación).
 */
export function effectivePlannedLb(planLb: number, approvedDeltaLb: number | undefined, loadType: LoadType): number {
  if (loadType === 'body') return 0;
  return Math.max(0, planLb + (approvedDeltaLb ?? 0));
}
