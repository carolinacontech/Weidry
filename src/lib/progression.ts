/**
 * Lógica de progresión basada en repeticiones en reserva (RIR).
 * NUNCA cambia cargas por sí misma: solo produce sugerencias que la persona aprueba.
 *
 * Criterio para recomendar más peso (dos sesiones CONSECUTIVAS cumpliéndolo):
 *   - todas las series previstas completadas,
 *   - con la misma carga en todas las series,
 *   - técnica adecuada en todas,
 *   - 2–3 (o más) repeticiones en reserva en todas, sin quedarse por debajo del mínimo de reps,
 *   - sin dolor.
 * Si no se cumple, se progresa con repeticiones, tempo o series. Los saltos grandes
 * (de 10 a 15 lb = +50 %) siempre son opcionales y se sugiere probarlos solo en la primera serie.
 */
import { RIR_TARGET, type Exercise } from '../data/plan';
import { compareOptions, formatWeight, isBigJump, sameOption, stepDown, stepUp, type LoadOption, type Unit } from './weights';

/** Etiquetas de dificultad del programa anterior (solo para mostrar historial antiguo). */
export type Difficulty = 'easy' | 'ok' | 'hard';
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Fácil', ok: 'Adecuada', hard: 'Demasiado difícil' };

/** Valores de RIR que se pueden registrar (4 = "4 o más"). */
export const RIR_OPTIONS = [0, 1, 2, 3, 4] as const;
export const rirLabel = (r: number) => (r >= 4 ? '4+' : String(r));

export interface SetResult {
  reps: number;
  option: LoadOption;
  rir: number | null;
  pain: boolean;
  techniqueOk: boolean;
}

export interface ExerciseSessionResult {
  date: string;
  plannedSets: number;
  sets: SetResult[];
}

export type SessionClass = 'pain' | 'incomplete' | 'technique' | 'hard' | 'unrated' | 'mixed' | 'target';

type ExLike = Pick<Exercise, 'repsMin' | 'repsMax' | 'timed'>;

export function classifySession(r: ExerciseSessionResult, ex: ExLike): SessionClass {
  if (r.sets.some((s) => s.pain)) return 'pain';
  if (r.sets.length < r.plannedSets) return 'incomplete';
  if (r.sets.some((s) => !s.techniqueOk)) return 'technique';
  if (r.sets.some((s) => s.reps < ex.repsMin || (s.rir !== null && s.rir < RIR_TARGET.min))) return 'hard';
  if (r.sets.some((s) => s.rir === null)) return 'unrated';
  if (!r.sets.every((s) => sameOption(s.option, r.sets[0].option))) return 'mixed';
  return 'target';
}

/** Carga de referencia de la sesión: la más alta usada. */
export function sessionOption(r: ExerciseSessionResult): LoadOption | undefined {
  return r.sets.map((s) => s.option).sort(compareOptions).pop();
}

export type Suggestion =
  | { kind: 'stop_pain'; message: string }
  | { kind: 'decrease'; to: LoadOption; message: string }
  | { kind: 'increase'; to: LoadOption; bigJump: boolean; message: string }
  | { kind: 'reps' | 'tempo' | 'keep'; message: string };

export interface SuggestInput {
  /** Historial del ejercicio, la sesión más reciente al final. */
  history: ExerciseSessionResult[];
  ex: ExLike;
  /** Escalera de opciones disponibles en el inventario. */
  ladder: LoadOption[];
  unit?: Unit;
}

export function suggestProgression({ history, ex, ladder, unit = 'lb' }: SuggestInput): Suggestion {
  const last = history[history.length - 1];
  if (!last || last.sets.length === 0)
    return { kind: 'keep', message: 'Aún no hay registros: empieza con la propuesta y ajústala a tu técnica y esfuerzo reales.' };

  const cls = classifySession(last, ex);
  const current = sessionOption(last)!;
  const unitWord = ex.timed ? 'segundos' : 'repeticiones';

  if (cls === 'pain')
    return {
      kind: 'stop_pain',
      message: 'Registraste dolor o molestia. No aumentes la carga en este ejercicio. Si el dolor fue agudo o persiste, detente y consulta con un profesional de la salud.',
    };

  if (cls === 'hard') {
    const failedReps = last.sets.some((s) => s.reps < ex.repsMin);
    const atZero = last.sets.some((s) => s.rir === 0);
    if (failedReps && atZero) {
      const down = stepDown(ladder, current);
      if (down) return { kind: 'decrease', to: down, message: `No llegaste al mínimo de ${unitWord} y quedaste sin reserva: te sugerimos la opción inferior.` };
    }
    return {
      kind: 'keep',
      message: `Mantén la carga. Busca terminar cada serie con ${RIR_TARGET.min}–${RIR_TARGET.max} ${unitWord} en reserva; si hace falta, haz 1–2 menos.`,
    };
  }

  if (cls === 'technique') return { kind: 'keep', message: 'Mantén la carga y prioriza la técnica: baja más lento y controla el recorrido completo.' };
  if (cls === 'incomplete') return { kind: 'keep', message: 'Completa todas las series previstas con buena técnica antes de pensar en subir.' };
  if (cls === 'unrated') return { kind: 'keep', message: 'Registra las repeticiones en reserva (RIR) de cada serie para poder sugerir progresiones.' };
  if (cls === 'mixed') return { kind: 'keep', message: 'Usaste cargas distintas entre series. Para valorar una subida, haz todas las series con la misma carga.' };

  // cls === 'target'
  const prev = history[history.length - 2];
  const twoInARow = prev !== undefined && classifySession(prev, ex) === 'target' && sameOption(sessionOption(prev), current);

  if (twoInARow) {
    const up = stepUp(ladder, current);
    if (up) {
      const big = isBigJump(current, up);
      const upText = up.kind === 'db' ? `${formatWeight(up.lb, unit)}` : 'la siguiente opción';
      return {
        kind: 'increase',
        to: up,
        bigJump: big,
        message: big
          ? `Dos sesiones seguidas con todas las series, buena técnica y ${RIR_TARGET.min}–${RIR_TARGET.max} RIR. Puedes probar ${upText}, pero es un salto grande: pruébalo solo en la primera serie. Si no llegas al mínimo con ${RIR_TARGET.min} RIR, vuelve a la carga actual y sigue progresando con repeticiones, tempo o una serie más. Subir es opcional.`
          : `Dos sesiones seguidas con todas las series, buena técnica y ${RIR_TARGET.min}–${RIR_TARGET.max} RIR: puedes probar ${upText}. Es opcional.`,
      };
    }
  }

  const belowTop = last.sets.some((s) => s.reps < ex.repsMax);
  if (belowTop)
    return {
      kind: 'reps',
      message: twoInARow
        ? `No hay una opción más pesada disponible: suma 1–2 ${unitWord} por serie hasta llegar a ${ex.repsMax}.`
        : `Buen trabajo. Próxima sesión: suma 1–2 ${unitWord} por serie (hasta ${ex.repsMax}) manteniendo ${RIR_TARGET.min}–${RIR_TARGET.max} RIR.`,
    };
  return {
    kind: 'tempo',
    message: `Ya llegas al tope de ${unitWord}. Sin cambiar de peso puedes progresar con tempo (3 s al bajar y 1 s de pausa) o añadiendo una serie (máximo 4).`,
  };
}
