import { useState } from 'react';
import { DAY_LABELS, findPlanExercise } from '../data/plan';
import { useSessions, useSettings } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { db } from '../lib/db';
import { formatLong } from '../lib/dates';
import { DIFFICULTY_LABELS, rirLabel } from '../lib/progression';
import { exerciseName } from '../lib/session';
import { modeOf, sessionVolume } from '../lib/stats';
import { setOption } from '../lib/types';
import { formatOption } from '../lib/weights';
import { Button, Card, Loading, Modal, Notice, PageHeader, useToast } from './ui';

const STATUS = { completed: 'Completada', in_progress: 'En curso', abandoned: 'Incompleta' } as const;

export function HistoryView() {
  const sessions = useSessions();
  const settings = useSettings();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<string | null>(null);
  if (!sessions || !settings) return <Loading />;
  const list = [...sessions].sort((a, b) => (b.date + b.startedAt).localeCompare(a.date + a.startedAt));
  return (
    <div>
      <button type="button" onClick={() => history.back()} className="mb-2 min-h-11 font-semibold text-sage-strong">← Volver</button>
      <PageHeader title="Historial" subtitle={`${list.filter((s) => s.status === 'completed').length} sesiones completadas`} />
      <Notice>Tus datos se guardan solo en este dispositivo. Haz una copia en Ajustes → Datos de vez en cuando.</Notice>
      {list.length === 0 ? <p className="mt-6 text-center text-muted">Aún no hay sesiones. ¡La primera es la más importante!</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {list.map((s) => {
          const minutes = s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) : null;
          return (
            <li key={s.id}>
              <Card as="article">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {DAY_LABELS[s.dayKey]} · Semana {s.week}
                        </p>
                        <p className="text-sm text-muted">{formatLong(s.date)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${s.status === 'completed' ? 'bg-sage-soft text-sage-strong' : 'bg-warn-soft text-warn'}`}>{STATUS[s.status]}</span>
                    </div>
                    <p className="tabular mt-1 text-sm text-muted">
                      {s.exercises.reduce((a, e) => a + e.sets.length, 0)} series · volumen {sessionVolume(s)} lb{minutes !== null ? ` · ${minutes} min` : ''} · <span className="text-sage-strong">ver detalle</span>
                    </p>
                  </summary>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {s.exercises.map((e) => {
                      const plan = findPlanExercise(e.exerciseId);
                      const lt = modeOf(e);
                      return (
                        <li key={e.exerciseId} className="rounded-2xl bg-surface-2 p-2">
                          <p className="font-medium">
                            {exerciseName(e)} {e.substitute ? <span className="text-xs text-muted">(sustitución)</span> : null}
                            {e.status === 'skipped' ? <span className="text-xs text-muted"> · omitido</span> : null}
                          </p>
                          {e.sets.map((st) => (
                            <p key={st.setNumber} className="tabular text-muted">
                              S{st.setNumber}: {st.reps} {plan?.timed && !e.substitute ? 's' : 'reps'} · {formatOption(setOption(st), st.mode ?? lt, settings.unit)}
                              {st.rir !== undefined && st.rir !== null ? ` · RIR ${rirLabel(st.rir)}` : ''}
                              {st.tempo === 'lento' ? ' · tempo lento' : ''}
                              {st.difficulty ? ` · ${DIFFICULTY_LABELS[st.difficulty]}` : ''}
                              {st.pain ? ' · ⚠ dolor' : ''}
                              {!st.techniqueOk ? ' · técnica a revisar' : ''}
                            </p>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                  {s.notes ? <p className="mt-2 text-sm italic">“{s.notes}”</p> : null}
                  <div className="mt-3 flex gap-2">
                    {s.status === 'in_progress' ? <Button size="sm" onClick={() => navigate(`/coach/${s.id}`)}>Reanudar</Button> : null}
                    <Button size="sm" variant="danger" onClick={() => setToDelete(s.id)}>Eliminar</Button>
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
      </ul>
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="¿Eliminar sesión?"
        footer={
          <div className="grid gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                if (toDelete) await db.sessions.delete(toDelete);
                setToDelete(null);
                toast('Sesión eliminada', 'info');
              }}
            >
              Eliminar definitivamente
            </Button>
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
          </div>
        }
      >
        <p>Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}
