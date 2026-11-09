import { describe, expect, it } from 'vitest';
import { availableLoadsLb, formatLoad, isBigJump, nextDown, nextUp, snapToInventory, type InventoryItem } from '../src/lib/weights';

const inv: InventoryItem[] = [
  { id: 'a', value: 3, unit: 'lb', count: 2 },
  { id: 'b', value: 5, unit: 'lb', count: 2 },
  { id: 'c', value: 8, unit: 'lb', count: 1 },
  { id: 'd', value: 5, unit: 'kg', count: 2 },
];

describe('inventario y cargas', () => {
  it('para "por mano" exige un par salvo ejercicios unilaterales', () => {
    expect(availableLoadsLb(inv, 'each').map(Math.round)).toEqual([3, 5, 11]);
    expect(availableLoadsLb(inv, 'each', true).map(Math.round)).toEqual([3, 5, 8, 11]);
    expect(availableLoadsLb(inv, 'single').map(Math.round)).toEqual([3, 5, 8, 11]);
    expect(availableLoadsLb(inv, 'body')).toEqual([]);
  });

  it('nunca propone una carga mayor que la del plan si tiene una menor', () => {
    const avail = availableLoadsLb(inv, 'each');
    const r = snapToInventory(8, avail);
    expect(r.loadLb).toBe(5);
    expect(r.exact).toBe(false);
    expect(r.note).toMatch(/repeticiones/);
  });

  it('coincidencia exacta', () => {
    expect(snapToInventory(5, [3, 5, 8])).toEqual({ loadLb: 5, exact: true });
  });

  it('si solo hay pesos mayores, usa el más ligero y lo advierte', () => {
    const r = snapToInventory(2, [3, 5]);
    expect(r.loadLb).toBe(3);
    expect(r.note).toBeDefined();
  });

  it('peso corporal', () => {
    expect(snapToInventory(0, [3])).toEqual({ loadLb: 0, exact: true });
  });

  it('siguiente peso arriba/abajo', () => {
    expect(nextUp(5, [3, 5, 8])).toBe(8);
    expect(nextUp(8, [3, 5, 8])).toBeUndefined();
    expect(nextDown(5, [3, 5, 8])).toBe(3);
    expect(nextDown(3, [3, 5, 8])).toBeUndefined();
  });

  it('detecta saltos grandes', () => {
    expect(isBigJump(8, 10)).toBe(false);
    expect(isBigJump(12, 25)).toBe(true);
    expect(isBigJump(3, 5)).toBe(false);
  });

  it('formatea por mano, total y kg', () => {
    expect(formatLoad(8, 'each', 'lb')).toBe('8 lb por mano');
    expect(formatLoad(10, 'single', 'lb')).toBe('10 lb total (una mancuerna)');
    expect(formatLoad(0, 'each', 'lb')).toBe('Peso corporal');
    expect(formatLoad(11.0231, 'each', 'kg')).toBe('5 kg por mano');
  });
});
