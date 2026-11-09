import { useState, type ReactNode } from 'react';
import { DAY_LABELS } from '../data/plan';
import { useLiveQuery } from 'dexie-react-hooks';
import { navigate } from '../hooks/useRoute';
import { db, getActiveSession, getInventory, getSettings, saveSession } from '../lib/db';
import { unlockAudio } from '../lib/platform';
import { createSession } from '../lib/session';
import { Modal, useToast } from './ui';

export function useActiveSession() {
  return useLiveQuery(async () => (await getActiveSession()) ?? null);
}

export async function discardSession(id: string) {
  const s = await db.sessions.get(id);
  if (!s) return;
  // Si tenía series registradas, se conserva como "abandonada" en el historial; si no, se borra.
  if (s.exercises.some((e) => e.sets.length > 0)) await db.sessions.put({ ...s, status: 'abandoned', endedAt: new Date().toISOString() });
  else await db.sessions.delete(id);
}

/** Crea y guarda una sesión nueva para un día del plan. */
export async function startSession(p: { date: string; week: number; dayKey: 'A' | 'B' | 'C' | 'D'; skipWarmup?: boolean }) {
  const [settings, inventory, adjustments, sessions] = await Promise.all([getSettings(), getInventory(), db.adjustments.toArray(), db.sessions.toArray()]);
  const s = createSession({ ...p, inventory, adjustments, sessions, unit: settings.unit });
  await saveSession(s);
  return s;
}

export function StartWorkoutButton({
  date,
  week,
  dayKey,
  label = 'Comenzar',
  className = 'btn btn-primary',
  icon,
}: {
  date: string;
  week: number;
  dayKey: 'A' | 'B' | 'C' | 'D';
  label?: string;
  className?: string;
  icon?: ReactNode;
}) {
  const toast = useToast();
  const active = useActiveSession();
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      await startSession({ date, week, dayKey });
      navigate('/entrenamiento');
    } catch (e) {
      console.error(e);
      toast('No se pudo crear la sesión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onClick = () => {
    unlockAudio(); // iOS: habilita audio y voz con este toque
    if (active) setConflict(true);
    else void create();
  };

  return (
    <>
      <button type="button" className={className} onClick={onClick} disabled={loading} aria-busy={loading || undefined}>
        {label} {icon ?? <span aria-hidden>→</span>}
      </button>
      <Modal
        open={conflict}
        onClose={() => setConflict(false)}
        title="Tienes una sesión sin terminar"
        footer={
          <div className="grid gap-2">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/entrenamiento')}>
              Reanudar {active ? DAY_LABELS[active.dayKey] : ''}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (active) await discardSession(active.id);
                setConflict(false);
                void create();
              }}
            >
              Cerrarla y empezar {DAY_LABELS[dayKey]}
            </button>
          </div>
        }
      >
        <p>Puedes reanudarla donde la dejaste o cerrarla. Las series ya registradas se conservan en el historial.</p>
      </Modal>
    </>
  );
}
