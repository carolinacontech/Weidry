import { describe, expect, it } from 'vitest';
import { cardioFromCSV, cardioToCSV, detectCSVKind, makeBackup, measurementsFromCSV, measurementsToCSV, parseBackup, parseCSV } from '../src/lib/exportImport';

describe('CSV', () => {
  it('parsea comillas, comas y saltos de línea', () => {
    expect(parseCSV('a,b\n"x, y","di ""hola""\nmundo"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'di "hola"\nmundo'],
    ]);
  });

  it('ida y vuelta de medidas', () => {
    const csv = measurementsToCSV([{ date: '2026-11-09', weightLb: 148, waistCm: 83, notes: 'inicio, en ayunas' }]);
    expect(detectCSVKind(csv)).toBe('measurements');
    expect(measurementsFromCSV(csv)).toEqual([
      { date: '2026-11-09', weightLb: 148, waistCm: 83, hipCm: undefined, armCm: undefined, thighCm: undefined, notes: 'inicio, en ayunas' },
    ]);
  });

  it('ida y vuelta de cardio e ignora filas inválidas', () => {
    const csv = cardioToCSV([{ date: '2026-11-11', minutes: 50, activity: 'Caminata' }]) + 'fecha-mala,10,x,\n';
    expect(detectCSVKind(csv)).toBe('cardio');
    expect(cardioFromCSV(csv)).toEqual([{ date: '2026-11-11', minutes: 50, activity: 'Caminata', notes: undefined }]);
  });
});

describe('copia JSON', () => {
  it('valida la estructura', () => {
    const b = makeBackup({ kv: [], sessions: [], measurements: [], cardio: [], adjustments: [] });
    expect(parseBackup(JSON.stringify(b)).app).toBe('mi-entrenamiento');
    expect(() => parseBackup('{}')).toThrow();
    expect(() => parseBackup('no json')).toThrow(/JSON/);
  });
});
