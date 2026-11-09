/**
 * Seed completo del programa "Mi Entrenamiento" (13 semanas).
 * Todas las cargas están en libras (lb). 0 = peso corporal.
 * Cada carga es una PROPUESTA ajustable, nunca un objetivo obligatorio.
 */

export const PROGRAM_START = '2026-11-09'; // lunes
export const PROGRAM_WEEKS = 13;

export type LoadType = 'single' | 'each' | 'body';
export type DayKey = 'A' | 'B' | 'C' | 'D' | 'cardio' | 'rest';

/** Series por semana (índice 0 = semana 1). */
export const SETS_PER_WEEK = [2, 2, 3, 3, 2, 3, 3, 3, 2, 3, 3, 3, 3] as const;

/** Semanas de recuperación (descarga). */
export const RECOVERY_WEEKS = [5, 9] as const;

/** Minutos semanales de cardio sugeridos. */
export const CARDIO_MINUTES_PER_WEEK = [100, 120, 135, 150, 120, 150, 160, 170, 130, 170, 180, 180, 150] as const;

/** Lunes→domingo. */
export const WEEK_SCHEDULE: DayKey[] = ['A', 'B', 'cardio', 'C', 'D', 'cardio', 'rest'];

export const WARMUP_MINUTES = 5;

export const REST_OPTIONS = [45, 60, 90, 120] as const;

export interface PlanExercise {
  /** Identificador estable para historial y progresión (compartido si se repite en varios días). */
  id: string;
  /** Nombre indicado en el programa. */
  name: string;
  /** Nombre en español. */
  nameEs: string;
  loadType: LoadType;
  /** Texto de repeticiones del programa. */
  reps: string;
  repsMin: number;
  repsMax: number;
  /** Si el objetivo es tiempo (segundos) en lugar de repeticiones. */
  timed?: boolean;
  /** "por lado" */
  perSide?: boolean;
  /** Series fijas (p.ej. core: dos series siempre). Si no, se usan SETS_PER_WEEK. */
  fixedSets?: number;
  /** Cargas propuestas por semana (13 valores, lb). Vacío para peso corporal. */
  loads: number[];
  /** Descanso recomendado en segundos (60–90; hasta 120 en ejercicios intensos). */
  restSec: number;
  /** Se puede hacer con una sola mancuerna aunque sea "por mano" (unilateral alternado). */
  unilateral?: boolean;
}

export interface PlanDay {
  key: 'A' | 'B' | 'C' | 'D';
  title: string;
  weekday: string;
  focus: string;
  exercises: PlanExercise[];
}

const GLUTE_BRIDGE_LOADS = [10, 10, 12, 12, 10, 15, 15, 20, 15, 20, 20, 25, 25];
const SQUAT_LOADS = [8, 8, 10, 10, 8, 12, 12, 15, 10, 15, 15, 20, 20];
const LOWER_EACH_LOADS = [0, 0, 0, 3, 0, 3, 5, 5, 0, 5, 5, 8, 8];
const STD_EACH_LOADS = [5, 5, 5, 8, 5, 8, 8, 10, 5, 10, 10, 12, 12];

