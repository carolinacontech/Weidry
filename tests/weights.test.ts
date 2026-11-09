import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../src/data/plan';
import { DEFAULT_INVENTORY, formatOption, isBigJump, ladderFor, normalizeInventory, resolveRx, stepDown, stepUp, totalLb, type InventoryItem } from '../src/lib/weights';

const db = (lb: number) => ({ kind: 'db' as const, lb });

describe('equipamiento real', () => {
  it('inventario por defecto: pares de 10, 15 y 20 lb + botellas', () => {
    const fixed = DEFAULT_INVENTORY.filter((i) => i.kind === 'fixed');
    expect(fixed.map((i) => [i.value, i.count])).toEqual([[10, 2], [15, 2], [20, 2]]);
    expect(DEFAULT_INVENTORY.some((i) => i.kind === 'light')).toBe(true);
  });

  it('la escalera solo contiene opciones existentes', () => {
    const l = ladderFor(EXERCISES['romanian-deadlift'], DEFAULT_INVENTORY);
    expect(l).toEqual([db(10), db(15), db(20)]);
    const lat = ladderFor(EXERCISES['lateral-raise'], DEFAULT_INVENTORY);
    expect(lat.map((o) => o.kind)).toEqual(['light', 'light', 'light', 'db', 'db', 'db']);
    const lunge = ladderFor(EXERCISES['reverse-lunge'], DEFAULT_INVENTORY);
    expect(lunge[0]).toEqual({ kind: 'body', lb: 0 });
  });

  it('por mano exige un par; con una sola unidad no se ofrece', () => {
    const inv: InventoryItem[] = [
      { id: 'a', kind: 'fixed', value: 10, unit: 'lb', count: 2 },
      { id: 'b', kind: 'fixed', value: 15, unit: 'lb', count: 1 },
    ];
    expect(ladderFor(EXERCISES['romanian-deadlift'], inv)).toEqual([db(10)]);
    expect(ladderFor(EXERCISES['goblet-squat'], inv).filter((o) => o.kind === 'db')).toEqual([db(10), db(15)]);
  });

  it('nunca resuelve a una mancuerna inexistente', () => {
    const l = ladderFor(EXERCISES['romanian-deadlift'], DEFAULT_INVENTORY);
    expect(resolveRx({ kind: 'db', lb: 12 }, l)).toMatchObject({ option: db(10), exact: false });
    expect(resolveRx({ kind: 'db', lb: 25 }, l).option).toEqual(db(20));
    expect(resolveRx({ kind: 'db', lb: 15 }, l)).toMatchObject({ option: db(15), exact: true });
  });

  it('alternativa ligera: usa la botella más pesada; sin botellas cae a peso corporal o avisa', () => {
    const lat = ladderFor(EXERCISES['lateral-raise'], DEFAULT_INVENTORY);
    expect(resolveRx({ kind: 'light' }, lat).option).toMatchObject({ kind: 'light', lb: 3.3 });
    const onlyDb = DEFAULT_INVENTORY.filter((i) => i.kind === 'fixed');
    const r = resolveRx({ kind: 'light' }, ladderFor(EXERCISES['lateral-raise'], onlyDb));
    expect(r.exact).toBe(false);
    expect(r.note).toMatch(/botellas/);
  });

  it('pasos arriba/abajo y saltos grandes', () => {
    const l = ladderFor(EXERCISES['romanian-deadlift'], DEFAULT_INVENTORY);
    expect(stepUp(l, db(10))).toEqual(db(15));
    expect(stepUp(l, db(20))).toBeUndefined();
    expect(stepDown(l, db(10))).toBeUndefined();
    expect(isBigJump(db(10), db(15))).toBe(true);
    expect(isBigJump({ kind: 'light', lb: 3.3 }, db(10))).toBe(true);
    expect(isBigJump({ kind: 'light', lb: 2.2 }, { kind: 'light', lb: 3.3 })).toBe(false);
  });

  it('distingue peso por mano y total', () => {
    expect(formatOption(db(10), 'each', 'lb')).toBe('10 lb por mano · 20 lb total');
    expect(formatOption(db(15), 'held', 'lb')).toBe('15 lb total · 1 mancuerna con ambas manos');
    expect(formatOption(db(10), 'one', 'lb')).toBe('10 lb en una mano (1 mancuerna)');
    expect(formatOption({ kind: 'body', lb: 0 }, 'each', 'lb')).toBe('Peso corporal');
    expect(formatOption({ kind: 'light', lb: 2.2, label: 'Botella 1 L' }, 'each', 'lb')).toMatch(/Botella 1 L .*en cada mano/);
    expect(totalLb(db(10), 'each')).toBe(20);
    expect(totalLb(db(15), 'held')).toBe(15);
  });

  it('normaliza inventarios de la versión anterior', () => {
    expect(normalizeInventory([{ id: 'x', value: 5, unit: 'lb', count: 2 }])[0].kind).toBe('fixed');
  });
});
