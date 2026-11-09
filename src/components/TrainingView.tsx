import { useState } from 'react';
import { Img, PHOTOS } from '../data/photos';
import { PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, type StrengthDay } from '../data/plan';
import { useAdjustments, useInventory, useSessions, useSettings } from '../hooks/useData';
import { today } from '../lib/dates';
import { isRecoveryWeek, isStrengthDay, programDayFor, setsForWeek } from '../lib/program';
import { DayPlanList } from './DayPlanList';
import { IconPlay } from './icons';
import { StartWorkoutButton } from './StartWorkout';
import { Card, Loading, Notice, PageHeader } from './ui';

/** Pantalla "Entrenamiento": entreno de hoy y cualquier otro día del plan. */
export function TrainingView() {
  const settings = useSettings();
  const sessions = useSessions();
  const inventory = useInventory();
  const adjustments = useAdjustments();
  const t = today();
  const pd = programDayFor(t);
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const [selected, setSelected] = useState<StrengthDay>(isStrengthDay(pd.dayKey) ? pd.dayKey : 'A');
  if (!settings || !sessions || !inventory || !adjustments) return <Loading />;
  const done = new Set(sessions.filter((s) => s.status === 'completed' && s.week === week).map((s) => s.dayKey));
  const day = PLAN_DAYS[selected];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Entrenamiento" subtitle={`Semana ${week} de ${PROGRAM_WEEKS} · ${setsForWeek(week)} series por ejercicio${isRecoveryWeek(week) ? ' · recuperación' : ''}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Elegir día">
        {(['A', 'B', 'C', 'D'] as const).map((k) => {
          const on = selected === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(k)}
              className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition ${on ? 'border-primary bg-primary-soft shadow-card' : 'border-line bg-surface hover:bg-surface-2'}`}
            >
              <div className="aspect-[16/10] overflow-hidden rounded-xl bg-primary-soft">
                <Img photo={PHOTOS[k]} className="h-full w-full" decorative />
              </div>
              <span className="text-xs font-semibold text-primary">
                {PLAN_DAYS[k].weekday}
                {pd.dayKey === k && pd.status === 'active' ? ' · hoy' : ''}
                {done.has(k) ? ' · ✓ hecho' : ''}
              </span>
              <span className="font-display font-semibold leading-tight">{PLAN_DAYS[k].title}</span>
            </button>
          );
        })}
      </div>

      <Card aria-labelledby="tv-title">
        <div className="mb-3 flex flex-col gap-1">
          <h2 id="tv-title" className="font-display text-xl font-bold">{day.title}</h2>
          <p className="text-sm text-muted">{day.focus} · ~{35 + setsForWeek(week) * 5} min · calentamiento de 5 min incluido</p>
        </div>
        {isRecoveryWeek(week) ? <Notice>Semana de recuperación: menos series y cargas más ligeras.</Notice> : null}
        <DayPlanList dayKey={selected} week={week} inventory={inventory} adjustments={adjustments} sessions={sessions} unit={settings.unit} />
        <p className="my-3 text-xs text-muted">Todas las cargas son propuestas condicionadas a tu técnica y a terminar con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva.</p>
        <div className="sm:max-w-xs">
          <StartWorkoutButton date={t} week={week} dayKey={selected} label={done.has(selected) ? 'Repetir entrenamiento' : 'Comenzar'} size="lg" icon={<IconPlay size={18} />} />
        </div>
      </Card>
    </div>
  );
}
