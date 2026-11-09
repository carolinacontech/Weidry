import type { ReactNode } from 'react';
import { GUIDE } from '../data/guide';
import { Img, PHOTOS } from '../data/photos';
import { PHASES, PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, SETS_PER_WEEK, getExercise, type StrengthDay } from '../data/plan';
import { ExerciseIllustration } from './ExerciseIllustration';
import { IconCalendar, IconDumbbell, IconFlex, IconHeart, IconHip } from './icons';
import { LoadTable } from './LoadTable';
import { Card } from './ui';

const _DAY_ICON: Record<StrengthDay, ReactNode> = {
  A: <IconHip size={28} />,
  B: <IconFlex size={28} />,
  C: <IconHip size={28} />,
  D: <IconDumbbell size={28} />,
};

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
