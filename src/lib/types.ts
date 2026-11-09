import type { LoadType } from '../data/plan';
import type { Difficulty } from './progression';
import type { TimerState } from './timer';
import type { Unit } from './weights';

export interface SetLog {
  setNumber: number;
  /** Repeticiones (o segundos si el ejercicio es por tiempo). */
  reps: number;
  /** Carga realmente usada en lb (0 = peso corporal). */
  loadLb: number;
  difficulty: Difficulty | null;
  pain: boolean;
  techniqueOk: boolean;
  completedAt: string;
}

export interface ExerciseLog {
  exerciseId: string;
  /** Si se sustituyó: id y nombre de la alternativa. */
  substitute?: { id: string; name: string; loadType: LoadType };
  status: 'pending' | 'done' | 'skipped';
  plannedSets: number;
  plannedLoadLb: number;
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

/** Ajuste de carga aprobado por la persona. */
export interface LoadAdjustment {
  id?: number;
  exerciseId: string;
  createdAt: string;
  /** Diferencia (lb) respecto a la carga del plan que se aplicará desde ahora. */
  deltaLb: number;
  /** Carga aprobada (lb) en el momento de la aprobación, para referencia. */
  approvedLb: number;
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
  vibration: boolean;
  wakeLock: boolean;
  askDifficulty: boolean;
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
  vibration: true,
  wakeLock: true,
  askDifficulty: true,
  reminderEnabled: true,
  reminderTime: '18:00',
  notificationsEnabled: false,
  videoLinks: {},
};
