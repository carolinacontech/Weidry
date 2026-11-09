/**
 * Inventario real, unidades y "escalera" de cargas disponibles por ejercicio.
 *
 * Regla de oro: la app NUNCA propone una mancuerna fija que no esté en el inventario.
 * Las opciones posibles son: peso corporal, alternativas ligeras (botellas de agua)
 * y las mancuernas fijas registradas (con la cantidad necesaria según el modo).
 */
import type { Exercise, Mode, Rx } from '../data/plan';

export type Unit = 'lb' | 'kg';
export type ItemKind = 'fixed' | 'light';

export interface InventoryItem {
  id: string;
  /** fixed = mancuerna fija; light = alternativa doméstica ligera (botella de agua…). */
  kind: ItemKind;
  /** Nombre para alternativas ligeras ("Botella de agua 1 L"). */
  label?: string;
  /** Peso de UNA unidad. */
  value: number;
  unit: Unit;
  /** Cuántas unidades tienes. */
  count: number;
}

export type LoadKind = 'body' | 'light' | 'db';

/** Una opción concreta de carga: lb = peso de UNA mancuerna / objeto (0 en peso corporal). */
export interface LoadOption {
  kind: LoadKind;
  lb: number;
  label?: string;
}

export const LB_PER_KG = 2.20462;
const EPS = 0.05;

export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const kgToLb = (kg: number) => kg * LB_PER_KG;

export function itemLb(item: Pick<InventoryItem, 'value' | 'unit'>): number {
  return item.unit === 'lb' ? item.value : kgToLb(item.value);
}

export function displayValue(lb: number, unit: Unit): number {
  if (unit === 'lb') return Math.round(lb * 10) / 10;
  return Math.round(lbToKg(lb) * 2) / 2;
}

export function formatWeight(lb: number, unit: Unit): string {
  const v = displayValue(lb, unit);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}

/** Unidades necesarias de un mismo peso según cómo se sujeta. */
export function unitsNeeded(mode: Mode): number {
  return mode === 'each' ? 2 : 1;
}

/** Carga total movida (lb). */
export function totalLb(opt: LoadOption, mode: Mode): number {
  if (opt.kind === 'body') return 0;
  return mode === 'each' ? opt.lb * 2 : opt.lb;
}

/** Texto claro que distingue peso POR MANO y peso TOTAL. */
export function formatOption(opt: LoadOption, mode: Mode, unit: Unit): string {
  if (opt.kind === 'body' || mode === 'body') return 'Peso corporal';
  const w = formatWeight(opt.lb, unit);
  if (opt.kind === 'light') {
    const name = opt.label ?? 'Alternativa ligera';
    if (mode === 'each') return `${name} (≈ ${w}) en cada mano · ≈ ${formatWeight(opt.lb * 2, unit)} total`;
    if (mode === 'one') return `${name} (≈ ${w}) en una mano`;
    return `${name} (≈ ${w}) total, con ambas manos`;
  }
  if (mode === 'each') return `${w} por mano · ${formatWeight(opt.lb * 2, unit)} total`;
  if (mode === 'one') return `${w} en una mano (1 mancuerna)`;
  return `${w} total · 1 mancuerna con ambas manos`;
}

/** Versión corta para listas. */
export function formatOptionShort(opt: LoadOption, mode: Mode, unit: Unit): string {
  if (opt.kind === 'body' || mode === 'body') return 'Peso corporal';
  const w = formatWeight(opt.lb, unit);
  if (opt.kind === 'light') return `${opt.label ?? 'Ligera'}${mode === 'each' ? ' ×2' : ''}`;
  if (mode === 'each') return `${w} c/mano`;
  if (mode === 'one') return `${w} una mano`;
  return `${w} total`;
}

export function sameOption(a: LoadOption | undefined, b: LoadOption | undefined): boolean {
  if (!a || !b) return false;
  return a.kind === b.kind && Math.abs(a.lb - b.lb) < EPS;
}

/**
 * Escalera ordenada de opciones disponibles para un ejercicio con el inventario dado:
 * peso corporal → alternativas ligeras → mancuernas fijas.
 */
export function ladderFor(ex: Pick<Exercise, 'mode' | 'allowBody' | 'allowLight'>, inventory: InventoryItem[]): LoadOption[] {
  if (ex.mode === 'body') return [{ kind: 'body', lb: 0 }];
  const need = unitsNeeded(ex.mode);
  const out: LoadOption[] = [];
  if (ex.allowBody) out.push({ kind: 'body', lb: 0 });
  const add = (kind: 'light' | 'db') => {
    const seen = new Map<string, LoadOption>();
    for (const it of inventory) {
      if ((kind === 'db') !== (it.kind === 'fixed')) continue;
      if (it.count < need || it.value <= 0) continue;
      const lb = itemLb(it);
      const key = lb.toFixed(1);
      if (!seen.has(key)) seen.set(key, { kind, lb, label: kind === 'light' ? it.label : undefined });
    }
    out.push(...[...seen.values()].sort((a, b) => a.lb - b.lb));
  };
  if (ex.allowLight) add('light');
  add('db');
  return out;
}

