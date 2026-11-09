import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_PROFILE, type Profile } from '../data/plan';
import { DEFAULT_INVENTORY, normalizeInventory, type InventoryItem } from './weights';
import { DEFAULT_SETTINGS, type CardioLog, type LoadAdjustment, type Measurement, type Settings, type WorkoutSession } from './types';

export interface KV {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  kv!: EntityTable<KV, 'key'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  cardio!: EntityTable<CardioLog, 'id'>;
  adjustments!: EntityTable<LoadAdjustment, 'id'>;

  constructor(name = 'mi-entrenamiento') {
    super(name);
    this.version(1).stores({
      kv: 'key',
      sessions: 'id, date, status, dayKey, week',
      measurements: '++id, date',
      cardio: '++id, date',
      adjustments: '++id, exerciseId, createdAt',
    });
    // v2: equipamiento real (mancuernas fijas 10/15/20 lb + alternativas ligeras) y programa actualizado.
    // El historial (sesiones, medidas, cardio) se conserva intacto.
    this.version(2)
      .stores({
        kv: 'key',
        sessions: 'id, date, status, dayKey, week',
        measurements: '++id, date',
        cardio: '++id, date',
        adjustments: '++id, exerciseId, createdAt',
      })
      .upgrade(async (tx) => {
        // Los ajustes de la v1 eran diferencias en lb sobre el plan anterior: ya no aplican.
        await tx.table('adjustments').clear();
        // Inventario: se sustituye por el equipamiento real indicado.
        await tx.table('kv').put({ key: 'inventory', value: DEFAULT_INVENTORY });
        // Ajustes: la pregunta de dificultad pasa a ser RIR.
        const s = await tx.table('kv').get('settings');
        if (s?.value) {
          const { askDifficulty, ...rest } = s.value as Record<string, unknown>;
          await tx.table('kv').put({ key: 'settings', value: { ...rest, askRir: askDifficulty ?? true } });
        }
        // Prioridad: fuerza y glúteos; se ocultan por defecto las referencias numéricas de báscula/cintura.
        const p = await tx.table('kv').get('profile');
        if (p?.value) await tx.table('kv').put({ key: 'profile', value: { ...(p.value as object), showAestheticReference: false, showWeightGoal: false } });
      });
  }
}

export const db = new AppDB();

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
  await db.kv.put({ key, value });
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKV<Partial<Settings>>('settings', {})) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await setKV('settings', { ...current, ...patch });
}

export async function getProfile(): Promise<Profile> {
  return { ...DEFAULT_PROFILE, ...(await getKV<Partial<Profile>>('profile', {})) };
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  await setKV('profile', { ...(await getProfile()), ...patch });
}

export async function getInventory(): Promise<InventoryItem[]> {
  return normalizeInventory(await getKV<Partial<InventoryItem>[]>('inventory', DEFAULT_INVENTORY));
}

export async function setInventory(items: InventoryItem[]): Promise<void> {
  await setKV('inventory', items);
}

/** Guarda la sesión inmediatamente (cada cambio). */
export async function saveSession(s: WorkoutSession): Promise<void> {
  await db.sessions.put({ ...s, updatedAt: new Date().toISOString() });
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  const list = await db.sessions.where('status').equals('in_progress').toArray();
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Pide al navegador almacenamiento persistente (reduce el riesgo de que Safari borre datos). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* sin soporte */
  }
  return false;
}
