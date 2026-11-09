import { useState } from 'react';
import { Img, PHOTOS } from '../data/photos';
import { DAY_LABELS, PLAN_DAYS, PROGRAM_WEEKS, getExercise, type StrengthDay } from '../data/plan';
import { useAdjustments, useCardio, useInventory, useMeasurements, useProfile, useSessions, useSettings } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { addDays, formatShort, parseISODate, today } from '../lib/dates';
import { dateFor, isRecoveryWeek, isStrengthDay, programDayFor, setsForWeek } from '../lib/program';
import { proposedOption, sessionProgress } from '../lib/session';
import { cardioThisWeek } from '../lib/stats';
import type { Measurement, WorkoutSession } from '../lib/types';
import { itemLb } from '../lib/weights';
import { CardioLogger } from './CardioLogger';
import { StartWorkoutButton, discardSession, useActiveSession } from './StartWorkout';
import { Loading, Modal } from './ui';

const SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];

/** Ilustración del prototipo (hero). */
function HeroArt() {
  return (
    <svg viewBox="0 0 330 290" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M170 35c-18 0-32 13-32 33 0 11 5 19 10 25l-23 19-18 52-38 15 7 16 50-16 17-35 1 47-30 64 17 11 42-67 31 65 20-11-32-80 4-33 18 34 48 11 6-17-34-13-26-56-25-17c7-7 12-17 12-28 0-21-13-33-29-33z" fill="#6737b7" opacity=".23" />
      <circle cx="165" cy="65" r="28" fill="#9F6FCE" />
      <path d="M142 94c-13 5-29 19-38 41l-20 34 15 10 32-37 14 20-2 48-28 42 21 10 40-56 18 51 21-7-16-71 1-38 13 34 45 15 8-19-35-13-17-48c-12-23-30-34-49-35z" fill="#8050C4" />
      <path d="M149 101c17 10 37 10 51-1l-5 45-49 5 3-49z" fill="#EEE1FF" />
      <path d="M88 168l-20-5-5 34 15 4zM263 173l10-1 8 35-17 2z" fill="#3B2552" />
      <path d="M55 172h45M48 164v17M39 169v8M106 161v24M243 180h47M300 173v16M309 178v7M236 174v18" stroke="#3B2552" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function Dashboard() {
  const settings = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const measurements = useMeasurements();
  const profile = useProfile();
  const inventory = useInventory();
  const adjustments = useAdjustments();
  const active = useActiveSession();
  const [cardioOpen, setCardioOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  if (!settings || !sessions || !cardio || !measurements || !profile || !inventory || !adjustments || active === undefined) return <Loading />;

  const t = today();
  const pd = programDayFor(t);
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const completed = sessions.filter((s) => s.status === 'completed');
  const doneThisWeek = new Set(completed.filter((s) => s.week === week).map((s) => s.dayKey));
  const cw = cardioThisWeek(cardio, t);
  const totalPlanned = PROGRAM_WEEKS * 4;
  const pct = Math.min(100, Math.round((completed.length / totalPlanned) * 100));

  // Recordatorio dentro de la app
  const [hh, mm] = settings.reminderTime.split(':').map(Number);
  const now = new Date();
  const pastReminder = now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
  let reminder: string | null = null;
  if (settings.reminderEnabled && pd.status === 'active' && pastReminder && !active) {
    if (isStrengthDay(pd.dayKey) && !doneThisWeek.has(pd.dayKey)) reminder = `Hoy toca ${DAY_LABELS[pd.dayKey]}. Una versión corta también cuenta.`;
    else if (pd.dayKey === 'cardio' && !cardio.some((c) => c.date === t)) reminder = `Hoy toca cardio: llevas ${cw.minutes} de ${cw.target} min esta semana.`;
  }

  const next = nextStrength(t, completed);
  const latest = (k: keyof Measurement) => [...measurements].reverse().find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const weight = latest('weightLb') ?? profile.weightLb;
  const waist = latest('waistCm') ?? profile.waistCm;
  const hip = latest('hipCm') ?? profile.hipCm;
  const pairs = inventory.filter((i) => i.kind === 'fixed' && i.count >= 2).sort((a, b) => itemLb(a) - itemLb(b));
  const delta = (cur: number, start: number, unit: string) => (cur === start ? null : `${cur < start ? '−' : '+'}${Math.round(Math.abs(cur - start) * 10) / 10} ${unit} desde el inicio`);

  return (
    <>
      {active ? (
        <article className="panel alert-panel" aria-label="Sesión sin terminar">
          <div>
            <strong>Tienes una sesión sin terminar</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              {DAY_LABELS[active.dayKey]} · {sessionProgress(active).done}/{sessionProgress(active).total} series · guardada automáticamente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/entrenamiento')}>
              Reanudar <span aria-hidden>→</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setDiscardOpen(true)}>
              Descartar
            </button>
          </div>
        </article>
      ) : null}
      {reminder ? (
        <article className="panel alert-panel" role="status">
          <div>
            <span className="eyebrow">Recordatorio</span>
            <p style={{ margin: '4px 0 0' }}>{reminder}</p>
          </div>
          {pd.dayKey === 'cardio' ? (
            <button type="button" className="btn btn-light" onClick={() => setCardioOpen(true)}>
              Registrar cardio
            </button>
          ) : null}
        </article>
      ) : null}

      <div className="dashboard-grid">
        <article className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">TU OBJETIVO, A TU RITMO</span>
            <h2>
              Más fuerte.
              <br />
              <em>Más definida.</em>
              <br />
              Más tú.
            </h2>
            <p>4 días de fuerza, avances reales y un programa que se adapta a ti.</p>
            <button type="button" className="btn btn-dark" onClick={() => navigate('/entrenamiento')}>
              Empezar mi entrenamiento <span aria-hidden>↗</span>
            </button>
          </div>
          <div className="hero-art" aria-hidden>
            <div className="halo halo-one" />
            <div className="halo halo-two" />
            <HeroArt />
          </div>
        </article>

        <article className="panel summary-panel">
          <div className="panel-heading">
            <h3>Tu progreso</h3>
            <span className="tiny-label">Plan completo</span>
          </div>
          <div className="ring-and-desc">
            <div
              className="progress-ring"
              style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--primary-soft) 0)` }}
              role="img"
              aria-label={`${completed.length} sesiones completadas de ${totalPlanned} (${pct} %)`}
            >
              <div className="ring-content">
                <b>{completed.length}</b>
                <small>sesiones</small>
              </div>
            </div>
            <div>
              <strong>
                13 semanas
                <br />
                para avanzar
              </strong>
              <p>No necesitas ser perfecta; solo constante.</p>
            </div>
          </div>
          <div className="summary-foot">
            <span>4 días de fuerza / semana</span>
            <span>
              {pct}% del plan <span className="violet-dot" style={{ display: 'inline-block', marginLeft: 6 }} />
            </span>
          </div>
        </article>

        <article className="panel next-panel">
          <div className="panel-heading">
            <h3>Tu siguiente entrenamiento</h3>
            {next ? <span className="tiny-label purple">FUERZA {next.dayKey}</span> : null}
          </div>
          {next ? (
            nextBody(next, sessions)
          ) : (
            <p className="muted" style={{ marginTop: 18 }}>
              No quedan entrenos pendientes en el programa. Puedes repetir cualquier sesión desde Entrenar.
            </p>
          )}
        </article>

        <article className="panel week-panel">
          <div className="panel-heading">
            <h3>Esta semana</h3>
            <span className="tiny-label">
              {doneThisWeek.size}/4 · Tu constancia
            </span>
          </div>
          <div className="week-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const date = dateFor(week, i);
              const k = programDayFor(date).dayKey;
              const strength = isStrengthDay(k);
              const done = strength ? doneThisWeek.has(k) : k === 'cardio' ? cardio.some((c) => c.date === date) : false;
              const isToday = pd.status === 'active' && date === t;
              return (
                <div key={i} className={`week-day${strength ? ' strength' : ''}${done ? ' done' : ''}${isToday ? ' today' : ''}`}>
                  <span>{SHORT[i]}</span>
                  <span className="bubble" aria-label={`${DAY_LABELS[k]}${done ? ', hecho' : ''}${isToday ? ', hoy' : ''}`}>
                    {done ? '✓' : strength ? '✦' : k === 'cardio' ? '·' : '–'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="week-hint">
            <span>Los días de fuerza tienen un punto morado.</span>
            <button type="button" className="link-btn" onClick={() => setCardioOpen(true)}>
              + Cardio {cw.minutes}/{cw.target} min
            </button>
          </div>
        </article>
      </div>

      <div className="section-heading">
        <h2>Tu punto de partida</h2>
        <p>Usamos tus medidas reales, no cifras inventadas.</p>
      </div>
      <div className="metric-grid">
        <article className="metric">
          <span className="metric-icon" aria-hidden>⚖</span>
          <span className="metric-title">Peso actual</span>
          <strong>
            {weight} <small>lb</small>
          </strong>
          <span className="metric-caption">{delta(weight, profile.weightLb, 'lb') ?? `Meta final: ${profile.goalWeightLb} lb`}</span>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden>◌</span>
          <span className="metric-title">Cintura</span>
          <strong>
            {waist} <small>cm</small>
          </strong>
          <span className="metric-caption">{delta(waist, profile.waistCm, 'cm') ?? 'Progreso, sin presiones'}</span>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden>♡</span>
          <span className="metric-title">Cadera</span>
          <strong>
            {hip} <small>cm</small>
          </strong>
          <span className="metric-caption">{delta(hip, profile.hipCm, 'cm') ?? 'Referencia inicial'}</span>
        </article>
        <a className="metric" href="#/ajustes" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="metric-icon" aria-hidden>✳</span>
          <span className="metric-title">Tu equipo</span>
          <strong>
            {pairs.length} <small>{pairs.length === 1 ? 'par' : 'pares'}</small>
          </strong>
          <span className="metric-caption">{pairs.length ? `${pairs.map((p) => p.value).join(', ').replace(/, ([^,]*)$/, ' y $1')} ${pairs[0].unit}` : 'Añade tus mancuernas'}</span>
        </a>
      </div>

      <p className="privacy-note">
        Weidry no sustituye el consejo médico. Con hígado graso u otra condición clínica, consulta con tu profesional de la salud y detente si aparece dolor, mareo o falta de aire. Los resultados no están garantizados.
      </p>

      <Modal open={cardioOpen} onClose={() => setCardioOpen(false)} title="Registrar cardio">
        <CardioLogger onSaved={() => setCardioOpen(false)} />
      </Modal>
      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="¿Descartar la sesión?"
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (active) await discardSession(active.id);
                setDiscardOpen(false);
              }}
            >
              Sí, descartar
            </button>
            <button type="button" className="btn btn-light" onClick={() => setDiscardOpen(false)}>
              Cancelar
            </button>
          </div>
        }
      >
        <p>Si ya registraste series, se conservarán en el historial como sesión incompleta.</p>
      </Modal>
    </>
  );

  function nextBody(next: NonNullable<ReturnType<typeof nextStrength>>, sessions: WorkoutSession[]) {
    const day = PLAN_DAYS[next.dayKey];
    const dbs = day.slots
      .map((slot) => proposedOption({ ex: getExercise(slot.exerciseId)!, slot, week: next.week, inventory: inventory!, adjustments: adjustments!, sessions, unit: settings!.unit }).option)
      .filter((o) => o.kind === 'db')
      .map((o) => o.lb);
    const min = dbs.length ? Math.min(...dbs) : 0;
    const max = dbs.length ? Math.max(...dbs) : 0;
    const dow = (parseISODate(next.date).getDay() + 6) % 7;
    return (
      <div className="next-body">
        <div className="workout-illustration">
          <Img photo={PHOTOS[next.dayKey]} decorative />
        </div>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            {next.isToday ? 'HOY · ' : next.date === addDays(t, 1) ? 'MAÑANA · ' : ''}
            {WEEKDAYS[dow]} · {formatShort(next.date).toUpperCase()}
          </p>
          <h4>{day.title}</h4>
          <p className="muted">
            {day.slots.length} ejercicios · {setsForWeek(next.week)} series · {isRecoveryWeek(next.week) ? '25–35' : '35–45'} min
            {dbs.length ? ` · ${min === max ? `${min}` : `${min}–${max}`} lb` : ''}
          </p>
          <StartWorkoutButton date={next.isToday ? next.date : t} week={next.week} dayKey={next.dayKey} label="Comenzar" />
        </div>
      </div>
    );
  }
}

/** Próximo entreno de fuerza: hoy si aún no está hecho; si no, el siguiente día de fuerza del programa. */
function nextStrength(t: string, completed: WorkoutSession[]): { date: string; week: number; dayKey: StrengthDay; isToday: boolean } | null {
  for (let i = 0; i < 14; i++) {
    const date = addDays(t, i);
    const pd = programDayFor(date);
    if (pd.status === 'after') return null;
    if (pd.status !== 'active' || !isStrengthDay(pd.dayKey)) continue;
    if (!completed.some((s) => s.week === pd.week && s.dayKey === pd.dayKey)) return { date, week: pd.week!, dayKey: pd.dayKey, isToday: i === 0 };
  }
  return null;
}
