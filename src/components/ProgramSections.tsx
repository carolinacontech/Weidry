import type { ReactNode } from 'react';
import { GUIDE } from '../data/guide';
import { PHASES, PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, SETS_PER_WEEK, getExercise, type StrengthDay } from '../data/plan';
import { ExerciseIllustration } from './ExerciseIllustration';
import { IconCalendar, IconDumbbell, IconFlex, IconHeart, IconHip } from './icons';
import { LoadTable } from './LoadTable';
import { Card } from './ui';

const DAY_ICON: Record<StrengthDay, ReactNode> = {
  A: <IconHip size={28} />,
  B: <IconFlex size={28} />,
  C: <IconHip size={28} />,
  D: <IconDumbbell size={28} />,
};

/** Arte decorativo original: dos mancuernas hexagonales. */
function DumbbellArt() {
  const db = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-34" y="-5" width="68" height="10" rx="5" fill="#4b5563" />
      <path d="M-54 -22 l10 -6 h8 l10 6 v44 l-10 6 h-8 l-10 -6z" fill="#1f2937" />
      <path d="M26 -22 l10 -6 h8 l10 6 v44 l-10 6 h-8 l-10 -6z" fill="#1f2937" />
      <path d="M-50 -18 l6 -4 h6 l6 4" stroke="#6b7280" strokeWidth="2" fill="none" />
      <path d="M30 -18 l6 -4 h6 l6 4" stroke="#6b7280" strokeWidth="2" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 220 110" className="h-full w-full" aria-hidden>
      {db(62, 55, 0.8)}
      {db(158, 72, 0.8)}
    </svg>
  );
}

export function ProgramOverview({ currentWeek }: { currentWeek: number | null }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="relative flex min-h-36 items-center overflow-hidden rounded-2xl bg-gradient-to-r from-[#f3edff] via-[#e6dbff] to-[#cbb8f7] p-6 shadow-card dark:from-[#2a1d44] dark:via-[#30205a] dark:to-[#4c1d95]" aria-labelledby="plan-hero">
        <div className="relative z-10 flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/70 text-primary dark:bg-white/10">
            <IconCalendar size={36} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink/80">Plan completo</p>
            <h2 id="plan-hero" className="font-display text-3xl font-bold">
              {PROGRAM_WEEKS} semanas
            </h2>
            <p className="text-sm text-muted">4 días de fuerza · 2 de cardio · 1 de descanso</p>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 top-0 hidden w-1/2 sm:block">
          <DumbbellArt />
        </div>
      </section>

      <section aria-labelledby="estructura">
        <h2 id="estructura" className="mb-3 font-display text-lg font-semibold">Estructura semanal</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['A', 'B', 'C', 'D'] as const).map((k) => (
            <Card key={k} className="flex items-center gap-3 !p-4">
              <span className="text-primary">{DAY_ICON[k]}</span>
              <div>
                <p className="text-xs font-semibold text-primary">{PLAN_DAYS[k].weekday}</p>
                <p className="text-sm font-medium leading-tight">{PLAN_DAYS[k].title}</p>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className="text-primary">
            <IconHeart size={18} />
          </span>
          Miércoles y sábado: cardio moderado · Domingo: descanso
        </p>
      </section>

      <section aria-labelledby="progresion-series">
        <h2 id="progresion-series" className="mb-3 font-display text-lg font-semibold">Progresión de series</h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PHASES.map((p) => {
            const now = currentWeek !== null && p.weeks.includes(currentWeek);
            return (
              <li
                key={p.label}
                className={`rounded-2xl border p-3 text-center ${now ? 'border-primary bg-primary text-on-primary shadow-card' : 'border-line bg-surface'}`}
                aria-current={now ? 'step' : undefined}
              >
                <p className="font-display text-sm font-semibold">{p.label}</p>
                <p className={`text-xs ${now ? '' : 'text-muted'}`}>{SETS_PER_WEEK[p.weeks[0] - 1]} series</p>
                <p className={`text-xs ${now ? '' : 'text-muted'}`}>{p.name}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function ExerciseList() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(['A', 'B', 'C', 'D'] as const).map((k) => (
        <Card key={k} aria-labelledby={`el-${k}`}>
          <h2 id={`el-${k}`} className="mb-2 font-display text-lg font-semibold">
            {PLAN_DAYS[k].title} <span className="text-sm font-normal text-muted">· {PLAN_DAYS[k].weekday}</span>
          </h2>
          <ul className="divide-y divide-line">
            {PLAN_DAYS[k].slots.map((slot) => {
              const ex = getExercise(slot.exerciseId)!;
              return (
                <li key={ex.id}>
                  <a href={`#/guia/${ex.id}`} className="flex items-center gap-3 py-2 hover:opacity-80">
                    <span className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                      <ExerciseIllustration pattern={GUIDE[ex.id].pattern} label={ex.nameEs} className="h-full w-full !bg-transparent" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-tight">{ex.nameEs}</span>
                      <span className="block text-xs text-muted">
                        {ex.reps}
                        {ex.glute ? ' · glúteo' : ''}
                      </span>
                    </span>
                    <span className="text-primary" aria-hidden>
                      →
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function ProgressionRules() {
  return (
    <div className="flex flex-col gap-5">
      <Card aria-labelledby="reglas">
        <h2 id="reglas" className="mb-3 font-display text-lg font-semibold">Cómo progresan las cargas</h2>
        <ol className="flex flex-col gap-3 text-sm">
          {[
            ['1', `Cada serie termina con ${RIR_TARGET.min}–${RIR_TARGET.max} repeticiones en reserva (RIR) y buena técnica.`],
            ['2', 'Primero sumas repeticiones hasta el tope del rango. Después, tempo lento (3 s al bajar) o una serie más.'],
            ['3', 'Solo se sugiere subir peso tras dos sesiones seguidas con todas las series, buena técnica y 2–3 RIR.'],
            ['4', 'Siempre a la siguiente opción que tienes (botella más pesada o mancuerna de 10, 15 o 20 lb). Los saltos grandes son opcionales.'],
            ['5', 'Semanas 5 y 9: recuperación, con menos series y cargas más ligeras.'],
            ['!', 'Si hay dolor, se para el ejercicio. Nada cambia sin tu aprobación.'],
          ].map(([n, t]) => (
            <li key={n} className="flex gap-3">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${n === '!' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}>{n}</span>
              <span className="pt-1">{t}</span>
            </li>
          ))}
        </ol>
      </Card>
      <LoadTable />
    </div>
  );
}
