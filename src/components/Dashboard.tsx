import { useState, type ReactNode } from 'react';
import { GUIDE } from '../data/guide';
import { DAY_LABELS, PLAN_DAYS, PROGRAM_START, PROGRAM_WEEKS, getExercise, type StrengthDay } from '../data/plan';
import { useAdjustments, useCardio, useInventory, useMeasurements, useProfile, useSessions, useSettings } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { addDays, formatLong, parseISODate, today } from '../lib/dates';
import { dateFor, isRecoveryWeek, isStrengthDay, programDayFor, setsForWeek } from '../lib/program';
import { proposedOption, sessionProgress } from '../lib/session';
import { cardioThisWeek, strengthChangePct } from '../lib/stats';
import type { LoadAdjustment, Measurement, WorkoutSession } from '../lib/types';
import { formatWeight, type InventoryItem, type Unit } from '../lib/weights';
import { CardioLogger } from './CardioLogger';
import { ExerciseIllustration } from './ExerciseIllustration';
import { IconBell, IconCalendar, IconCheck, IconDumbbell, IconFlex, IconHeart, IconHip, IconPlay, IconScale, IconTape } from './icons';
import { StartWorkoutButton, discardSession, useActiveSession } from './StartWorkout';
import { Button, Card, Loading, Modal, ProgressRing } from './ui';

const SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
  const [bellOpen, setBellOpen] = useState(false);

  if (!settings || !sessions || !cardio || !measurements || !profile || !inventory || !adjustments || active === undefined) return <Loading />;

  const t = today();
  const pd = programDayFor(t);
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const completed = sessions.filter((s) => s.status === 'completed');
  const doneThisWeek = new Set(completed.filter((s) => s.week === week).map((s) => s.dayKey));
  const cw = cardioThisWeek(cardio, t);

  // Avisos (campana)
  const [hh, mm] = settings.reminderTime.split(':').map(Number);
  const now = new Date();
  const pastReminder = now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
  const alerts: { text: string; action?: () => void; actionLabel?: string }[] = [];
  if (active) alerts.push({ text: `Tienes una sesión sin terminar: ${DAY_LABELS[active.dayKey]}.`, action: () => navigate(`/coach/${active.id}`), actionLabel: 'Reanudar' });
  if (settings.reminderEnabled && pd.status === 'active' && pastReminder && isStrengthDay(pd.dayKey) && !doneThisWeek.has(pd.dayKey) && !active)
    alerts.push({ text: `Hoy toca ${DAY_LABELS[pd.dayKey]}. Una versión corta también cuenta.` });
  if (settings.reminderEnabled && pd.status === 'active' && pastReminder && pd.dayKey === 'cardio' && !cardio.some((c) => c.date === t))
    alerts.push({ text: `Hoy toca cardio. Llevas ${cw.minutes} de ${cw.target} min esta semana.`, action: () => setCardioOpen(true), actionLabel: 'Registrar' });
  if (pd.status === 'active' && isRecoveryWeek(week)) alerts.push({ text: 'Semana de recuperación: menos series y cargas más ligeras.' });

  const next = nextStrength(t, completed);
  const name = profile.name?.trim();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Hola{name ? `, ${name}` : ''} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-muted sm:text-base">
            {pd.status === 'active' ? `Semana ${pd.week} de ${PROGRAM_WEEKS}` : pd.status === 'before' ? `Empiezas el ${formatLong(PROGRAM_START).toLowerCase()}` : 'Programa completado'} · Enfoque: Fuerza y Definición
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setBellOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-card" aria-label={`Avisos${alerts.length ? ` (${alerts.length})` : ''}`}>
            <IconBell />
            {alerts.length ? <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" /> : null}
          </button>
          <a href="#/ajustes" className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft font-display font-semibold text-primary" aria-label="Perfil y ajustes">
            {name ? (
              name[0].toUpperCase()
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="8.5" r="4" />
                <path d="M4 20c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5z" />
              </svg>
            )}
          </a>
        </div>
      </header>

      {active ? <ActiveBanner session={active} /> : null}

      <div className="grid gap-5 md:grid-cols-[1.35fr_1fr]">
        <ObjectiveCard />
        <OverallCard week={week} sessionsDone={completed.length} cardioMinutes={cardio.reduce((a, c) => a + c.minutes, 0)} />
      </div>

      {pd.status === 'active' && pd.dayKey === 'cardio' ? (
        <Card aria-label="Cardio de hoy" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <IconHeart size={28} />
          </div>
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Hoy toca cardio</p>
            <p className="text-sm text-muted">
              {cw.minutes} de {cw.target} min esta semana (≈ {Math.round(cw.target / 2)} min hoy). Intensidad moderada: puedes hablar pero no cantar.
            </p>
          </div>
          <Button onClick={() => setCardioOpen(true)}>Registrar cardio</Button>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1.35fr_1fr]">
        <NextWorkoutCard next={next} inventory={inventory} adjustments={adjustments} sessions={sessions} unit={settings.unit} />
        <WeekCard week={week} active={pd.status === 'active'} today={t} doneKeys={doneThisWeek} cardioDates={new Set(cardio.map((c) => c.date))} onCardio={() => setCardioOpen(true)} cardio={cw} />
      </div>

      <StatTiles measurements={measurements} profile={profile} sessions={sessions} />

      <p className="text-xs leading-relaxed text-muted">
        Esta app no sustituye el consejo médico. Con hígado graso u otra condición clínica, consulta con tu profesional de la salud y detente si aparece dolor, mareo o falta de aire. Los resultados no están garantizados.
      </p>

      <Modal open={cardioOpen} onClose={() => setCardioOpen(false)} title="Registrar cardio">
        <CardioLogger onSaved={() => setCardioOpen(false)} />
      </Modal>
      <Modal open={bellOpen} onClose={() => setBellOpen(false)} title="Avisos">
        {alerts.length === 0 ? (
          <p className="text-muted">No tienes avisos pendientes. ¡Todo al día!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((a) => (
              <li key={a.text} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="text-sm">{a.text}</span>
                {a.action ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setBellOpen(false);
                      a.action!();
                    }}
                  >
                    {a.actionLabel}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <a href="#/ajustes" className="mt-4 inline-block min-h-11 py-2 text-sm font-semibold text-primary">Configurar recordatorios →</a>
      </Modal>
    </div>
  );
}

/** Próximo entreno de fuerza: hoy si aún no está hecho; si no, el siguiente día de fuerza del programa. */
function nextStrength(t: string, completed: WorkoutSession[]): { date: string; week: number; dayKey: StrengthDay; isToday: boolean } | null {
  for (let i = 0; i < 14; i++) {
    const date = addDays(t, i);
    const pd = programDayFor(date);
    if (pd.status === 'after') return null;
    if (pd.status !== 'active' || !isStrengthDay(pd.dayKey)) continue;
    const done = completed.some((s) => s.week === pd.week && s.dayKey === pd.dayKey);
    if (!done) return { date, week: pd.week!, dayKey: pd.dayKey, isToday: i === 0 };
  }
  return null;
}

function ObjectiveCard() {
  return (
    <section aria-labelledby="obj-title" className="relative min-h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3edff] via-[#e6dbff] to-[#cbb8f7] p-6 text-[#1f2937] shadow-card dark:from-[#2a1d44] dark:via-[#30205a] dark:to-[#4c1d95] dark:text-white">
      <div className="relative z-10 max-w-[60%]">
        <p className="text-sm font-medium opacity-80">Tu objetivo</p>
        <h2 id="obj-title" className="font-display text-2xl font-bold leading-tight sm:text-3xl">
          Definición muscular
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {['Ganar fuerza', 'Tonificar y definir', 'Desarrollar glúteos y piernas'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="text-[#6d28d9] dark:text-[#c4b5fd]">
                <IconCheck size={16} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-0 right-0 top-0 w-[45%]" aria-hidden>
        <div className="absolute left-1/2 top-1/2 aspect-square w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 dark:bg-white/10" />
        <ExerciseIllustration pattern="bridge" label="Hip thrust" className="absolute inset-0 !bg-transparent" />
      </div>
    </section>
  );
}

function OverallCard({ week, sessionsDone, cardioMinutes }: { week: number; sessionsDone: number; cardioMinutes: number }) {
  const pct = Math.min(100, Math.round((sessionsDone / (PROGRAM_WEEKS * 4)) * 100));
  const rows: [ReactNode, string][] = [
    [<IconCalendar size={18} />, `Semana ${week} / ${PROGRAM_WEEKS}`],
    [<IconDumbbell size={18} />, `${sessionsDone} entrenamiento${sessionsDone === 1 ? '' : 's'}`],
    [<IconHeart size={18} />, `${cardioMinutes} min de cardio`],
  ];
  return (
    <Card aria-labelledby="overall-title">
      <h2 id="overall-title" className="mb-4 font-display text-lg font-semibold">Tu progreso general</h2>
      <div className="flex items-center gap-5">
        <ProgressRing value={pct / 100} size={112} stroke={11} label={`Programa completado al ${pct} por ciento`}>
          <span className="font-display text-2xl font-bold">{pct}%</span>
        </ProgressRing>
        <ul className="flex flex-1 flex-col gap-2">
          {rows.map(([icon, text]) => (
            <li key={text} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="text-primary">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function NextWorkoutCard({
  next,
  inventory,
  adjustments,
  sessions,
  unit,
}: {
  next: ReturnType<typeof nextStrength>;
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  sessions: WorkoutSession[];
  unit: Unit;
}) {
  if (!next)
    return (
      <Card aria-label="Próximo entrenamiento">
        <h2 className="mb-2 font-display text-lg font-semibold">Próximo entrenamiento</h2>
        <p className="text-muted">No hay entrenos pendientes en el programa. Puedes repetir cualquier día desde Entrenamiento.</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate('/entrenamiento')}>
          Elegir entreno
        </Button>
      </Card>
    );
  const day = PLAN_DAYS[next.dayKey];
  const first = getExercise(day.slots[0].exerciseId)!;
  const dbs = day.slots
    .map((slot) => proposedOption({ ex: getExercise(slot.exerciseId)!, slot, week: next.week, inventory, adjustments, sessions, unit }).option)
    .filter((o) => o.kind === 'db')
    .map((o) => o.lb);
  const min = dbs.length ? Math.min(...dbs) : 0;
  const max = dbs.length ? Math.max(...dbs) : 0;
  const loads = dbs.length ? `Mancuernas: ${min === max ? formatWeight(min, unit) : `${formatWeight(min, unit).replace(` ${unit}`, '')}–${formatWeight(max, unit)}`}` : 'Peso corporal y alternativas ligeras';
  const dow = (parseISODate(next.date).getDay() + 6) % 7;
  return (
    <Card aria-labelledby="next-title">
      <h2 className="mb-4 font-display text-lg font-semibold">Próximo entrenamiento</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3edff] to-[#d8c8fb] sm:w-40 dark:from-[#2a1d44] dark:to-[#3b2a63]">
          <ExerciseIllustration pattern={GUIDE[first.id].pattern} label={first.nameEs} className="h-full w-full !bg-transparent" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <span className="w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {next.isToday ? 'Hoy' : next.date === addDays(today(), 1) ? 'Mañana' : 'Próximo'} · {WEEKDAYS[dow]}
          </span>
          <h3 id="next-title" className="font-display text-xl font-bold leading-tight">
            {day.title}
          </h3>
          <p className="text-sm text-muted">
            ~{35 + setsForWeek(next.week) * 5} min · {setsForWeek(next.week)} series · {loads}
          </p>
          <div className="mt-1 sm:max-w-56">
            <StartWorkoutButton date={next.isToday ? next.date : today()} week={next.week} dayKey={next.dayKey} label="Comenzar" size="md" icon={<IconPlay size={18} />} />
          </div>
          {!next.isToday ? <p className="text-xs text-muted">Puedes adelantarlo; se registrará como el de la semana {next.week}.</p> : null}
        </div>
      </div>
    </Card>
  );
}

function WeekCard({
  week,
  active,
  today: t,
  doneKeys,
  cardioDates,
  onCardio,
  cardio,
}: {
  week: number;
  active: boolean;
  today: string;
  doneKeys: Set<string>;
  cardioDates: Set<string>;
  onCardio: () => void;
  cardio: { minutes: number; target: number };
}) {
  return (
    <Card aria-labelledby="week-title">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="week-title" className="font-display text-lg font-semibold">Esta semana</h2>
        <span className="text-sm font-semibold text-primary">
          {doneKeys.size} / 4 <span className="font-normal text-muted">sesiones</span>
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const date = dateFor(week, i);
          const k = programDayFor(date).dayKey;
          const done = isStrengthDay(k) ? doneKeys.has(k) : k === 'cardio' ? cardioDates.has(date) : false;
          const isToday = active && date === t;
          return (
            <li key={i} className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-muted">{SHORT[i]}</span>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${done ? 'bg-success text-white' : isToday ? 'border-2 border-primary text-primary' : 'bg-primary-soft text-primary/70'}`}
                aria-label={`${WEEKDAYS[i]}: ${DAY_LABELS[k]}${done ? ', hecho' : ''}${isToday ? ', hoy' : ''}`}
              >
                {done ? <IconCheck size={16} /> : isToday ? SHORT[i] : k === 'cardio' ? '♥' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
        <span>
          Cardio: <strong className="tabular">{cardio.minutes}</strong> / {cardio.target} min
        </span>
        <button type="button" onClick={onCardio} className="min-h-10 font-semibold text-primary">
          + Añadir
        </button>
      </div>
      <a href="#/plan" className="mt-2 inline-block min-h-10 py-2 text-sm font-semibold text-primary">
        Ver programa →
      </a>
    </Card>
  );
}

function StatTiles({ measurements, profile, sessions }: { measurements: Measurement[]; profile: { weightLb: number; waistCm: number }; sessions: WorkoutSession[] }) {
  const latest = (k: keyof Measurement) => [...measurements].reverse().find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const first = (k: keyof Measurement) => measurements.find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const tile = (k: 'weightLb' | 'waistCm' | 'hipCm', base?: number) => {
    const cur = latest(k) ?? base;
    const start = base ?? first(k);
    return { cur, delta: cur !== undefined && start !== undefined ? Math.round((cur - start) * 10) / 10 : undefined };
  };
  const w = tile('weightLb', profile.weightLb);
  const wa = tile('waistCm', profile.waistCm);
  const hip = tile('hipCm');
  const str = strengthChangePct(sessions);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={<IconScale />} label="Peso" value={w.cur !== undefined ? `${w.cur} lb` : '—'} delta={w.delta} unit="lb" />
      <Stat icon={<IconTape />} label="Cintura" value={wa.cur !== undefined ? `${wa.cur} cm` : '—'} delta={wa.delta} unit="cm" />
      <Stat icon={<IconHip />} label="Cadera" value={hip.cur !== undefined ? `${hip.cur} cm` : '—'} delta={hip.delta} unit="cm" />
      <Card className="flex flex-col gap-1" aria-label="Fuerza">
        <div className="flex items-center gap-2 text-primary">
          <IconFlex />
          <span className="font-medium text-ink">Fuerza</span>
        </div>
        <p className={`font-display text-2xl font-bold ${str !== null && str > 0 ? 'text-success' : ''}`}>{str === null ? '—' : str === 0 ? '0%' : `${str > 0 ? '↑ +' : '↓ '}${str}%`}</p>
        <p className="text-xs text-muted">{str === null ? 'Se calcula tras 2 sesiones' : 'vs. tus primeras sesiones (estimado)'}</p>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, delta, unit }: { icon: ReactNode; label: string; value: string; delta?: number; unit: string }) {
  return (
    <Card className="flex flex-col gap-1" aria-label={label}>
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="font-medium text-ink">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">
        {value === '—' ? (
          <a href="#/medidas" className="font-semibold text-primary">
            Registrar
          </a>
        ) : delta === undefined || delta === 0 ? (
          'Sin cambios'
        ) : (
          `${delta < 0 ? '▼' : '▲'} ${delta > 0 ? '+' : ''}${delta} ${unit}`
        )}
      </p>
    </Card>
  );
}

function ActiveBanner({ session }: { session: WorkoutSession }) {
  const p = sessionProgress(session);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="border-primary/40 bg-primary-soft" aria-label="Sesión sin terminar">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-display font-semibold">Tienes una sesión sin terminar</p>
          <p className="text-sm text-muted">
            {DAY_LABELS[session.dayKey]} · {p.done}/{p.total} series · se guardó automáticamente
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/coach/${session.id}`)}>Reanudar</Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Descartar
          </Button>
        </div>
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
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p>Si ya registraste series, se conservarán en el historial como sesión incompleta.</p>
      </Modal>
    </Card>
  );
}
