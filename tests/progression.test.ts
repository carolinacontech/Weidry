import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../src/data/plan';
import { classifySession, suggestProgression, type ExerciseSessionResult } from '../src/lib/progression';
import { DEFAULT_INVENTORY, ladderFor, type LoadOption } from '../src/lib/weights';

const db = (lb: number): LoadOption => ({ kind: 'db', lb });
const RDL = EXERCISES['romanian-deadlift']; // por mano, 8-12
const LATERAL = EXERCISES['shoulder-press']; // por mano, admite botellas, 8-12
const PLANK = EXERCISES['front-plank'];
const ladderRDL = ladderFor(RDL, DEFAULT_INVENTORY);

function session(o: { rir?: number | null; reps?: number; sets?: number; planned?: number; option?: LoadOption; pain?: boolean; technique?: boolean } = {}): ExerciseSessionResult {
  const n = o.sets ?? 3;
  return {
    date: '2026-11-09',
    plannedSets: o.planned ?? 3,
    sets: Array.from({ length: n }, (_, i) => ({
      reps: o.reps ?? 10,
      option: o.option ?? db(10),
      rir: o.rir === undefined ? 2 : o.rir,
      pain: i === 0 ? !!o.pain : false,
      techniqueOk: o.technique ?? true,
    })),
  };
}

describe('classifySession', () => {
  it('dolor tiene prioridad', () => expect(classifySession(session({ pain: true }), RDL)).toBe('pain'));
  it('series incompletas', () => expect(classifySession(session({ sets: 2 }), RDL)).toBe('incomplete'));
  it('técnica inadecuada', () => expect(classifySession(session({ technique: false }), RDL)).toBe('technique'));
  it('RIR 0–1 es demasiado cerca del fallo', () => expect(classifySession(session({ rir: 1 }), RDL)).toBe('hard'));
  it('reps por debajo del mínimo', () => expect(classifySession(session({ reps: 7 }), RDL)).toBe('hard'));
  it('sin RIR registrado', () => expect(classifySession(session({ rir: null }), RDL)).toBe('unrated'));
  it('cumple el criterio con 2–3 RIR', () => {
    expect(classifySession(session({ rir: 2 }), RDL)).toBe('target');
    expect(classifySession(session({ rir: 3 }), RDL)).toBe('target');
  });
  it('cargas distintas entre series no cuentan', () => {
    const s = session();
    s.sets[2].option = db(15);
    expect(classifySession(s, RDL)).toBe('mixed');
  });
});

describe('suggestProgression (criterio RIR)', () => {
  const base = { ex: RDL, ladder: ladderRDL };

  it('una sola sesión que cumple → progresar con repeticiones, no con peso', () => {
    expect(suggestProgression({ ...base, history: [session()] }).kind).toBe('reps');
  });

  it('dos sesiones consecutivas que cumplen → sugiere la siguiente mancuerna existente (opcional, salto grande)', () => {
    const r = suggestProgression({ ...base, history: [session(), session()] });
    expect(r.kind).toBe('increase');
    if (r.kind === 'increase') {
      expect(r.to).toMatchObject({ kind: 'db', lb: 15 });
      expect(r.bigJump).toBe(true);
      expect(r.message).toMatch(/opcional/);
    }
  });

  it('no sube si una de las dos sesiones no completó todas las series', () => {
    expect(suggestProgression({ ...base, history: [session({ sets: 2 }), session()] }).kind).toBe('reps');
  });

  it('no sube si la técnica no fue adecuada', () => {
    expect(suggestProgression({ ...base, history: [session(), session({ technique: false })] }).kind).toBe('keep');
  });

  it('no sube si en una sesión quedó con RIR 1', () => {
    expect(suggestProgression({ ...base, history: [session({ rir: 1 }), session()] }).kind).toBe('reps');
  });

  it('las dos sesiones deben ser con la misma carga', () => {
    expect(suggestProgression({ ...base, history: [session({ option: db(15) }), session({ option: db(10) })] }).kind).toBe('reps');
  });

  it('nunca propone una mancuerna inexistente: con 20 lb no hay siguiente → repeticiones', () => {
    const r = suggestProgression({ ...base, history: [session({ option: db(20) }), session({ option: db(20) })] });
    expect(r.kind).toBe('reps');
  });

  it('en el tope de repeticiones sin opción superior → tempo o series', () => {
    const r = suggestProgression({ ...base, history: [session({ option: db(20), reps: 12 }), session({ option: db(20), reps: 12 })] });
    expect(r.kind).toBe('tempo');
    expect(r.message).toMatch(/tempo/);
  });

  it('sin llegar al mínimo y con RIR 0 → opción inferior disponible', () => {
    const r = suggestProgression({ ...base, history: [session({ option: db(15), reps: 7, rir: 0 })] });
    expect(r).toMatchObject({ kind: 'decrease', to: { kind: 'db', lb: 10 } });
  });

  it('difícil pero dentro del rango → mantener', () => {
    expect(suggestProgression({ ...base, history: [session({ rir: 1 })] }).kind).toBe('keep');
  });

  it('dolor → parar y consultar', () => {
    const r = suggestProgression({ ...base, history: [session(), session(), session({ pain: true })] });
    expect(r.kind).toBe('stop_pain');
    expect(r.message).toMatch(/profesional/);
  });

  it('sin RIR registrado no sugiere subir', () => {
    expect(suggestProgression({ ...base, history: [session({ rir: null }), session({ rir: null })] }).kind).toBe('keep');
  });

  it('press de hombros con botellas: pasa a la siguiente botella, no salta a 10 lb', () => {
    const ladder = ladderFor(LATERAL, DEFAULT_INVENTORY);
    const light = (lb: number): LoadOption => ({ kind: 'light', lb });
    const r = suggestProgression({ ex: LATERAL, ladder, history: [session({ option: light(2.2), reps: 12 }), session({ option: light(2.2), reps: 12 })] });
    expect(r).toMatchObject({ kind: 'increase', to: { kind: 'light', lb: 3.3 }, bigJump: false });
  });

  it('peso corporal (plancha): progresa con segundos', () => {
    const ladder = ladderFor(PLANK, DEFAULT_INVENTORY);
    const body: LoadOption = { kind: 'body', lb: 0 };
    const r = suggestProgression({ ex: PLANK, ladder, history: [session({ option: body, reps: 25 }), session({ option: body, reps: 25 })] });
    expect(r.kind).toBe('reps');
    expect(r.message).toMatch(/segundos/);
  });
});
