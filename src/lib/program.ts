import {
  CARDIO_MINUTES_PER_WEEK,
  PLAN_DAYS,
  PROGRAM_START,
  PROGRAM_WEEKS,
  RECOVERY_WEEKS,
  SETS_PER_WEEK,
  WEEK_SCHEDULE,
  type DayKey,
  type PlanSlot,
  type Rx,
} from '../data/plan';
import { addDays, diffDays } from './dates';

export interface ProgramDay {
  date: string;
  /** 1–13, o null si está fuera del programa. */
  week: number | null;
  /** 0 = lunes … 6 = domingo */
  dow: number;
  dayKey: DayKey;
  status: 'before' | 'active' | 'after';
}

export function programDayFor(date: string, start = PROGRAM_START): ProgramDay {
  const offset = diffDays(start, date);
  const dow = ((offset % 7) + 7) % 7;
  const weekIdx = Math.floor(offset / 7);
  const inRange = offset >= 0 && weekIdx < PROGRAM_WEEKS;
  return {
    date,
    week: inRange ? weekIdx + 1 : null,
    dow,
    dayKey: WEEK_SCHEDULE[dow],
    status: offset < 0 ? 'before' : inRange ? 'active' : 'after',
  };
}

export function dateFor(week: number, dow: number, start = PROGRAM_START): string {
  return addDays(start, (week - 1) * 7 + dow);
}

export function clampWeek(week: number): number {
  return Math.min(PROGRAM_WEEKS, Math.max(1, Math.round(week)));
}

export function setsForWeek(week: number): number {
  return SETS_PER_WEEK[clampWeek(week) - 1];
}

export function setsFor(slot: Pick<PlanSlot, 'fixedSets'>, week: number): number {
  return slot.fixedSets ?? setsForWeek(week);
}

export function isRecoveryWeek(week: number): boolean {
  return (RECOVERY_WEEKS as readonly number[]).includes(week);
}

export function cardioTargetForWeek(week: number): number {
  return CARDIO_MINUTES_PER_WEEK[clampWeek(week) - 1];
}

/** Prescripción del plan para una semana. */
export function plannedRx(slot: PlanSlot, week: number): Rx {
  return slot.rx[clampWeek(week) - 1];
}

export function isStrengthDay(k: DayKey): k is 'A' | 'B' | 'C' | 'D' {
  return k === 'A' || k === 'B' || k === 'C' || k === 'D';
}

export function planDay(k: 'A' | 'B' | 'C' | 'D') {
  return PLAN_DAYS[k];
}

export function programCalendar(start = PROGRAM_START): ProgramDay[] {
  const days: ProgramDay[] = [];
  for (let i = 0; i < PROGRAM_WEEKS * 7; i++) days.push(programDayFor(addDays(start, i), start));
  return days;
}

export function weekDates(week: number, start = PROGRAM_START): string[] {
  return Array.from({ length: 7 }, (_, i) => dateFor(week, i, start));
}
