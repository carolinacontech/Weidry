/**
 * Programa actualizado "Weidry" (13 semanas) adaptado al equipamiento real:
 * tres pares de mancuernas FIJAS de 10, 15 y 20 lb (por mancuerna), peso corporal y
 * alternativas domésticas ligeras (botellas de agua) para movimientos donde 10 lb es demasiado.
 *
 * Cada carga semanal es una PROPUESTA condicionada a la técnica y al esfuerzo
 * (2–3 repeticiones en reserva), nunca un objetivo obligatorio.
 * Prioridades: fuerza, desarrollo de glúteos y definición muscular.
 */

export const PROGRAM_START = '2026-11-09'; // lunes
export const PROGRAM_WEEKS = 13;

export type DayKey = 'A' | 'B' | 'C' | 'D' | 'cardio' | 'rest';
export type StrengthDay = 'A' | 'B' | 'C' | 'D';

/**
 * Cómo se sujeta la carga:
 * - held: UNA mancuerna sostenida con ambas manos → la carga es el total.
 * - each: una mancuerna en CADA mano → carga por mano (total = ×2).
 * - one:  una mancuerna en UNA mano (ejercicio unilateral) → carga en esa mano.
 * - body: solo peso corporal.
 */
export type Mode = 'held' | 'each' | 'one' | 'body';

/** Prescripción de carga de una semana. */
export type Rx = { kind: 'body' } | { kind: 'light' } | { kind: 'db'; lb: number };

/** Series por semana (índice 0 = semana 1). Semanas 5 y 9: menor volumen. */
export const SETS_PER_WEEK = [2, 2, 3, 3, 2, 3, 3, 3, 2, 3, 3, 3, 3] as const;
export const RECOVERY_WEEKS = [5, 9] as const;

/** Minutos semanales de cardio sugeridos. */
export const CARDIO_MINUTES_PER_WEEK = [100, 120, 135, 150, 120, 150, 160, 170, 130, 170, 180, 180, 150] as const;

/** Lunes→domingo. */
export const WEEK_SCHEDULE: DayKey[] = ['A', 'B', 'cardio', 'C', 'D', 'cardio', 'rest'];

export const WARMUP_MINUTES = 5;
export const REST_OPTIONS = [45, 60, 90, 120] as const;

/** Fases del programa (para la vista general y la progresión de series). */
export const PHASES: { weeks: number[]; label: string; name: string }[] = [
  { weeks: [1, 2], label: 'Sem 1–2', name: 'Técnica' },
  { weeks: [3, 4], label: 'Sem 3–4', name: 'Resistencia' },
  { weeks: [5], label: 'Sem 5', name: 'Recuperación' },
  { weeks: [6, 7, 8], label: 'Sem 6–8', name: 'Fuerza' },
  { weeks: [9], label: 'Sem 9', name: 'Recuperación' },
  { weeks: [10, 11, 12, 13], label: 'Sem 10–13', name: 'Consolidación' },
];

export function phaseFor(week: number) {
  return PHASES.find((p) => p.weeks.includes(week)) ?? PHASES[0];
}

/** Repeticiones en reserva objetivo. */
export const RIR_TARGET = { min: 2, max: 3 } as const;

export interface Exercise {
  id: string;
  /** Nombre original (inglés). */
  name: string;
  nameEs: string;
  mode: Mode;
  /** Se puede hacer sin carga (peso corporal) como opción de la escalera. */
  allowBody?: boolean;
  /** Admite alternativas ligeras (botellas) cuando 10 lb es demasiado. */
  allowLight?: boolean;
  reps: string;
  repsMin: number;
  repsMax: number;
  timed?: boolean;
  perSide?: boolean;
  /** Descanso recomendado (60–90 s; hasta 120 s en los más intensos). */
  restSec: number;
  /** Trabajo principal de glúteo. */
  glute?: boolean;
  /** Ejercicio que ya no forma parte del plan (se conserva para el historial). */
  legacy?: boolean;
}

export interface PlanSlot {
  exerciseId: string;
  /** Series fijas (core); si no, SETS_PER_WEEK. */
  fixedSets?: number;
  /** 13 prescripciones semanales. */
  rx: Rx[];
}