export function optionIndex(ladder: LoadOption[], opt: LoadOption | undefined): number {
  return ladder.findIndex((o) => sameOption(o, opt));
}

/** Posición comparable de una opción aunque no esté en la escalera (p. ej. inventario cambiado). */
function rank(opt: LoadOption): number {
  if (opt.kind === 'body') return 0;
  if (opt.kind === 'light') return 1 + opt.lb / 1000;
  return 2 + opt.lb / 1000;
}

export function compareOptions(a: LoadOption, b: LoadOption): number {
  return rank(a) - rank(b);
}

export function stepUp(ladder: LoadOption[], opt: LoadOption): LoadOption | undefined {
  return ladder.find((o) => compareOptions(o, opt) > 1e-9);
}

export function stepDown(ladder: LoadOption[], opt: LoadOption): LoadOption | undefined {
  const lower = ladder.filter((o) => compareOptions(o, opt) < -1e-9);
  return lower[lower.length - 1];
}

/** La opción de la escalera más cercana a `opt` sin pasarse (o la más baja). */
export function nearestAtOrBelow(ladder: LoadOption[], opt: LoadOption): LoadOption | undefined {
  const at = ladder.filter((o) => compareOptions(o, opt) <= 1e-9);
  return at[at.length - 1] ?? ladder[0];
}

/** Salto grande: de alternativa ligera/peso corporal a mancuerna, o ≥ 25 % entre mancuernas. */
export function isBigJump(from: LoadOption, to: LoadOption): boolean {
  if (to.kind !== 'db') return false;
  if (from.kind !== 'db') return true;
  return (to.lb - from.lb) / from.lb >= 0.25;
}

export interface ResolvedRx {
  option: LoadOption;
  exact: boolean;
  note?: string;
}

/** Convierte la prescripción del plan en una opción que REALMENTE tienes. */
export function resolveRx(r: Rx, ladder: LoadOption[], unit: Unit = 'lb'): ResolvedRx {
  const body: LoadOption = { kind: 'body', lb: 0 };
  if (ladder.length === 0) return { option: body, exact: false, note: 'No hay cargas disponibles en tu inventario para este ejercicio: hazlo sin peso o edita el inventario.' };
  if (r.kind === 'body') {
    const b = ladder.find((o) => o.kind === 'body');
    return b ? { option: b, exact: true } : { option: ladder[0], exact: false };
  }
  if (r.kind === 'light') {
    const lights = ladder.filter((o) => o.kind === 'light');
    if (lights.length) return { option: lights[lights.length - 1], exact: true };
    const b = ladder.find((o) => o.kind === 'body');
    if (b) return { option: b, exact: false, note: 'No tienes alternativas ligeras registradas: hazlo sin peso o añade botellas de agua en Ajustes.' };
    return {
      option: ladder[0],
      exact: false,
      note: `No tienes alternativas ligeras registradas. La opción más ligera es ${formatWeight(ladder[0].lb, unit)}: haz menos repeticiones o añade botellas en Ajustes.`,
    };
  }
  const exact = ladder.find((o) => o.kind === 'db' && Math.abs(o.lb - r.lb) < EPS);
  if (exact) return { option: exact, exact: true };
  const target: LoadOption = { kind: 'db', lb: r.lb };
  const below = ladder.filter((o) => compareOptions(o, target) < 0);
  if (below.length) {
    const o = below[below.length - 1];
    return { option: o, exact: false, note: `No tienes una mancuerna de ${formatWeight(r.lb, unit)}: usa la opción inferior y progresa con repeticiones o tempo.` };
  }
  return { option: ladder[0], exact: false, note: 'La opción más ligera que tienes supera la propuesta: haz menos repeticiones o elige una alternativa.' };
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'db-10', kind: 'fixed', value: 10, unit: 'lb', count: 2 },
  { id: 'db-15', kind: 'fixed', value: 15, unit: 'lb', count: 2 },
  { id: 'db-20', kind: 'fixed', value: 20, unit: 'lb', count: 2 },
  { id: 'light-05', kind: 'light', label: 'Botella de agua 500 ml', value: 1.1, unit: 'lb', count: 2 },
  { id: 'light-1', kind: 'light', label: 'Botella de agua 1 L', value: 2.2, unit: 'lb', count: 2 },
  { id: 'light-15', kind: 'light', label: 'Botella de agua 1,5 L', value: 3.3, unit: 'lb', count: 2 },
];

/** Normaliza inventarios guardados por la versión anterior (sin `kind`). */
export function normalizeInventory(items: Partial<InventoryItem>[]): InventoryItem[] {
  return items
    .filter((i) => typeof i.value === 'number' && i.value > 0)
    .map((i, n) => ({
      id: i.id ?? `inv-${n}`,
      kind: i.kind ?? 'fixed',
      label: i.label,
      value: i.value!,
      unit: i.unit ?? 'lb',
      count: i.count ?? 1,
    }));
}
