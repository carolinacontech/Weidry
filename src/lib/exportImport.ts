/** Exportación/importación JSON (copia completa) y CSV (series, medidas, cardio). */
import { getExercise } from '../data/plan';
import { modeOf } from './stats';
import { setOption, type CardioLog, type LoadAdjustment, type Measurement, type WorkoutSession } from './types';
import { totalLb } from './weights';

export interface BackupData {
  kv: { key: string; value: unknown }[];
  sessions: WorkoutSession[];
  measurements: Measurement[];
  cardio: CardioLog[];
  adjustments: LoadAdjustment[];
}

export interface Backup {
  app: 'mi-entrenamiento';
  version: 1;
  exportedAt: string;
  data: BackupData;
}

export function makeBackup(data: BackupData, now = new Date()): Backup {
  return { app: 'mi-entrenamiento', version: 1, exportedAt: now.toISOString(), data };
}

export function parseBackup(text: string): Backup {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const b = obj as Partial<Backup>;
  if (!b || b.app !== 'mi-entrenamiento' || b.version !== 1 || !b.data) {
    throw new Error('El archivo no parece una copia de Weidry.');
  }
  const d = b.data;
  for (const k of ['kv', 'sessions', 'measurements', 'cardio', 'adjustments'] as const) {
    if (!Array.isArray(d[k])) throw new Error(`Copia incompleta: falta "${k}".`);
  }
  return b as Backup;
}

// ---------- CSV ----------

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

/** Parser CSV con soporte de comillas, comas y saltos de línea dentro de campos. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const KIND_ES = { body: 'peso_corporal', light: 'alternativa_ligera', db: 'mancuerna_fija' } as const;
const MODE_ES = { held: 'una_mancuerna_ambas_manos', each: 'por_mano', one: 'una_mano', body: 'peso_corporal' } as const;

export function setsToCSV(sessions: WorkoutSession[]): string {
  const rows: unknown[][] = [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const plan = getExercise(ex.exerciseId);
      for (const set of ex.sets) {
        const opt = setOption(set);
        const mode = set.mode ?? modeOf(ex);
        rows.push([
          s.date,
          s.week,
          s.dayKey,
          ex.exerciseId,
          ex.substitute?.name ?? plan?.nameEs ?? ex.exerciseId,
          set.setNumber,
          set.reps,
          KIND_ES[opt.kind],
          MODE_ES[mode],
          opt.label ?? '',
          Math.round(opt.lb * 10) / 10,
          Math.round(totalLb(opt, mode) * 10) / 10,
          set.rir === undefined || set.rir === null ? '' : set.rir >= 4 ? '4+' : set.rir,
          set.tempo ?? '',
          set.pain ? 'si' : 'no',
          set.techniqueOk ? 'si' : 'no',
        ]);
      }
    }
  }
  return toCSV(
    ['fecha', 'semana', 'dia', 'ejercicio_id', 'ejercicio', 'serie', 'reps_o_segundos', 'tipo_carga', 'sujecion', 'objeto', 'carga_por_unidad_lb', 'carga_total_lb', 'rir', 'tempo', 'dolor', 'tecnica_ok'],
    rows,
  );
}

export const MEASUREMENT_HEADERS = ['fecha', 'peso_lb', 'cintura_cm', 'cadera_cm', 'brazo_cm', 'muslo_cm', 'notas'];
export const CARDIO_HEADERS = ['fecha', 'minutos', 'actividad', 'notas'];

export function measurementsToCSV(list: Measurement[]): string {
  return toCSV(
    MEASUREMENT_HEADERS,
    list.map((m) => [m.date, m.weightLb, m.waistCm, m.hipCm, m.armCm, m.thighCm, m.notes]),
  );
}

export function cardioToCSV(list: CardioLog[]): string {
  return toCSV(
    CARDIO_HEADERS,
    list.map((c) => [c.date, c.minutes, c.activity, c.notes]),
  );
}

const num = (s: string | undefined): number | undefined => {
  if (s === undefined || s.trim() === '') return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

function indexer(header: string[]) {
  const h = header.map((x) => x.trim().toLowerCase());
  return (name: string, row: string[]) => {
    const i = h.indexOf(name);
    return i >= 0 ? row[i] : undefined;
  };
}

export function measurementsFromCSV(text: string): Measurement[] {
  const [header, ...rows] = parseCSV(text);
  if (!header) return [];
  const get = indexer(header);
  if (!header.map((x) => x.trim().toLowerCase()).includes('fecha')) throw new Error('El CSV de medidas necesita la columna "fecha".');
  return rows
    .filter((r) => isDate(get('fecha', r) ?? ''))
    .map((r) => ({
      date: get('fecha', r)!.trim(),
      weightLb: num(get('peso_lb', r)),
      waistCm: num(get('cintura_cm', r)),
      hipCm: num(get('cadera_cm', r)),
      armCm: num(get('brazo_cm', r)),
      thighCm: num(get('muslo_cm', r)),
      notes: get('notas', r) || undefined,
    }));
}

export function cardioFromCSV(text: string): CardioLog[] {
  const [header, ...rows] = parseCSV(text);
  if (!header) return [];
  const get = indexer(header);
  const h = header.map((x) => x.trim().toLowerCase());
  if (!h.includes('fecha') || !h.includes('minutos')) throw new Error('El CSV de cardio necesita las columnas "fecha" y "minutos".');
  return rows
    .filter((r) => isDate(get('fecha', r) ?? '') && (num(get('minutos', r)) ?? 0) > 0)
    .map((r) => ({
      date: get('fecha', r)!.trim(),
      minutes: num(get('minutos', r))!,
      activity: get('actividad', r)?.trim() || 'Cardio',
      notes: get('notas', r) || undefined,
    }));
}

/** Detecta qué tipo de CSV es por su cabecera. */
export function detectCSVKind(text: string): 'measurements' | 'cardio' | 'sets' | 'unknown' {
  const first = parseCSV(text)[0]?.map((x) => x.trim().toLowerCase()) ?? [];
  if (first.includes('minutos')) return 'cardio';
  if (first.includes('serie')) return 'sets';
  if (first.some((h) => ['peso_lb', 'cintura_cm', 'cadera_cm', 'brazo_cm', 'muslo_cm'].includes(h))) return 'measurements';
  return 'unknown';
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
