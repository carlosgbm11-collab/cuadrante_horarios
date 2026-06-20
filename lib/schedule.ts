import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CYCLE_LENGTH } from '../constants/rotation';
import { DayEntry, DaySchedule, ScheduleOverride, ShiftType, Worker } from './types';

export function getBaseShift(worker: Worker, date: Date, cycleStartDate: string): ShiftType {
  const cycleStart = parseISO(cycleStartDate);
  const diff = differenceInCalendarDays(date, cycleStart);
  const cycleDay = ((diff % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  return worker.rotation_pattern[cycleDay] ?? 'D';
}

export function getDaySchedule(
  date: Date,
  workers: Worker[],
  overrides: ScheduleOverride[],
  cycleStartDate: string,
): DaySchedule {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dateOverrides = overrides.filter((o) => o.date === dateStr);

  const entries: DayEntry[] = workers
    .filter((w) => w.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((w) => {
      const override = dateOverrides.find((o) => o.worker_id === w.id);
      if (override) {
        return { worker: w, shift: override.shift_type, isOverride: true };
      }
      const shift = getBaseShift(w, date, cycleStartDate);
      return { worker: w, shift, isOverride: false };
    });

  return { date: dateStr, entries };
}

export function getMonthSchedule(
  year: number,
  month: number,
  workers: Worker[],
  overrides: ScheduleOverride[],
  cycleStartDate: string,
): DaySchedule[] {
  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    return getDaySchedule(date, workers, overrides, cycleStartDate);
  });
}

export function getMorningWorkers(day: DaySchedule): DayEntry[] {
  return day.entries.filter((e) => e.shift === 'M');
}

export function getAfternoonWorkers(day: DaySchedule): DayEntry[] {
  return day.entries.filter((e) => e.shift === 'T');
}

export function getRestWorkers(day: DaySchedule): DayEntry[] {
  return day.entries.filter((e) => e.shift === 'D');
}

export function getSpecialWorkers(day: DaySchedule): DayEntry[] {
  return day.entries.filter((e) => e.shift === 'vacation' || e.shift === 'AP');
}

// Returns list of overrides needed to fix coverage for a specific date.
// Call AFTER the triggering override has already been added to `overrides`.
export function computeDateFixes(
  date: Date,
  workers: Worker[],
  overrides: ScheduleOverride[],
  cycleStart: string,
): Array<{ workerId: string; shift: ShiftType; workerName: string }> {
  const day = getDaySchedule(date, workers, overrides, cycleStart);
  const used = new Set<string>();

  const M = day.entries.filter((e) => e.shift === 'M');
  const T = day.entries.filter((e) => e.shift === 'T');
  const D = day.entries.filter((e) => e.shift === 'D' && e.worker.is_active);
  const active = M.length + T.length;

  if (active === 0) return [];

  const fixes: Array<{ workerId: string; shift: ShiftType; workerName: string }> = [];

  const addFix = (pool: typeof M | typeof D, shift: ShiftType) => {
    const c = pool.find((e) => !used.has(e.worker.id));
    if (c) {
      fixes.push({ workerId: c.worker.id, shift, workerName: c.worker.name });
      used.add(c.worker.id);
    }
  };

  if (M.length === 0) addFix([...D, ...T], 'M');
  if (T.length === 0) addFix([...D, ...(M.length > 1 ? M : [])], 'T');

  const mAfter = M.length + fixes.filter((f) => f.shift === 'M').length;
  if (active >= 3 && mAfter < 2) {
    addFix(
      [
        ...D.filter((e) => !used.has(e.worker.id)),
        ...T.filter((e) => !used.has(e.worker.id)),
      ],
      'M',
    );
  }

  return fixes;
}

// Given all workers (one of them just changed pattern), returns which OTHER workers
// need their rotation_pattern updated to satisfy coverage rules for all 28 cycle days.
export function computeRotationFixes(
  workers: Worker[],
): { worker: Worker; newPattern: ShiftType[] }[] {
  const patterns = new Map<string, ShiftType[]>(
    workers.map((w) => [w.id, [...w.rotation_pattern]]),
  );

  for (let day = 0; day < CYCLE_LENGTH; day++) {
    for (let _attempt = 0; _attempt < 3; _attempt++) {
      const getS = (w: Worker) => patterns.get(w.id)![day];
      const M = workers.filter((w) => getS(w) === 'M');
      const T = workers.filter((w) => getS(w) === 'T');
      const D = workers.filter((w) => getS(w) === 'D');
      const active = M.length + T.length;
      if (active === 0) break;

      const used = new Set<string>();
      const assign = (pool: Worker[], shift: ShiftType) => {
        const c = pool.find((w) => !used.has(w.id));
        if (c) { patterns.get(c.id)![day] = shift; used.add(c.id); return true; }
        return false;
      };

      if (M.length === 0) { assign([...D, ...T], 'M'); continue; }
      if (T.length === 0) { assign([...D, ...(M.length > 1 ? M : [])], 'T'); continue; }

      const mNow = workers.filter((w) => patterns.get(w.id)![day] === 'M').length;
      if (active >= 3 && mNow < 2) { assign([...D, ...T], 'M'); continue; }
      break;
    }
  }

  return workers
    .filter((w) => !patterns.get(w.id)!.every((s, i) => s === w.rotation_pattern[i]))
    .map((w) => ({ worker: w, newPattern: patterns.get(w.id)! }));
}

// Returns M/T/total stats for a worker in a given pre-computed month schedule.
export function getWorkerMonthStats(
  workerId: string,
  schedule: DaySchedule[],
): { mDays: number; tDays: number; total: number } {
  let mDays = 0, tDays = 0;
  for (const day of schedule) {
    const e = day.entries.find((e) => e.worker.id === workerId);
    if (e?.shift === 'M') mDays++;
    else if (e?.shift === 'T') tDays++;
  }
  return { mDays, tDays, total: mDays + tDays };
}
