import { PLAN_DAYS, RIR_TARGET, getExercise, type StrengthDay } from '../data/plan';
import { setsFor } from '../lib/program';
import { proposedOption } from '../lib/session';
import type { LoadAdjustment, WorkoutSession } from '../lib/types';
import { formatOption, type InventoryItem, type Unit } from '../lib/weights';

/** Lista de ejercicios de un día con la carga propuesta (siempre del inventario real). */
export function DayPlanList({
  dayKey,
  week,
  inventory,
  adjustments,
  sessions,
  unit,
}: {
  dayKey: StrengthDay;
  week: number;
  inventory: InventoryItem[];
  adjustments: LoadAdjustment[];
  sessions: WorkoutSession[];
  unit: Unit;
}) {
  const day = PLAN_DAYS[dayKey];
  return (
    <ul className="divide-y divide-line">
      {day.slots.map((slot) => {
        const ex = getExercise(slot.exerciseId)!;
        const p = proposedOption({ ex, slot, week, inventory, adjustments, sessions, unit });
        return (
          <li key={ex.id} className="py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a href={`#/guia/${ex.id}`} className="font-medium hover:underline">
                  {ex.nameEs}
                </a>
                {ex.glute ? <span className="ml-1 rounded-full bg-clay-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-clay">glúteo</span> : null}
                <p className="text-sm text-muted">
                  {setsFor(slot, week)} × {ex.reps}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold">{formatOption(p.option, ex.mode, unit)}</p>
            {p.belowPlan && !p.recovery ? (
              <p className="text-xs text-muted">
                Tabla de la semana: {formatOption(p.planOption, ex.mode, unit)} — solo si cumples el criterio (todas las series, buena técnica y {RIR_TARGET.min}–{RIR_TARGET.max} RIR dos sesiones seguidas).
              </p>
            ) : null}
            {p.note ? <p className="text-xs text-warn">{p.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
