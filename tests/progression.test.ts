import { describe, expect, it } from 'vitest';
import { classifySession, effectivePlannedLb, suggestProgression, type ExerciseSessionResult } from '../src/lib/progression';

const AVAILABLE = [3, 5, 8, 10, 12, 15, 20];

function session(difficulty: 'easy' | 'ok' | 'hard' | null, opts: { pain?: boolean; techniqueOk?: boolean; load?: number } = {}): ExerciseSessionResult {
  const load = opts.load ?? 8;
  return {
    date: '2026-11-09',
    loadLb: load,
    sets: [
      { reps: 12, loadLb: load, difficulty, pain: opts.pain ?? false, techniqueOk: opts.techniqueOk ?? true },
      { reps: 12, loadLb: load, difficulty, pain: false, techniqueOk: opts.techniqueOk ?? true },
    ],
  };
}

const base = { currentLoadLb: 8, loadType: 'each' as const, available: AVAILABLE, repsMax: 12 };

describe('classifySession', () => {
  it('prioriza el dolor sobre cualquier otra señal', () => {
    expect(classifySession(session('easy', { pain: true }))).toBe('pain');
  });
  it('una sola serie demasiado difícil marca la sesión como difícil', () => {
    const s = session('easy');
    s.sets[1].difficulty = 'hard';
    expect(classifySession(s)).toBe('hard');
  });
  it('sin valoraciones queda "unrated"', () => {
    expect(classifySession(session(null))).toBe('unrated');
  });
  it('fácil con técnica inadecuada no cuenta como fácil', () => {
    expect(classifySession(session('easy', { techniqueOk: false }))).toBe('ok');
  });
});

describe('suggestProgression', () => {
  it('sin historial mantiene la carga', () => {
    expect(suggestProgression({ ...base, history: [] }).kind).toBe('keep');
  });

  it('NO sugiere subir tras una sola sesión fácil', () => {
    expect(suggestProgression({ ...base, history: [session('easy')] }).kind).toBe('keep');
  });

  it('sugiere la subida mínima disponible tras dos sesiones fáciles con buena técnica', () => {
    const r = suggestProgression({ ...base, history: [session('easy'), session('easy')] });
    expect(r).toMatchObject({ kind: 'increase', toLb: 10 });
  });

  it('no sube si una de las dos sesiones fáciles tuvo técnica inadecuada', () => {
    const r = suggestProgression({ ...base, history: [session('easy', { techniqueOk: false }), session('easy')] });
    expect(r.kind).toBe('keep');
  });

  it('requiere que las dos fáciles sean las dos últimas (consecutivas)', () => {
    const r = suggestProgression({ ...base, history: [session('easy'), session('ok'), session('easy')] });
    expect(r.kind).toBe('keep');
  });

  it('si fue demasiado difícil sugiere bajar al siguiente peso disponible', () => {
    const r = suggestProgression({ ...base, history: [session('hard')] });
    expect(r).toMatchObject({ kind: 'decrease', toLb: 5 });
  });

  it('si es difícil y no hay peso menor, sugiere reducir repeticiones', () => {
    const r = suggestProgression({ ...base, currentLoadLb: 3, history: [session('hard', { load: 3 })] });
    expect(r.kind).toBe('decrease_reps');
  });

  it('con dolor indica parar, aunque las sesiones anteriores fueran fáciles', () => {
    const r = suggestProgression({ ...base, history: [session('easy'), session('easy'), session('easy', { pain: true })] });
    expect(r.kind).toBe('stop_pain');
    expect(r.message).toMatch(/profesional/);
  });

  it('si no hay peso superior en el inventario, sugiere más repeticiones', () => {
    const r = suggestProgression({ ...base, currentLoadLb: 20, available: AVAILABLE, history: [session('easy', { load: 20 }), session('easy', { load: 20 })] });
    expect(r.kind).toBe('increase_reps');
  });

  it('no fuerza saltos grandes: prioriza repeticiones', () => {
    const r = suggestProgression({ ...base, currentLoadLb: 12, available: [12, 25], history: [session('easy', { load: 12 }), session('easy', { load: 12 })] });
    expect(r.kind).toBe('increase_reps');
  });

  it('peso corporal: dos fáciles → más repeticiones/segundos', () => {
    const r = suggestProgression({ ...base, loadType: 'body', currentLoadLb: 0, history: [session('easy', { load: 0 }), session('easy', { load: 0 })] });
    expect(r.kind).toBe('increase_reps');
  });
});

describe('effectivePlannedLb', () => {
  it('aplica el ajuste aprobado sobre el plan', () => {
    expect(effectivePlannedLb(8, 2, 'each')).toBe(10);
    expect(effectivePlannedLb(8, undefined, 'each')).toBe(8);
    expect(effectivePlannedLb(5, -10, 'each')).toBe(0);
    expect(effectivePlannedLb(0, 3, 'each')).toBe(3);
    expect(effectivePlannedLb(0, 3, 'body')).toBe(0);
  });
});
