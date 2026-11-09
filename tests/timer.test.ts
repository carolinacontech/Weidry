import { describe, expect, it } from 'vitest';
import { addTime, createTimer, cuesBetween, formatClock, pause, progress, remainingMs, reset, resume, start, tick } from '../src/lib/timer';

describe('temporizador de descanso', () => {
  it('cuenta hacia atrás usando marcas de tiempo', () => {
    let t = start(createTimer(90), 1000);
    expect(remainingMs(t, 1000)).toBe(90_000);
    expect(remainingMs(t, 31_000)).toBe(60_000);
    expect(progress(t, 46_000)).toBeCloseTo(0.5);
  });

  it('pausa y reanuda conservando el restante', () => {
    let t = start(createTimer(60), 0);
    t = pause(t, 20_000);
    expect(t.status).toBe('paused');
    expect(remainingMs(t, 50_000)).toBe(40_000); // en pausa no avanza
    t = resume(t, 100_000);
    expect(remainingMs(t, 110_000)).toBe(30_000);
  });

  it('termina y no da valores negativos', () => {
    let t = start(createTimer(45), 0);
    t = tick(t, 50_000);
    expect(t.status).toBe('done');
    expect(remainingMs(t, 60_000)).toBe(0);
  });

  it('es correcto aunque la página haya estado congelada (segundo plano)', () => {
    const t = start(createTimer(120), 0);
    // Sin ticks intermedios: al volver tras 100 s el restante es 20 s.
    expect(remainingMs(t, 100_000)).toBe(20_000);
  });

  it('permite sumar y restar tiempo', () => {
    let t = start(createTimer(60), 0);
    t = addTime(t, 15, 10_000);
    expect(remainingMs(t, 10_000)).toBe(65_000);
    t = addTime(t, -100, 10_000);
    expect(remainingMs(t, 10_000)).toBe(0);
    let p = pause(start(createTimer(60), 0), 0);
    p = addTime(p, -15, 0);
    expect(p.remainingMs).toBe(45_000);
  });

  it('reiniciar vuelve a idle con la duración elegida', () => {
    const t = reset(start(createTimer(60), 0), 120);
    expect(t.status).toBe('idle');
    expect(remainingMs(t, 999_999)).toBe(120_000);
  });

  it('reiniciar un temporizador terminado con start usa la duración completa', () => {
    const t = start(tick(start(createTimer(45), 0), 60_000), 70_000);
    expect(remainingMs(t, 70_000)).toBe(45_000);
  });

  it('emite avisos al cruzar marcas', () => {
    expect(cuesBetween(10_200, 9_900, 60_000)).toEqual(['ten']);
    expect(cuesBetween(3_100, 2_950, 60_000)).toEqual(['three']);
    expect(cuesBetween(200, 0, 60_000)).toEqual(['done']);
    expect(cuesBetween(30_100, 29_900, 60_000)).toEqual(['halfway']);
    expect(cuesBetween(5_000, 5_000, 60_000)).toEqual([]);
  });

  it('tras congelación solo emite el último aviso cruzado', () => {
    expect(cuesBetween(50_000, 0, 60_000)).toEqual(['done']);
  });

  it('no avisa a los 10 s en descansos muy cortos', () => {
    expect(cuesBetween(10_100, 9_900, 12_000)).toEqual([]);
  });

  it('formatea el reloj', () => {
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(4_200)).toBe('0:05');
    expect(formatClock(0)).toBe('0:00');
  });
});
