import type { Mode } from '../data/plan';
import type { Difficulty } from './progression';
import type { TimerState } from './timer';
import type { LoadOption, Unit } from './weights';

export type Tempo = 'normal' | 'lento';

export interface SetLog {
  setNumber: number;
  /** Repeticiones (o segundos si el ejercicio es por tiempo). */
  reps: number;
  /** Carga realmente usada (tipo + peso de una unidad). Ausente en registros de la versión 1. */
  option?: LoadOption;
  /** Peso de una mancuerna/objeto en lb (0 = peso corporal). Se mantiene por compatibilidad y CSV. */
  loadLb: number;
  /** Repeticiones en reserva (4 = 4 o más). null = no registrado. */
  rir?: number | null;
  tempo?: Tempo;
  /** Cómo se sujetó la carga en esta serie si difiere del ejercicio. */
  mode?: Mode;
  /** Solo registros de la versión 1. */
  difficulty?: Difficulty | null;
  pain: boolean;
  techniqueOk: boolean;
  completedAt: string;
}

export interface ExerciseLog {
  exerciseId: string;
  /** Si se sustituyó: id, nombre y cómo se sujeta la carga de la alternativa. */
  substitute?: { id: string; name: string; mode: Mode };
  status: 'pending' | 'done' | 'skipped';
  plannedSets: number;
  /** Carga propuesta al crear la sesión. */
  plannedOption?: LoadOption;
  /** Versión 1: carga propuesta en lb. */
  plannedLoadLb?: number;
  sets: SetLog[];
}

export type SessionPhase = 'warmup' | 'work' | 'rest' | 'summary';

export interface WorkoutSession {
  id: string;
  date: string;
  week: number;
  dayKey: 'A' | 'B' | 'C' | 'D';
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  phase: SessionPhase;
  exerciseIndex: number;
  /** Estado del descanso (marcas de tiempo) para recuperarlo tras una interrupción. */
  rest?: TimerState | null;
  paused?: boolean;
  exercises: ExerciseLog[];
  notes?: string;
}

export interface Measurement {
  id?: number;
  date: string;
  weightLb?: number;
  waistCm?: number;
  hipCm?: number;
  armCm?: number;
  thighCm?: number;
  notes?: string;
}

export interface CardioLog {
  id?: number;
  date: string;
  minutes: number;
  activity: string;
  notes?: string;
}

/** Cambio de carga aprobado explícitamente por la persona. */
export interface LoadAdjustment {
  id?: number;
  exerciseId: string;
  createdAt: string;
  option: LoadOption;
  reason: string;
}

export interface Settings {
  onboarded: boolean;
  unit: Unit;
  theme: 'system' | 'light' | 'dark';
  /** 0 = usar el descanso recomendado de cada ejercicio. */
  restSec: 0 | 45 | 60 | 90 | 120;
  sound: boolean;
  voice: boolean;
  /** Comandos de voz manos libres ("listo", "pausa", "siguiente"…). */
  voiceCommands: boolean;
  vibration: boolean;
  wakeLock: boolean;
  /** Pedir repeticiones en reserva en cada serie. */
  askRir: boolean;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  notificationsEnabled: boolean;
  lastNotifiedDate?: string;
  /** Videos o enlaces autorizados que la persona añade por ejercicio. */
  videoLinks: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  unit: 'lb',
  theme: 'system',
  restSec: 0,
  sound: true,
  voice: true,
  voiceCommands: false,
  vibration: true,
  wakeLock: true,
  askRir: true,
  reminderEnabled: true,
  reminderTime: '18:00',
  notificationsEnabled: false,
  videoLinks: {},
};

/** Carga de una serie, compatible con registros antiguos. */
export function setOption(s: Pick<SetLog, 'option' | 'loadLb'>): LoadOption {
  return s.option ?? (s.loadLb > 0 ? { kind: 'db', lb: s.loadLb } : { kind: 'body', lb: 0 });
}

/** Carga propuesta de un ejercicio de la sesión, compatible con registros antiguos. */
export function plannedOptionOf(e: Pick<ExerciseLog, 'plannedOption' | 'plannedLoadLb'>): LoadOption {
  return e.plannedOption ?? ((e.plannedLoadLb ?? 0) > 0 ? { kind: 'db', lb: e.plannedLoadLb! } : { kind: 'body', lb: 0 });
}
