import { useState } from 'react';
import { DAY_LABELS, PLAN_DAYS, PROGRAM_START, PROGRAM_WEEKS, RIR_TARGET, getExercise } from '../data/plan';
import { useAdjustments, useCardio, useInventory, useMeasurements, useProfile, useSessions, useSettings } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { formatLong, today } from '../lib/dates';
import { cardioTargetForWeek, dateFor, isRecoveryWeek, isStrengthDay, programDayFor, setsForWeek } from '../lib/program';
import { sessionProgress } from '../lib/session';
import { adherence, cardioThisWeek, strengthProgress, weekSummaries } from '../lib/stats';
import type { CardioLog, LoadAdjustment, WorkoutSession } from '../lib/types';
import { formatOptionShort, formatWeight, type InventoryItem } from '../lib/weights';
import { DayPlanList } from './DayPlanList';
import { CardioLogger } from './CardioLogger';
import { StartWorkoutButton, discardSession, useActiveSession } from './StartWorkout';
import { Button, Card, Loading, Modal, Notice, ProgressRing } from './ui';

const SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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
  const [pickDay, setPickDay] = useState(false);

  if (!settings || !sessions || !cardio || !measurements || !profile || !inventory || !adjustments || active === undefined) return <Loading />;

  const t = today();
  const pd = programDayFor(t);
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const completedToday = sessions.filter((s) => s.status === 'completed' && s.date === t);
  const doneThisWeek = new Set(sessions.filter((s) => s.status === 'completed' && s.week === week).map((s) => s.dayKey));
  const adh = adherence(sessions, cardio, t);
  const cw = cardioThisWeek(cardio, t);
  const lastM = [...measurements].reverse();
  const lastWeight = lastM.find((m) => m.weightLb)?.weightLb ?? profile.weightLb;
  const lastWaist = lastM.find((m) => m.waistCm)?.waistCm ?? profile.waistCm;

  const [hh, mm] = settings.reminderTime.split(':').map(Number);
  const now = new Date();
  const pastReminder = now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
  const showReminder =
    settings.reminderEnabled && pd.status === 'active' && pastReminder && isStrengthDay(pd.dayKey) && !completedToday.some((s) => s.dayKey === pd.dayKey) && !active;
  const cardioDue = settings.reminderEnabled && pd.status === 'active' && pastReminder && pd.dayKey === 'cardio' && !cardio.some((c) => c.date === t);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm font-medium text-muted">{formatLong(t)}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {pd.status === 'active' ? `Semana ${pd.week} de ${PROGRAM_WEEKS}` : pd.status === 'before' ? 'Tu programa empieza pronto' : 'Programa completado'}
        </h1>
        {pd.status === 'active' ? (
          <p className="text-muted">
            {setsForWeek(pd.week!)} series por ejercicio{isRecoveryWeek(pd.week!) ? ' · semana de recuperación' : ''} · cardio {cardioTargetForWeek(pd.week!)} min
          </p>
        ) : pd.status === 'before' ? (
          <p className="text-muted">Inicio: {formatLong(PROGRAM_START)}</p>
        ) : null}
      </header>

      {active ? <ActiveBanner session={active} /> : null}

      {showReminder ? (
        <Notice tone="warn" title="Recordatorio">
          Hoy toca {DAY_LABELS[pd.dayKey]}. Aunque sea una versión corta, cuenta.
        </Notice>
      ) : null}
      {cardioDue ? (
        <Notice tone="warn" title="Recordatorio">
          Hoy toca cardio. Llevas {cw.minutes} de {cw.target} min esta semana.
        </Notice>
      ) : null}

      {/* Entreno de hoy */}
      <Card aria-labelledby="today-title" className="bg-gradient-to-br from-surface to-sage-soft/60">
        {pd.status === 'active' && isStrengthDay(pd.dayKey) ? (
          <TodayStrength
            dayKey={pd.dayKey}
            week={pd.week!}
            date={t}
            done={completedToday.some((s) => s.dayKey === pd.dayKey)}
            unit={settings.unit}
            inventory={inventory}
            adjustments={adjustments}
            sessions={sessions}
          />
        ) : pd.status === 'active' && pd.dayKey === 'cardio' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-sage-strong">Hoy</p>
            <h2 id="today-title" className="font-display text-2xl font-semibold">Cardio</h2>
            <p className="text-muted">
              Meta semanal sugerida: <strong className="text-ink">{cw.target} min</strong> (≈ {Math.round(cw.target / 2)} min hoy y otro tanto el sábado, o repártelos como prefieras). Intensidad moderada: puedes hablar pero no cantar.
            </p>
            <Button size="lg" onClick={() => setCardioOpen(true)}>
              Registrar cardio
            </Button>
          </div>
        ) : pd.status === 'active' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-sage-strong">Hoy</p>
            <h2 id="today-title" className="font-display text-2xl font-semibold">Descanso</h2>
            <p className="text-muted">Recuperar también es entrenar. Si te apetece: paseo suave, estiramientos o movilidad.</p>
            {doneThisWeek.size < 4 ? (
              <Button variant="secondary" onClick={() => setPickDay(true)}>
                Recuperar un entreno pendiente
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 id="today-title" className="font-display text-2xl font-semibold">{pd.status === 'before' ? 'Prepárate' : '¡Enhorabuena!'}</h2>
            <p className="text-muted">
              {pd.status === 'before'
                ? 'Revisa tu inventario de mancuernas y la guía de técnica. Puedes practicar cualquier día.'
                : 'Terminaste las 13 semanas. Puedes repetir sesiones cuando quieras y revisar tu progreso.'}
            </p>
            <Button variant="secondary" onClick={() => setPickDay(true)}>
              Entrenar un día del plan
            </Button>
          </div>
        )}
      </Card>

      {/* Semana */}
      {pd.status === 'active' ? (
        <Card aria-label="Esta semana">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Esta semana</h2>
            <a href="#/plan" className="min-h-11 py-2 text-sm font-semibold text-sage-strong">Ver calendario →</a>
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const date = dateFor(pd.week!, i);
              const k = programDayFor(date).dayKey;
              const done = isStrengthDay(k) ? doneThisWeek.has(k) : k === 'cardio' ? cardio.some((c) => c.date === date) : false;
              const isToday = date === t;
              return (
                <li key={i} className="flex flex-col items-center gap-1">
                  <span className={`text-xs ${isToday ? 'font-bold text-ink' : 'text-muted'}`}>{SHORT[i]}</span>
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full text-xs font-bold ${done ? 'bg-sage text-on-sage' : k === 'rest' ? 'bg-surface-2 text-muted' : 'border border-line bg-surface'} ${isToday ? 'ring-2 ring-sage ring-offset-2 ring-offset-surface' : ''}`}
                    aria-label={`${SHORT[i]}: ${DAY_LABELS[k]}${done ? ', hecho' : ''}${isToday ? ', hoy' : ''}`}
                  >
                    {done ? '✓' : k === 'cardio' ? '♥' : k === 'rest' ? '–' : k}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center gap-2 text-center" aria-label="Cardio de la semana">
          <ProgressRing value={cw.minutes / cw.target} size={86} label={`Cardio: ${cw.minutes} de ${cw.target} minutos esta semana`}>
            <span className="tabular text-lg font-bold">{cw.minutes}</span>
          </ProgressRing>
          <p className="text-sm text-muted">de {cw.target} min cardio</p>
          <button type="button" onClick={() => setCardioOpen(true)} className="min-h-11 text-sm font-semibold text-sage-strong">
            + Añadir
          </button>
        </Card>
        <Card className="flex flex-col items-center gap-2 text-center" aria-label="Adherencia">
          <ProgressRing value={(adh.pct ?? 0) / 100} size={86} label={adh.pct === null ? 'Adherencia: sin datos aún' : `Adherencia: ${adh.pct} por ciento`}>
            <span className="tabular text-lg font-bold">{adh.pct === null ? '—' : `${adh.pct}%`}</span>
          </ProgressRing>
          <p className="text-sm text-muted">adherencia fuerza</p>
          <p className="text-xs text-muted">
            {adh.strengthDone}/{adh.strengthDue} sesiones{adh.cardioPct !== null ? ` · cardio ${adh.cardioPct}%` : ''}
          </p>
        </Card>
      </div>

      <StrengthCard sessions={sessions} cardio={cardio} unit={settings.unit} week={week} />

      {profile.showWeightGoal ? (
        <Card aria-label="Medidas">
          <h2 className="mb-2 font-semibold">Medidas (opcional)</h2>
          <p className="text-sm text-muted">
            Peso {formatWeight(lastWeight, 'lb')} · cintura {lastWaist} cm. Mira la tendencia de varias semanas; no hay garantías de resultados.
          </p>
        </Card>
      ) : null}

      <Notice>
        Esta app no sustituye el consejo médico. Con hígado graso u otra condición clínica, consulta con tu profesional de la salud antes de cambiar tu actividad o alimentación, y si aparece dolor, mareo o falta de aire.
      </Notice>

      <Modal open={cardioOpen} onClose={() => setCardioOpen(false)} title="Registrar cardio">
        <CardioLogger onSaved={() => setCardioOpen(false)} />
      </Modal>

      <Modal open={pickDay} onClose={() => setPickDay(false)} title="Elegir entreno">
        <ul className="flex flex-col gap-2">
          {(['A', 'B', 'C', 'D'] as const).map((k) => (
            <li key={k} className="rounded-2xl border border-line p-3">
              <p className="font-semibold">
                {PLAN_DAYS[k].title} {doneThisWeek.has(k) && pd.status === 'active' ? <span className="text-sm text-sage-strong">· hecho esta semana</span> : null}
              </p>
              <p className="mb-2 text-sm text-muted">{PLAN_DAYS[k].focus}</p>
              <StartWorkoutButton date={t} week={week} dayKey={k} label={`Empezar ${PLAN_DAYS[k].title}`} size="md" />
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function ActiveBanner({ session }: { session: WorkoutSession }) {
  const p = sessionProgress(session);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="border-sage bg-sage-soft" aria-label="Sesión sin terminar">
      <p className="font-semibold">Tienes una sesión sin terminar</p>
      <p className="text-sm text-muted">
        {DAY_LABELS[session.dayKey]} · {p.done}/{p.total} series · se guardó automáticamente
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => navigate(`/coach/${session.id}`)}>
          Reanudar
        </Button>
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          Descartar
        </Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Descartar la sesión?"
        footer={
          <div className="grid gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                await discardSession(session.id);
                setConfirm(false);
              }}
            >
              Sí, descartar
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        }
      >
        <p>Si ya registraste series, se conservarán en el historial como sesión incompleta.</p>
      </Modal>
    </Card>
  );
}

function TodayStrength({
  dayKey,
  week,
  date,
  done,
  unit,
  inventory,
  adjustments,
  sessions,
}: {
  dayKey: 'A' | 'B' | 'C' | 'D';
  week: number;
  date: string;
  done: boolean;
  unit: 'lb' | 'kg';
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  sessions: WorkoutSession[];
}) {
  const day = PLAN_DAYS[dayKey];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold uppercase tracking-wider text-sage-strong">Hoy {done ? '· completado ✓' : ''}</p>
      <div>
        <h2 id="today-title" className="font-display text-2xl font-semibold">{day.title}</h2>
        <p className="text-muted">{day.focus} · ~{35 + setsForWeek(week) * 5} min</p>
      </div>
      {isRecoveryWeek(week) ? <Notice tone="info">Semana de recuperación: menos series y cargas más ligeras para consolidar fuerza.</Notice> : null}
      <DayPlanList dayKey={dayKey} week={week} inventory={inventory} adjustments={adjustments} sessions={sessions} unit={unit} />
      <p className="text-xs text-muted">
        Calentamiento de 5 min · descansos de 60–90 s (hasta 120 s en los más intensos). Todas las cargas son propuestas condicionadas a tu técnica y a terminar con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva.
      </p>
      <StartWorkoutButton date={date} week={week} dayKey={dayKey} label={done ? 'Repetir entrenamiento' : 'Empezar entrenamiento'} />
    </div>
  );
}

const KEY_LIFTS = ['glute-bridge', 'romanian-deadlift', 'goblet-squat', 'single-arm-row'];

function StrengthCard({ sessions, cardio, unit, week }: { sessions: WorkoutSession[]; cardio: CardioLog[]; unit: 'lb' | 'kg'; week: number }) {
  const summaries = weekSummaries(sessions, cardio);
  const current = summaries[week - 1];
  return (
    <Card aria-label="Fuerza y glúteos">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Fuerza y glúteos</h2>
        <a href="#/progreso" className="min-h-11 py-2 text-sm font-semibold text-sage-strong">Ver progreso →</a>
      </div>
      <p className="mb-3 text-sm text-muted">
        Series de glúteo esta semana: <strong className="tabular text-ink">{current?.gluteSets ?? 0}</strong>
      </p>
      <ul className="divide-y divide-line">
        {KEY_LIFTS.map((id) => {
          const ex = getExercise(id)!;
          const p = strengthProgress(sessions, id);
          return (
            <li key={id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">{ex.nameEs}</span>
              <span className="tabular text-right text-muted">
                {p ? (
                  <>
                    {formatOptionShort(p.first.option, ex.mode, unit)} × {p.first.reps} → <strong className="text-ink">{formatOptionShort(p.last.option, ex.mode, unit)} × {p.last.reps}</strong>
                  </>
                ) : (
                  'sin registros'
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">La meta es ganar fuerza y calidad de movimiento. Las medidas corporales son opcionales y secundarias.</p>
    </Card>
  );
}
