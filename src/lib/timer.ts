/**
 * Temporizador de descanso basado en marcas de tiempo (no en contar ticks).
 * Así sigue siendo correcto aunque iOS congele la página en segundo plano:
 * al volver, el tiempo restante se recalcula con Date.now().
 */

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  /** Momento (ms) en que terminará si está corriendo. */
  endsAt: number | null;
  /** Restante congelado cuando está en pausa. */
  remainingMs: number;
}

export function createTimer(durationSec: number): TimerState {
  const ms = Math.max(0, durationSec) * 1000;
  return { status: 'idle', durationMs: ms, endsAt: null, remainingMs: ms };
}

export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state;
  const remaining = state.status === 'done' ? state.durationMs : state.remainingMs;
  return { ...state, status: 'running', endsAt: now + remaining, remainingMs: remaining };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state;
  const remainingMs = Math.max(0, state.endsAt - now);
  return { ...state, status: remainingMs === 0 ? 'done' : 'paused', endsAt: null, remainingMs };
}

export const resume = start;

export function reset(state: TimerState, durationSec?: number): TimerState {
  return createTimer(durationSec ?? state.durationMs / 1000);
}

/** Suma (o resta, si es negativo) segundos al temporizador. */
export function addTime(state: TimerState, seconds: number, now: number): TimerState {
  const delta = seconds * 1000;
  if (state.status === 'running' && state.endsAt !== null) {
    const endsAt = Math.max(now, state.endsAt + delta);
    return { ...state, endsAt, durationMs: Math.max(0, state.durationMs + delta), remainingMs: endsAt - now };
  }
  const remainingMs = Math.max(0, state.remainingMs + delta);
  return { ...state, remainingMs, durationMs: Math.max(0, state.durationMs + delta) };
}

export function remainingMs(state: TimerState, now: number): number {
  // Se limita a la duración por si `now` es una lectura ligeramente anterior al inicio.
  if (state.status === 'running' && state.endsAt !== null) return Math.min(state.durationMs, Math.max(0, state.endsAt - now));
  if (state.status === 'done') return 0;
  return state.remainingMs;
}

/** Actualiza el estado a "done" si el tiempo terminó. */
export function tick(state: TimerState, now: number): TimerState {
  if (state.status === 'running' && remainingMs(state, now) === 0) {
    return { ...state, status: 'done', endsAt: null, remainingMs: 0 };
  }
  return state;
}

export function progress(state: TimerState, now: number): number {
  if (state.durationMs === 0) return 1;
  return 1 - remainingMs(state, now) / state.durationMs;
}

export type Cue = 'halfway' | 'ten' | 'three' | 'two' | 'one' | 'done';

/**
 * Avisos cruzados entre dos lecturas del restante (en ms).
 * Útil para sonidos y voz: si la página estuvo congelada, solo se emite
 * el aviso más reciente para no encadenar sonidos atrasados.
 */
export function cuesBetween(prevMs: number, nextMs: number, durationMs: number): Cue[] {
  if (nextMs >= prevMs) return [];
  const marks: [Cue, number][] = [
    ['halfway', durationMs >= 40_000 ? durationMs / 2 : -1],
    ['ten', durationMs > 15_000 ? 10_000 : -1],
    ['three', 3_000],
    ['two', 2_000],
    ['one', 1_000],
    ['done', 0],
  ];
  const crossed = marks.filter(([, t]) => t >= 0 && prevMs > t && nextMs <= t).map(([c]) => c);
  // Si saltamos muchos avisos a la vez (página congelada), quedarnos solo con el último.
  return crossed.length > 1 ? [crossed[crossed.length - 1]] : crossed;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
