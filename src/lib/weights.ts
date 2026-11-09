/**
 * Inventario de mancuernas, unidades y selección de cargas disponibles.
 * Internamente todas las cargas se comparan en libras.
 */
import type { LoadType } from '../data/plan';

export type Unit = 'lb' | 'kg';

export interface InventoryItem {
  id: string;
  value: number;
  unit: Unit;
  /** Número de mancuernas de ese peso que tienes. */
  count: number;
}

export const LB_PER_KG = 2.20462;
const EPS = 0.01;

export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const kgToLb = (kg: number) => kg * LB_PER_KG;

export function itemLb(item: Pick<InventoryItem, 'value' | 'unit'>): number {
  return item.unit === 'lb' ? item.value : kgToLb(item.value);
}

/** Convierte lb a la unidad de visualización con redondeo amable. */
export function displayValue(lb: number, unit: Unit): number {
  if (unit === 'lb') return Math.round(lb * 10) / 10;
  return Math.round(lbToKg(lb) * 2) / 2; // 0.5 kg
}

export function formatWeight(lb: number, unit: Unit): string {
  const v = displayValue(lb, unit);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}

/** Texto completo de la carga: por mano, total o peso corporal. */
export function formatLoad(lb: number, loadType: LoadType, unit: Unit): string {
  if (loadType === 'body' || lb <= 0) return 'Peso corporal';
  const w = formatWeight(lb, unit);
  return loadType === 'each' ? `${w} por mano` : `${w} total (una mancuerna)`;
}

/**
 * Cargas (lb) que realmente puedes usar con tu inventario.
 * - single: basta con 1 mancuerna de ese peso.
 * - each: necesitas un par (2), salvo ejercicios unilaterales que se hacen con una.
 */
export function availableLoadsLb(inventory: InventoryItem[], loadType: LoadType, unilateral = false): number[] {
  if (loadType === 'body') return [];
  const needed = loadType === 'each' && !unilateral ? 2 : 1;
  const set = new Map<string, number>();
  for (const it of inventory) {
    if (it.count >= needed && it.value > 0) {
      const lb = itemLb(it);
      set.set(lb.toFixed(2), lb);
    }
  }
  return [...set.values()].sort((a, b) => a - b);
}

export interface SnapResult {
  loadLb: number;
  exact: boolean;
  /** Mensaje para la persona cuando no hay coincidencia exacta. */
  note?: string;
}

/**
 * Elige la carga que posees más cercana SIN pasarse de la propuesta.
 * Si no tienes un peso igual o menor, usa el más ligero disponible y lo indica.
 */
export function snapToInventory(targetLb: number, available: number[], unit: Unit = 'lb'): SnapResult {
  if (targetLb <= 0) return { loadLb: 0, exact: true };
  if (available.length === 0)
    return { loadLb: 0, exact: false, note: 'No hay mancuernas adecuadas en tu inventario: hazlo sin peso o edita el inventario.' };
  const exact = available.find((w) => Math.abs(w - targetLb) < 0.3);
  if (exact !== undefined) return { loadLb: exact, exact: true };
  const below = available.filter((w) => w < targetLb);
  if (below.length) {
    const w = below[below.length - 1];
    return {
      loadLb: w,
      exact: false,
      note: `No tienes ${formatWeight(targetLb, unit)}: usa ${formatWeight(w, unit)} y prioriza llegar al tope de repeticiones antes de subir.`,
    };
  }
  const w = available[0];
  return {
    loadLb: w,
    exact: false,
    note: `Tu mancuerna más ligera (${formatWeight(w, unit)}) supera la propuesta (${formatWeight(targetLb, unit)}): haz menos repeticiones o una variante sin peso si cuesta demasiado.`,
  };
}

export function nextUp(currentLb: number, available: number[]): number | undefined {
  return available.find((w) => w > currentLb + EPS);
}

export function nextDown(currentLb: number, available: number[]): number | undefined {
  const lower = available.filter((w) => w < currentLb - EPS);
  return lower.length ? lower[lower.length - 1] : undefined;
}

/** Un salto se considera grande si supera 5 lb y además el 25 %. */
export function isBigJump(fromLb: number, toLb: number): boolean {
  const delta = toLb - fromLb;
  return delta > 5 + EPS && delta > fromLb * 0.25;
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'inv-3', value: 3, unit: 'lb', count: 2 },
  { id: 'inv-5', value: 5, unit: 'lb', count: 2 },
  { id: 'inv-8', value: 8, unit: 'lb', count: 2 },
  { id: 'inv-10', value: 10, unit: 'lb', count: 2 },
  { id: 'inv-12', value: 12, unit: 'lb', count: 2 },
  { id: 'inv-15', value: 15, unit: 'lb', count: 1 },
  { id: 'inv-20', value: 20, unit: 'lb', count: 1 },
];