export const PLAN_DAYS: Record<'A' | 'B' | 'C' | 'D', PlanDay> = {
  A: {
    key: 'A',
    title: 'Fuerza A',
    weekday: 'Lunes',
    focus: 'Piernas y glúteos · core',
    exercises: [
      { id: 'goblet-squat', name: 'Goblet squat', nameEs: 'Sentadilla goblet', loadType: 'single', reps: '10-12', repsMin: 10, repsMax: 12, loads: SQUAT_LOADS, restSec: 90 },
      { id: 'romanian-deadlift', name: 'Romanian deadlift', nameEs: 'Peso muerto rumano', loadType: 'each', reps: '10-12', repsMin: 10, repsMax: 12, loads: [5, 5, 5, 8, 5, 8, 8, 10, 8, 10, 10, 12, 12], restSec: 120 },
      { id: 'glute-bridge', name: 'Weighted glute bridge', nameEs: 'Puente de glúteo con peso', loadType: 'single', reps: '12', repsMin: 12, repsMax: 12, loads: GLUTE_BRIDGE_LOADS, restSec: 90 },
      { id: 'reverse-lunge', name: 'Reverse lunge', nameEs: 'Zancada hacia atrás', loadType: 'each', reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, loads: LOWER_EACH_LOADS, restSec: 90 },
      { id: 'front-plank', name: 'Front plank', nameEs: 'Plancha frontal', loadType: 'body', reps: '15-30 s', repsMin: 15, repsMax: 30, timed: true, fixedSets: 2, loads: [], restSec: 60 },
    ],
  },
  B: {
    key: 'B',
    title: 'Fuerza B',
    weekday: 'Martes',
    focus: 'Espalda, pecho y brazos · core',
    exercises: [
      { id: 'single-arm-row', name: 'Single-arm row', nameEs: 'Remo a una mano', loadType: 'each', reps: '10-12 por lado', repsMin: 10, repsMax: 12, perSide: true, unilateral: true, loads: [5, 5, 8, 8, 5, 10, 10, 12, 8, 12, 12, 15, 15], restSec: 90 },
      { id: 'floor-press', name: 'Dumbbell floor press', nameEs: 'Press de pecho en el suelo', loadType: 'each', reps: '10-12', repsMin: 10, repsMax: 12, loads: [5, 5, 5, 8, 5, 8, 8, 10, 5, 10, 10, 12, 12], restSec: 90 },
      { id: 'shoulder-press', name: 'Shoulder press', nameEs: 'Press de hombros', loadType: 'each', reps: '8-12', repsMin: 8, repsMax: 12, loads: [3, 3, 3, 5, 3, 5, 5, 5, 3, 5, 8, 8, 8], restSec: 90 },
      { id: 'biceps-curl', name: 'Biceps curl', nameEs: 'Curl de bíceps', loadType: 'each', reps: '10-12', repsMin: 10, repsMax: 12, loads: [3, 3, 3, 5, 3, 5, 5, 5, 3, 5, 5, 8, 8], restSec: 60 },
      { id: 'dead-bug', name: 'Dead bug', nameEs: 'Bicho muerto (dead bug)', loadType: 'body', reps: '8 por lado', repsMin: 8, repsMax: 8, perSide: true, fixedSets: 2, loads: [], restSec: 60 },
    ],
  },
  C: {
    key: 'C',
    title: 'Fuerza C',
    weekday: 'Jueves',
    focus: 'Piernas y glúteos · core lateral',
    exercises: [
      { id: 'sumo-squat', name: 'Sumo squat', nameEs: 'Sentadilla sumo', loadType: 'single', reps: '12', repsMin: 12, repsMax: 12, loads: SQUAT_LOADS, restSec: 90 },
      { id: 'step-up', name: 'Low step-up', nameEs: 'Subida a escalón bajo', loadType: 'each', reps: '10 por lado', repsMin: 10, repsMax: 10, perSide: true, loads: LOWER_EACH_LOADS, restSec: 90 },
      { id: 'glute-bridge', name: 'Weighted glute bridge', nameEs: 'Puente de glúteo con peso', loadType: 'single', reps: '12', repsMin: 12, repsMax: 12, loads: GLUTE_BRIDGE_LOADS, restSec: 90 },
      { id: 'calf-raise', name: 'Standing calf raise', nameEs: 'Elevación de talones de pie', loadType: 'each', reps: '15', repsMin: 15, repsMax: 15, loads: STD_EACH_LOADS, restSec: 60 },
      { id: 'side-plank', name: 'Side plank', nameEs: 'Plancha lateral', loadType: 'body', reps: '15-25 s por lado', repsMin: 15, repsMax: 25, timed: true, perSide: true, fixedSets: 2, loads: [], restSec: 60 },
    ],
  },
  D: {
    key: 'D',
    title: 'Fuerza D',
    weekday: 'Viernes',
    focus: 'Espalda, hombros y brazos',
    exercises: [
      { id: 'bent-over-row', name: 'Bent-over dumbbell row', nameEs: 'Remo inclinado con mancuernas', loadType: 'each', reps: '12', repsMin: 12, repsMax: 12, loads: STD_EACH_LOADS, restSec: 90 },
      { id: 'lateral-raise', name: 'Lateral raise', nameEs: 'Elevaciones laterales', loadType: 'each', reps: '12', repsMin: 12, repsMax: 12, loads: [2, 2, 3, 3, 2, 3, 3, 5, 2, 5, 5, 5, 5], restSec: 60 },
      { id: 'triceps-kickback', name: 'Triceps kickback', nameEs: 'Patada de tríceps', loadType: 'each', reps: '12', repsMin: 12, repsMax: 12, loads: [3, 3, 3, 5, 3, 5, 5, 5, 3, 5, 8, 8, 8], restSec: 60 },
      { id: 'hammer-curl', name: 'Hammer curl', nameEs: 'Curl martillo', loadType: 'each', reps: '12', repsMin: 12, repsMax: 12, loads: [3, 3, 5, 5, 3, 5, 5, 8, 5, 8, 8, 8, 8], restSec: 60 },
      { id: 'incline-push-up', name: 'Incline push-up', nameEs: 'Flexión inclinada', loadType: 'body', reps: '8-12', repsMin: 8, repsMax: 12, fixedSets: 2, loads: [], restSec: 60 },
    ],
  },
};

export const DAY_LABELS: Record<DayKey, string> = {
  A: 'Fuerza A',
  B: 'Fuerza B',
  C: 'Fuerza C',
  D: 'Fuerza D',
  cardio: 'Cardio',
  rest: 'Descanso',
};

export const DEFAULT_PROFILE = {
  sex: 'mujer' as const,
  age: 36,
  heightFt: 5,
  heightIn: 3,
  weightLb: 148,
  goalWeightLb: 120,
  waistCm: 83,
  /** Referencia estética personal; NO es una predicción ni meta médica. */
  aestheticWaistCm: 60,
  showAestheticReference: true,
  activityLevel: 'ligero' as 'sedentario' | 'ligero' | 'moderado' | 'activo',
  conditions: 'Hígado graso',
};

export type Profile = typeof DEFAULT_PROFILE;

/** Todos los ejercicios únicos del programa. */
export function allPlanExercises(): PlanExercise[] {
  const map = new Map<string, PlanExercise>();
  for (const day of Object.values(PLAN_DAYS)) for (const ex of day.exercises) if (!map.has(ex.id)) map.set(ex.id, ex);
  return [...map.values()];
}

export function findPlanExercise(id: string): PlanExercise | undefined {
  return allPlanExercises().find((e) => e.id === id);
}
