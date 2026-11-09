import { useState } from 'react';
import { DAY_LABELS, PLAN_DAYS, PROGRAM_WEEKS } from '../data/plan';
import { useAdjustments, useCardio, useInventory, useSessions, useSettings } from '../hooks/useData';
import { formatLong, formatShort, today } from '../lib/dates';
import { cardioTargetForWeek, isRecoveryWeek, isStrengthDay, programDayFor, setsForWeek, weekDates, type ProgramDay } from '../lib/program';
import { DayPlanList } from './DayPlanList';
import { LoadTable } from './LoadTable';
import { CardioLogger } from './CardioLogger';
import { StartWorkoutButton } from './StartWorkout';
import { Loading, Modal, Notice, PageHeader } from './ui';

const SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function CalendarView() {
  const sessions = useSessions();
  const cardio = useCardio();
  const settings = useSettings();
  const inventory = useInventory();
  const adjustments = useAdjustments();
  const [selected, setSelected] = useState<ProgramDay | null>(null);
  const [view, setView] = useState<'cal' | 'table'>('cal');

  if (!sessions || !cardio || !settings || !inventory || !adjustments) return <Loading />;
  const t = today();
  const currentWeek = programDayFor(t).week;

  return (
    <div>
      <PageHeader title="Plan de 13 semanas" subtitle="Toca un día para ver el detalle o entrenar" />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Vista del plan">
        <button type="button" role="tab" aria-selected={view === 'cal'} onClick={() => setView('cal')} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === 'cal' ? 'bg-ink text-bg' : 'bg-surface-2'}`}>Calendario</button>
        <button type="button" role="tab" aria-selected={view === 'table'} onClick={() => setView('table')} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === 'table' ? 'bg-ink text-bg' : 'bg-surface-2'}`}>Tabla de cargas</button>
      </div>
      {view === 'table' ? <LoadTable /> : null}
      <div hidden={view !== 'cal'}>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted" aria-label="Leyenda">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded-full bg-sage" /> Hecho</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded-full border-2 border-dashed border-clay" /> Pendiente pasado</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded-full border border-line bg-surface" /> Próximo</span>
        <span className="inline-flex items-center gap-1">♥ Cardio · – Descanso</span>
      </div>
      <ol className="flex flex-col gap-3">
        {Array.from({ length: PROGRAM_WEEKS }, (_, w) => {
          const week = w + 1;
          const dates = weekDates(week);
          const done = new Set(sessions.filter((s) => s.status === 'completed' && s.week === week).map((s) => s.dayKey));
          const cardioMin = cardio.filter((c) => dates.includes(c.date)).reduce((a, c) => a + c.minutes, 0);
          const isCurrent = currentWeek === week;
          return (
            <li key={week} className={`rounded-3xl border bg-surface p-3 ${isCurrent ? 'border-sage shadow-sm' : 'border-line'}`} aria-current={isCurrent ? 'true' : undefined}>
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h2 className="font-semibold">
                  Semana {week}
                  {isRecoveryWeek(week) ? <span className="ml-2 rounded-full bg-clay-soft px-2 py-0.5 text-xs font-semibold text-clay">Recuperación</span> : null}
                  {isCurrent ? <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-xs font-semibold text-sage-strong">Actual</span> : null}
                </h2>
                <p className="tabular text-xs text-muted">
                  {setsForWeek(week)} series · {done.size}/4 · ♥ {cardioMin}/{cardioTargetForWeek(week)} min
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dates.map((date, i) => {
                  const pd = programDayFor(date);
                  const k = pd.dayKey;
                  const isDone = isStrengthDay(k) ? done.has(k) : k === 'cardio' ? cardio.some((c) => c.date === date) : false;
                  const missed = !isDone && date < t && (isStrengthDay(k) || k === 'cardio');
                  const isToday = date === t;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelected(pd)}
                      className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs transition ${
                        isDone ? 'bg-sage text-on-sage' : missed ? 'border-2 border-dashed border-clay text-ink' : k === 'rest' ? 'bg-surface-2 text-muted' : 'border border-line bg-surface'
                      } ${isToday ? 'ring-2 ring-sage-strong ring-offset-2 ring-offset-surface' : ''}`}
                      aria-label={`${formatLong(date)}: ${DAY_LABELS[k]}${isDone ? ', hecho' : missed ? ', pendiente' : ''}${isToday ? ', hoy' : ''}`}
                    >
                      <span className="opacity-80">{SHORT[i]} {formatShort(date).split(' ')[0]}</span>
                      <span className="text-base font-bold">{isDone ? '✓' : k === 'cardio' ? '♥' : k === 'rest' ? '–' : k}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${DAY_LABELS[selected.dayKey]} · ${formatLong(selected.date)}` : ''}>
        {selected && selected.week && isStrengthDay(selected.dayKey) ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">
              Semana {selected.week} · {PLAN_DAYS[selected.dayKey].focus}
            </p>
            {isRecoveryWeek(selected.week) ? <Notice>Semana de recuperación: menos series y cargas más ligeras.</Notice> : null}
            <DayPlanList dayKey={selected.dayKey} week={selected.week} inventory={inventory} adjustments={adjustments} sessions={sessions} unit={settings.unit} />
            <StartWorkoutButton date={selected.date > t ? t : selected.date} week={selected.week} dayKey={selected.dayKey} label="Hacer este entreno ahora" size="lg" />
            <p className="text-xs text-muted">Se registrará como el entreno {selected.dayKey} de la semana {selected.week}.</p>
          </div>
        ) : selected?.dayKey === 'cardio' ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">Meta de la semana {selected.week}: {selected.week ? cardioTargetForWeek(selected.week) : '—'} min. Caminar rápido, bici o elíptica a intensidad moderada.</p>
            <CardioLogger date={selected.date <= t ? selected.date : t} onSaved={() => setSelected(null)} />
          </div>
        ) : (
          <Notice>Día de descanso. Paseo suave o movilidad si te apetece.</Notice>
        )}
      </Modal>
    </div>
  );
}
