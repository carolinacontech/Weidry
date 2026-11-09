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

/** Objetivo de cada semana (texto del prototipo). */
export const WEEK_FOCUS = [
  'Aprender técnica y encontrar cargas cómodas',
  'Mejorar técnica y terminar las series con control',
  'Construir volumen de entrenamiento',
  'Construir volumen de entrenamiento',
  'Recuperación: menos series y cargas conservadoras',
  'Fortalecer movimientos principales',
  'Fortalecer movimientos principales',
  'Fortalecer movimientos principales',
  'Recuperación: menor volumen',
  'Consolidar fuerza y confianza',
  'Consolidar fuerza y confianza',
  'Evaluar progreso sin forzar el peso',
  'Completar el ciclo y celebrar avances',
] as const;

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
  /** Indicación breve de técnica. */
  cue?: string;
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
  short: string;
  weekday: string;
  focus: string;
  slots: PlanSlot[];
}

/** Catálogo de ejercicios (incluye los antiguos, para mostrar el historial). */
export const EXERCISES: Record<string, Exercise> = {
  // ----- A · Piernas y glúteos A
  'goblet-squat': { id: 'goblet-squat', name: 'Goblet squat', nameEs: 'Sentadilla goblet', mode: 'held', allowBody: true, reps: '10–12', repsMin: 10, repsMax: 12, restSec: 90, glute: true, cue: 'Pecho estable, rodillas alineadas y baja con control. Usa una silla si necesitas apoyo.' },
  'romanian-deadlift': { id: 'romanian-deadlift', name: 'Romanian deadlift', nameEs: 'Peso muerto rumano', mode: 'each', reps: '8–12', repsMin: 8, repsMax: 12, restSec: 120, glute: true, cue: 'Lleva la cadera hacia atrás y conserva la espalda neutral.' },
  'glute-bridge': { id: 'glute-bridge', name: 'Weighted glute bridge', nameEs: 'Puente de glúteos', mode: 'held', allowBody: true, reps: '12–15', repsMin: 12, repsMax: 15, restSec: 90, glute: true, cue: 'Empuja con los talones y aprieta los glúteos al subir. Mantén las costillas abajo.' },
  'reverse-lunge': { id: 'reverse-lunge', name: 'Reverse lunge', nameEs: 'Zancada atrás', mode: 'held', allowBody: true, reps: '8–10 por pierna', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true, cue: 'Da un paso hacia atrás; utiliza apoyo para mantener el equilibrio.' },
  'front-plank': { id: 'front-plank', name: 'Front plank', nameEs: 'Plancha frontal', mode: 'body', reps: '15–30 segundos', repsMin: 15, repsMax: 30, timed: true, restSec: 60, cue: 'Mantén glúteos y abdomen activos sin hundir la espalda.' },
  // ----- B · Espalda, pecho y brazos
  'single-arm-row': { id: 'single-arm-row', name: 'Single-arm row', nameEs: 'Remo a una mano', mode: 'one', reps: '10–12 por lado', repsMin: 10, repsMax: 12, perSide: true, restSec: 90, cue: 'Apoya la mano libre y lleva el codo hacia la cadera.' },
  'floor-press': { id: 'floor-press', name: 'Dumbbell floor press', nameEs: 'Press de pecho en suelo', mode: 'each', reps: '8–12', repsMin: 8, repsMax: 12, restSec: 90, cue: 'Codos a unos 45° del torso; controla el descenso.' },
  'incline-push-up': { id: 'incline-push-up', name: 'Incline push-up', nameEs: 'Flexiones inclinadas', mode: 'body', reps: '8–12', repsMin: 8, repsMax: 12, restSec: 60, cue: 'Usa una superficie estable y elevada; conserva alineado el tronco.' },
  'biceps-curl': { id: 'biceps-curl', name: 'Biceps curl', nameEs: 'Curl de bíceps', mode: 'each', allowLight: true, reps: '8–12', repsMin: 8, repsMax: 12, restSec: 60, cue: 'Si 10 lb es demasiado, usa botellas ligeras. No balancees el cuerpo.' },
  'dead-bug': { id: 'dead-bug', name: 'Dead bug', nameEs: 'Dead bug', mode: 'body', reps: '8 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 60, cue: 'Desciende el brazo y la pierna contrarios sin arquear la zona lumbar.' },
  // ----- C · Piernas y glúteos B
  'sumo-squat': { id: 'sumo-squat', name: 'Sumo squat', nameEs: 'Sentadilla sumo', mode: 'held', allowBody: true, reps: '10–12', repsMin: 10, repsMax: 12, restSec: 90, glute: true, cue: 'Separa un poco más los pies y mantén las rodillas alineadas.' },
  'step-up': { id: 'step-up', name: 'Low step-up', nameEs: 'Step-up bajo', mode: 'held', allowBody: true, reps: '10 por pierna', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true, cue: 'Usa un escalón firme y bajo; evita impulsarte con la pierna de abajo.' },
  'calf-raise': { id: 'calf-raise', name: 'Standing calf raise', nameEs: 'Elevaciones de talones', mode: 'each', reps: '15', repsMin: 12, repsMax: 15, restSec: 60, cue: 'Sube despacio y haz una pausa breve arriba.' },
  'side-plank': { id: 'side-plank', name: 'Side plank', nameEs: 'Plancha lateral', mode: 'body', reps: '15–25 segundos por lado', repsMin: 15, repsMax: 25, timed: true, perSide: true, restSec: 60, cue: 'Apoya el antebrazo y mantén la cadera alineada.' },
  // ----- D · Espalda, hombros y brazos
  'bent-over-row': { id: 'bent-over-row', name: 'Bent-over dumbbell row', nameEs: 'Remo inclinado', mode: 'each', reps: '10–12', repsMin: 10, repsMax: 12, restSec: 90, cue: 'Inclina el torso desde la cadera y aprieta la espalda.' },
  'shoulder-press': { id: 'shoulder-press', name: 'Shoulder press', nameEs: 'Press de hombros', mode: 'each', allowLight: true, reps: '8–12', repsMin: 8, repsMax: 12, restSec: 90, cue: 'No arquees la espalda. Usa botellas ligeras si 10 lb es demasiado.' },
  'triceps-extension': { id: 'triceps-extension', name: 'Overhead triceps extension', nameEs: 'Extensión de tríceps', mode: 'held', allowLight: true, reps: '10–12', repsMin: 10, repsMax: 12, restSec: 60, cue: 'Mantén los codos estables; evita sobrecargar los hombros.' },
  'hammer-curl': { id: 'hammer-curl', name: 'Hammer curl', nameEs: 'Curl martillo', mode: 'each', allowLight: true, reps: '8–12', repsMin: 8, repsMax: 12, restSec: 60, cue: 'Palmas mirando hacia adentro; movimiento lento y controlado.' },
  'yt-raise': { id: 'yt-raise', name: 'Y / T raises', nameEs: 'Elevaciones Y / T', mode: 'body', reps: '8–12', repsMin: 8, repsMax: 12, restSec: 60, cue: 'Sube los brazos con control. Evita elevar demasiado los hombros.' },
  // ----- Ejercicios de versiones anteriores (solo historial)
  'split-squat': { id: 'split-squat', name: 'Bulgarian split squat', nameEs: 'Sentadilla búlgara', mode: 'each', allowBody: true, reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true, legacy: true },
  'single-leg-bridge': { id: 'single-leg-bridge', name: 'Single-leg glute bridge', nameEs: 'Puente de glúteo a una pierna', mode: 'held', allowBody: true, reps: '10-12 por lado', repsMin: 10, repsMax: 12, perSide: true, restSec: 60, glute: true, legacy: true },
  'side-lying-abduction': { id: 'side-lying-abduction', name: 'Side-lying hip abduction', nameEs: 'Abducción de cadera tumbada', mode: 'body', reps: '15-20 por lado', repsMin: 15, repsMax: 20, perSide: true, restSec: 60, glute: true, legacy: true },
  'single-leg-rdl': { id: 'single-leg-rdl', name: 'Supported single-leg RDL', nameEs: 'Peso muerto a una pierna', mode: 'one', allowBody: true, reps: '8-10 por lado', repsMin: 8, repsMax: 10, perSide: true, restSec: 90, glute: true, legacy: true },
  'lateral-raise': { id: 'lateral-raise', name: 'Lateral raise', nameEs: 'Elevaciones laterales', mode: 'each', allowLight: true, reps: '12-15', repsMin: 12, repsMax: 15, restSec: 60, legacy: true },
  'triceps-kickback': { id: 'triceps-kickback', name: 'Triceps kickback', nameEs: 'Patada de tríceps', mode: 'each', allowLight: true, reps: '12-15', repsMin: 12, repsMax: 15, restSec: 60, legacy: true },
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
    title: 'Piernas & glúteos A',
    short: 'Glúteos y piernas',
    weekday: 'Lunes',
    focus: 'Glúteos y piernas · core',
    slots: [
      { exerciseId: 'goblet-squat', rx: rx(10, 10, 10, 15, 10, 15, 15, 20, 10, 20, 20, 20, 20) },
      { exerciseId: 'romanian-deadlift', rx: rx(10, 10, 10, 10, 10, 15, 15, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'glute-bridge', rx: rx(10, 10, 15, 15, 10, 15, 20, 20, 10, 20, 20, 20, 20) },
      { exerciseId: 'reverse-lunge', rx: rx('B', 'B', 'B', 'B', 'B', 10, 10, 10, 'B', 10, 10, 15, 15) },
      { exerciseId: 'front-plank', fixedSets: 2, rx: BODY },
    ],
  },
  B: {
    key: 'B',
    title: 'Espalda, pecho y brazos',
    short: 'Tren superior A',
    weekday: 'Martes',
    focus: 'Espalda, pecho y brazos · core',
    slots: [
      { exerciseId: 'single-arm-row', rx: rx(10, 10, 10, 15, 10, 15, 15, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'floor-press', rx: rx(10, 10, 10, 10, 10, 10, 10, 15, 10, 15, 15, 15, 15) },
      { exerciseId: 'incline-push-up', rx: BODY },
      { exerciseId: 'biceps-curl', rx: rx(10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10) },
      { exerciseId: 'dead-bug', fixedSets: 2, rx: BODY },
    ],
  },
  C: {
    key: 'C',
    title: 'Piernas & glúteos B',
    short: 'Glúteos y piernas',
    weekday: 'Jueves',
    focus: 'Glúteos y piernas · core lateral',
    slots: [
      { exerciseId: 'sumo-squat', rx: rx(10, 10, 10, 15, 10, 15, 15, 20, 10, 20, 20, 20, 20) },
      { exerciseId: 'step-up', rx: rx('B', 'B', 'B', 'B', 'B', 10, 10, 10, 'B', 10, 10, 15, 15) },
      { exerciseId: 'glute-bridge', rx: rx(10, 10, 15, 15, 10, 20, 20, 20, 10, 20, 20, 20, 20) },
      { exerciseId: 'calf-raise', rx: rx(10, 10, 10, 10, 10, 10, 10, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'side-plank', fixedSets: 2, rx: BODY },
    ],
  },
  D: {
    key: 'D',
    title: 'Espalda, hombros y brazos',
    short: 'Tren superior B',
    weekday: 'Viernes',
    focus: 'Espalda, hombros y brazos',
    slots: [
      { exerciseId: 'bent-over-row', rx: rx(10, 10, 10, 15, 10, 15, 15, 15, 10, 15, 15, 20, 20) },
      { exerciseId: 'shoulder-press', rx: rx(10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10) },
      { exerciseId: 'triceps-extension', rx: rx(10, 10, 10, 10, 10, 10, 10, 15, 10, 15, 15, 15, 15) },
      { exerciseId: 'hammer-curl', rx: rx(10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10) },
      { exerciseId: 'yt-raise', rx: BODY },
    ],
  },
};

export const DAY_LABELS: Record<DayKey, string> = {
  A: 'Piernas & glúteos A',
  B: 'Espalda, pecho y brazos',
  C: 'Piernas & glúteos B',
  D: 'Espalda, hombros y brazos',
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
  /** Cadera inicial medida (cm). */
  hipCm: 107,
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
