import { PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, SETS_PER_WEEK, getExercise, type Mode, type Rx } from '../data/plan';
import { isRecoveryWeek } from '../lib/program';
import { Notice } from './ui';

const MODE_SHORT: Record<Mode, string> = {
  held: 'total · 1 mancuerna, ambas manos',
  each: 'por mano · total = ×2',
  one: 'en una mano',
  body: 'peso corporal',
};

function cell(r: Rx): string {
  if (r.kind === 'body') return 'PC';
  if (r.kind === 'light') return 'Lig.';
  return String(r.lb);
}

/** Tablas de cargas propuestas del programa (13 semanas). */
export function LoadTable() {
  return (
    <div className="flex flex-col gap-4">
      <Notice>
        Cifras en lb por mancuerna fija (10, 15 o 20). <strong>PC</strong> = peso corporal; <strong>Lig.</strong> = alternativa ligera (botellas de agua). Son propuestas condicionadas a la técnica y a terminar con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva: la app solo sugiere subir cuando cumples el criterio dos sesiones seguidas. Semanas 5 y 9 (sombreadas): recuperación.
      </Notice>
      {(['A', 'B', 'C', 'D'] as const).map((k) => (
        <section key={k} className="rounded-3xl border border-line bg-surface p-3" aria-labelledby={`lt-${k}`}>
          <h2 id={`lt-${k}`} className="mb-2 px-1 font-display text-xl font-semibold">
            {PLAN_DAYS[k].title} <span className="text-sm font-normal text-muted">· {PLAN_DAYS[k].weekday}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <caption className="sr-only">Cargas propuestas por semana para {PLAN_DAYS[k].title}</caption>
              <thead>
                <tr className="text-xs text-muted">
                  <th scope="col" className="sticky left-0 bg-surface pr-2 text-left font-medium">Ejercicio</th>
                  {Array.from({ length: PROGRAM_WEEKS }, (_, i) => (
                    <th key={i} scope="col" className={`w-9 px-0.5 text-center font-medium ${isRecoveryWeek(i + 1) ? 'bg-accent-soft' : ''}`}>
                      S{i + 1}
                    </th>
                  ))}
                </tr>
                <tr className="text-[10px] text-muted">
                  <th scope="row" className="sticky left-0 bg-surface pr-2 text-left font-normal">Series</th>
                  {SETS_PER_WEEK.map((n, i) => (
                    <td key={i} className={`text-center ${isRecoveryWeek(i + 1) ? 'bg-accent-soft' : ''}`}>{n}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_DAYS[k].slots.map((slot) => {
                  const ex = getExercise(slot.exerciseId)!;
                  return (
                    <tr key={ex.id} className="border-t border-line">
                      <th scope="row" className="sticky left-0 max-w-40 bg-surface py-1.5 pr-2 text-left font-normal">
                        <span className="block font-medium leading-tight">{ex.nameEs}</span>
                        <span className="block text-[11px] text-muted">{ex.reps} · {MODE_SHORT[ex.mode]}{slot.fixedSets ? ` · ${slot.fixedSets} series` : ''}</span>
                      </th>
                      {slot.rx.map((r, i) => (
                        <td key={i} className={`tabular px-0.5 text-center ${isRecoveryWeek(i + 1) ? 'bg-accent-soft' : ''} ${r.kind === 'db' ? 'font-semibold' : 'text-muted'}`}>
                          {cell(r)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
