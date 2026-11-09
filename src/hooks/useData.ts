import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_PROFILE } from '../data/plan';
import { db } from '../lib/db';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { DEFAULT_INVENTORY, normalizeInventory, type InventoryItem } from '../lib/weights';

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await db.kv.get('settings');
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  });
}

export function useProfile() {
  return useLiveQuery(async () => {
    const row = await db.kv.get('profile');
    return { ...DEFAULT_PROFILE, ...((row?.value as object) ?? {}) };
  });
}

export function useInventory(): InventoryItem[] | undefined {
  return useLiveQuery(async () => {
    const row = await db.kv.get('inventory');
    return normalizeInventory((row?.value as Partial<InventoryItem>[]) ?? DEFAULT_INVENTORY);
  });
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.toArray());
}

export function useCardio() {
  return useLiveQuery(() => db.cardio.orderBy('date').toArray());
}

export function useMeasurements() {
  return useLiveQuery(() => db.measurements.orderBy('date').toArray());
}

export function useAdjustments() {
  return useLiveQuery(() => db.adjustments.toArray());
}