export interface PlanDay {
  key: StrengthDay;
  title: string;
  weekday: string;
  focus: string;
  slots: PlanSlot[];
}

/** Catálogo de ejercicios (incluye los antiguos, para mostrar el historial). */
export const EXERCISES: Record<string, Exercise> = {
  // ----- A
  'glute-bridge': { id: 'glute-bridge', name: 'Dumbbell hip thrust / glute bridge', nameEs: 'Hip thrust / puente de glúteo con mancuerna', mode: 'held', allowBody: true, reps: '10-12', repsMin: 10, repsMax: 12, restSec: 90, glute: true },
  'goblet-squat': { id: 'goblet-squat', name: 'Goblet squat', nameEs: 'Sentadilla goblet', mode: 'held', allowBody: true, reps: '10-12', repsMin: 10, repsMax: 12, restSec: 90, glute: true },
  'romanian-deadlift': { id: 'romanian-deadlift', name: 'Romanian deadlift', nameEs: 'Peso muerto rumano', mode: 'each', reps: '10-12', repsMin: 10, repsMax: 12, restSec: 120, glute: true },
  'reverse-lunge': { id: 'reverse-lunge', name: 'Reverse lunge', nameEs: 'Zancada hacia atrás', mode: 'each', allowBody: true, reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true },
  'front-plank': { id: 'front-plank', name: 'Front plank', nameEs: 'Plancha frontal', mode: 'body', reps: '20-40 s', repsMin: 20, repsMax: 40, timed: true, restSec: 60 },
  // ----- B
  'single-arm-row': { id: 'single-arm-row', name: 'Single-arm row', nameEs: 'Remo a una mano', mode: 'one', reps: '10-12 por lado', repsMin: 10, repsMax: 12, perSide: true, restSec: 90 },
  'floor-press': { id: 'floor-press', name: 'Dumbbell floor press', nameEs: 'Press de pecho en el suelo', mode: 'each', reps: '10-12', repsMin: 10, repsMax: 12, restSec: 90 },
  'shoulder-press': { id: 'shoulder-press', name: 'Seated shoulder press', nameEs: 'Press de hombros sentada', mode: 'each', allowLight: true, reps: '8-12', repsMin: 8, repsMax: 12, restSec: 90 },
  'biceps-curl': { id: 'biceps-curl', name: 'Biceps curl', nameEs: 'Curl de bíceps', mode: 'each', allowLight: true, reps: '10-12', repsMin: 10, repsMax: 12, restSec: 60 },
  'dead-bug': { id: 'dead-bug', name: 'Dead bug', nameEs: 'Bicho muerto (dead bug)', mode: 'body', reps: '8 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 60 },
  // ----- C
  'sumo-squat': { id: 'sumo-squat', name: 'Sumo squat', nameEs: 'Sentadilla sumo', mode: 'held', allowBody: true, reps: '10-12', repsMin: 10, repsMax: 12, restSec: 90, glute: true },
  'split-squat': { id: 'split-squat', name: 'Bulgarian split squat', nameEs: 'Sentadilla búlgara (pie trasero en sofá/silla)', mode: 'each', allowBody: true, reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true },
  'single-leg-bridge': { id: 'single-leg-bridge', name: 'Single-leg glute bridge', nameEs: 'Puente de glúteo a una pierna', mode: 'held', allowBody: true, reps: '10-12 por lado', repsMin: 10, repsMax: 12, perSide: true, restSec: 60, glute: true },
  'side-lying-abduction': { id: 'side-lying-abduction', name: 'Side-lying hip abduction', nameEs: 'Abducción de cadera tumbada de lado', mode: 'body', reps: '15-20 por lado', repsMin: 15, repsMax: 20, perSide: true, restSec: 60, glute: true },
  'side-plank': { id: 'side-plank', name: 'Side plank', nameEs: 'Plancha lateral', mode: 'body', reps: '15-30 s por lado', repsMin: 15, repsMax: 30, timed: true, perSide: true, restSec: 60 },
  // ----- D
  'bent-over-row': { id: 'bent-over-row', name: 'Bent-over dumbbell row', nameEs: 'Remo inclinado con mancuernas', mode: 'each', reps: '10-12', repsMin: 10, repsMax: 12, restSec: 90 },
  'single-leg-rdl': { id: 'single-leg-rdl', name: 'Supported single-leg RDL', nameEs: 'Peso muerto rumano a una pierna con apoyo', mode: 'one', allowBody: true, reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true },
  'lateral-raise': { id: 'lateral-raise', name: 'Lateral raise', nameEs: 'Elevaciones laterales', mode: 'each', allowLight: true, reps: '12-15', repsMin: 12, repsMax: 15, restSec: 60 },
  'triceps-kickback': { id: 'triceps-kickback', name: 'Triceps kickback', nameEs: 'Patada de tríceps', mode: 'each', allowLight: true, reps: '12-15', repsMin: 12, repsMax: 15, restSec: 60 },
  'incline-push-up': { id: 'incline-push-up', name: 'Incline push-up', nameEs: 'Flexión inclinada', mode: 'body', reps: '8-12', repsMin: 8, repsMax: 12, restSec: 60 },
  // ----- Ejercicios del programa anterior (solo historial)
  'step-up': { id: 'step-up', name: 'Low step-up', nameEs: 'Subida a escalón bajo', mode: 'each', allowBody: true, reps: '10 por lado', repsMin: 10, repsMax: 10, perSide: true, restSec: 90, legacy: true },
  'calf-raise': { id: 'calf-raise', name: 'Standing calf raise', nameEs: 'Elevación de talones de pie', mode: 'each', reps: '15', repsMin: 15, repsMax: 15, restSec: 60, legacy: true },
  'hammer-curl': { id: 'hammer-curl', name: 'Hammer curl', nameEs: 'Curl martillo', mode: 'each', allowLight: true, reps: '12', repsMin: 12, repsMax: 12, restSec: 60, legacy: true },
};

/**
 * Codificación compacta de las tablas: 'B' = peso corporal, 'L' = alternativa ligera
 * (botellas), número = mancuerna fija de ese peso (lb por mancuerna).
 */
type Code = 'B' | 'L' | 10 | 15 | 20;
function rx(...codes: Code[]): Rx[] {
  if (codes.length !== PROGRAM_WEEKS) throw new Error(`Se esperaban ${PROGRAM_WEEKS} semanas, hay ${codes.length}`);
  return codes.map((c) => (c === 'B' ? { kind: 'body' } : c === 'L' ? { kind: 'light' } : { kind: 'db', lb: c }));
}
const BODY = rx('B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B');

//                              S1   S2   S3   S4   S5*  S6   S7   S8   S9*  S10  S11  S12  S13
export const PLAN_DAYS: Record<StrengthDay, PlanDay> = {
  A: {
    key: 'A',
    title: 'Piernas y Glúteos A',
    weekday: 'Lunes',
    focus: 'Glúteos y piernas (cadera dominante) · core',
    slots: [
      { exerciseId: 'glute-bridge', rx: rx(15, 15, 15, 20, 15, 20, 20, 20, 15, 20, 20, 20, 20) },
      { exerciseId: 'goblet-squat', rx: rx(10, 10, 15, 15, 10, 15, 15, 20, 15, 20, 20, 20, 20) },
      { exerciseId: 'romanian-deadlift', rx: rx(10, 10, 10, 15, 10, 15, 15, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'reverse-lunge', rx: rx('B', 'B', 'B', 10, 'B', 10, 10, 10, 'B', 10, 10, 15, 15) },
      { exerciseId: 'front-plank', fixedSets: 2, rx: BODY },
    ],
  },
  B: {
    key: 'B',
    title: 'Espalda, Pecho y Brazos',
    weekday: 'Martes',
    focus: 'Espalda, pecho, hombros y brazos · core',
    slots: [
      { exerciseId: 'single-arm-row', rx: rx(10, 10, 15, 15, 10, 15, 15, 20, 15, 20, 20, 20, 20) },
      { exerciseId: 'floor-press', rx: rx(10, 10, 10, 10, 10, 15, 15, 15, 10, 15, 15, 15, 15) },
      { exerciseId: 'shoulder-press', rx: rx('L', 'L', 'L', 'L', 'L', 10, 10, 10, 'L', 10, 10, 10, 10) },
      { exerciseId: 'biceps-curl', rx: rx('L', 'L', 10, 10, 'L', 10, 10, 10, 'L', 10, 10, 10, 10) },
      { exerciseId: 'dead-bug', fixedSets: 2, rx: BODY },
    ],
  },
  C: {
    key: 'C',
    title: 'Piernas y Glúteos B',
    weekday: 'Jueves',
    focus: 'Glúteos (unilateral y glúteo medio) · core lateral',
    slots: [
      { exerciseId: 'sumo-squat', rx: rx(15, 15, 15, 20, 15, 20, 20, 20, 15, 20, 20, 20, 20) },
      { exerciseId: 'split-squat', rx: rx('B', 'B', 'B', 'B', 'B', 10, 10, 10, 'B', 10, 10, 15, 15) },
      { exerciseId: 'single-leg-bridge', rx: rx('B', 'B', 'B', 'B', 'B', 'B', 10, 10, 'B', 10, 10, 10, 10) },
      { exerciseId: 'side-lying-abduction', rx: BODY },
      { exerciseId: 'side-plank', fixedSets: 2, rx: BODY },
    ],
  },
  D: {
    key: 'D',
    title: 'Hombros, Espalda y Brazos',
    weekday: 'Viernes',
    focus: 'Espalda, hombros y brazos · glúteo unilateral',
    slots: [
      { exerciseId: 'bent-over-row', rx: rx(10, 10, 10, 15, 10, 15, 15, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'single-leg-rdl', rx: rx('B', 'B', 10, 10, 'B', 10, 10, 15, 10, 15, 15, 15, 15) },
      { exerciseId: 'lateral-raise', rx: rx('L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L') },
      { exerciseId: 'triceps-kickback', rx: rx('L', 'L', 'L', 'L', 'L', 'L', 'L', 10, 'L', 10, 10, 10, 10) },
      { exerciseId: 'incline-push-up', rx: BODY },
    ],
  },
};

export const DAY_LABELS: Record<DayKey, string> = {
  A: 'Piernas y Glúteos A',
  B: 'Espalda, Pecho y Brazos',
  C: 'Piernas y Glúteos B',
  D: 'Hombros, Espalda y Brazos',
  cardio: 'Cardio',
  rest: 'Descanso',
};

export const DEFAULT_PROFILE = {
  /** Nombre para el saludo (opcional). */
  name: '',
  sex: 'mujer' as const,
  age: 36,
  heightFt: 5,
  heightIn: 3,
  weightLb: 148,
  goalWeightLb: 120,
  waistCm: 83,
  /** Referencia estética personal; NO es una predicción ni meta médica. */
  aestheticWaistCm: 60,
  /** Las prioridades son fuerza, glúteos y definición: los números de báscula/cintura se ocultan por defecto. */
  showAestheticReference: false,
  showWeightGoal: false,
  activityLevel: 'ligero' as 'sedentario' | 'ligero' | 'moderado' | 'activo',
  conditions: 'Hígado graso',
};

export type Profile = typeof DEFAULT_PROFILE;

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES[id];
}

/** Alias histórico. */
export const findPlanExercise = getExercise;

/** Ejercicios del plan actual (sin duplicados ni antiguos). */
export function planExercises(): Exercise[] {
  const ids = new Set<string>();
  for (const d of Object.values(PLAN_DAYS)) for (const s of d.slots) ids.add(s.exerciseId);
  return [...ids].map((id) => EXERCISES[id]);
}

export function findSlot(exerciseId: string): { day: StrengthDay; slot: PlanSlot } | undefined {
  for (const d of Object.values(PLAN_DAYS)) {
    const slot = d.slots.find((s) => s.exerciseId === exerciseId);
    if (slot) return { day: d.key, slot };
  }
  return undefined;
}
