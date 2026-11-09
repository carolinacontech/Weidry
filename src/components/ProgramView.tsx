import { useState } from 'react';
import { PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, WEEK_FOCUS, getExercise } from '../data/plan';
import { useAdjustments, useInventory, useSessions, useSettings } from '../hooks/useData';
import { today } from '../lib/dates';
import { isRecoveryWeek, plannedRx, programDayFor, setsFor, setsForWeek } from '../lib/program';
import { proposedOption } from '../lib/session';
import { itemLb, ladderFor, resolveRx, formatOptionShort } from '../lib/weights';
import { WeeksCalendar } from './CalendarView';
import { LoadTable } from './LoadTable';
import { ProgressionRules } from './ProgramSections';
import { StartWorkoutButton } from './StartWorkout';
import { Loading } from './ui';

/** "Mi programa": diseño del prototipo + calendario y tabla de cargas completos. */
export function ProgramView() {
  const settings = useSettings();
  const inventory = useInventory();
  const sessions = useSessions();
  const adjustments = useAdjustments();
  const pd = programDayFor(today());
  const currentWeek = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const [week, setWeek] = useState(currentWeek);
  if (!settings || !inventory || !sessions || !adjustments) return <Loading />;

  const pairs = inventory.filter((i) => i.kind === 'fixed' && i.count >= 2).sort((a, b) => itemLb(a) - itemLb(b));
  const done = new Set(sessions.filter((s) => s.status === 'completed' && s.week === week).map((s) => s.dayKey));

  return (
    <>
      <div className="section-heading top-section">
        <h2>Tu programa de 13 semanas</h2>
        <p>Fuerza, definición y consistencia. Los pesos son referencias ajustables.</p>
      </div>

      <article className="program-banner">
        <div>
          <span className="eyebrow">Plan personalizado</span>
          <h3>
            Construimos fuerza
            <br />
            semana a semana.
          </h3>
          <p>4 días de fuerza · {pairs.length ? `mancuernas de ${pairs.map((p) => p.value).join(', ').replace(/, ([^,]*)$/, ' y $1')} ${pairs[0].unit}` : 'peso corporal y alternativas ligeras'}</p>
        </div>
        <div className="program-stamp" aria-label="13 semanas">
          13<span>SEMANAS</span>
        </div>
      </article>

      <div className="panel program-panel">
        <div className="panel-heading">
          <h3>Tu progresión</h3>
          <label>
            Selecciona semana
            <select className="proto-select" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: PROGRAM_WEEKS }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Semana {i + 1}
                  {i + 1 === currentWeek && pd.status === 'active' ? ' (actual)' : ''}
                  {isRecoveryWeek(i + 1) ? ' · recuperación' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="phase-detail">
          Semana {week}: {WEEK_FOCUS[week - 1]} · {setsForWeek(week)} series por ejercicio
        </div>
        <div className="plan-cards">
          {(['A', 'B', 'C', 'D'] as const).map((k) => {
            const day = PLAN_DAYS[k];
            return (
              <div key={k} className="plan-card">
                <span className="day-tag">
                  {day.weekday.toUpperCase()} · FUERZA {k}
                </span>
                <strong>{day.title}</strong>
                <small>
                  {day.short}
                  {done.has(k) ? ' · ✓ hecho' : ''}
                </small>
                <ul>
                  {day.slots.map((slot) => {
                    const ex = getExercise(slot.exerciseId)!;
                    // Semana actual: propuesta personal (tu nivel). Otras semanas: referencia de la tabla del plan.
                    const opt =
                      week === currentWeek
                        ? proposedOption({ ex, slot, week, inventory, adjustments, sessions, unit: settings.unit }).option
                        : resolveRx(plannedRx(slot, week), ladderFor(ex, inventory), settings.unit).option;
                    return (
                      <li key={ex.id}>
                        <a href={`#/guia/${ex.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <b>{ex.nameEs}</b>
                        </a>{' '}
                        · {setsFor(slot, week)} × {ex.reps} · {formatOptionShort(opt, ex.mode, settings.unit)}
                      </li>
                    );
                  })}
                </ul>
                {week === currentWeek && pd.status === 'active' ? (
                  <StartWorkoutButton date={today()} week={week} dayKey={k} label={done.has(k) ? 'Repetir' : 'Entrenar este día'} className="btn btn-light" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="program-note">
        ℹ Los valores de carga se modifican según tu rendimiento: solo se sugiere subir cuando completas todas las series con buena técnica y {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva durante dos sesiones seguidas. Las semanas 5 y 9 reducen volumen para facilitar la recuperación.
      </div>

      <div className="section-heading">
        <h2>Calendario</h2>
        <p>Toca un día para ver el detalle, entrenar o registrar cardio.</p>
      </div>
      <WeeksCalendar />

      <details className="panel" style={{ marginTop: 18 }}>
        <summary className="panel-heading" style={{ cursor: 'pointer', minHeight: 44 }}>
          <h3>Cómo progresan las cargas y tabla completa</h3>
          <span className="tiny-label purple">13 semanas</span>
        </summary>
        <div style={{ marginTop: 18 }} className="flex flex-col gap-5">
          <ProgressionRules />
        </div>
      </details>
    </>
  );
}

