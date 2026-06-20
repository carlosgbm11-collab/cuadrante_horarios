export type ShiftType = 'M' | 'T' | 'D' | 'vacation' | 'AP' | 'baja';

export interface Worker {
  id: string;
  name: string;
  display_name: string;
  color: string;
  rotation_pattern: ShiftType[];
  is_active: boolean;
  sort_order: number;
}

export interface ScheduleOverride {
  id: string;
  worker_id: string;
  date: string;
  shift_type: ShiftType;
  notes: string | null;
  created_at: string;
}

export interface DayEntry {
  worker: Worker;
  shift: ShiftType;
  isOverride: boolean;
}

export interface DaySchedule {
  date: string;
  entries: DayEntry[];
}

export interface AppConfig {
  key: string;
  value: string;
}

export const SHIFT_LABELS: Record<ShiftType, string> = {
  M: 'Mañana',
  T: 'Tarde',
  D: 'Descanso',
  vacation: 'Vacaciones',
  AP: 'Asuntos Propios',
  baja: 'Baja',
};

export const SHIFT_HOURS: Partial<Record<ShiftType, string>> = {
  M: '8:00 - 15:00',
  T: '15:00 - 22:00',
};

export const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string; border: string }> = {
  M: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  T: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  D: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  vacation: { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  AP: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316' },
  baja: { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
};

export const SPECIAL_SHIFTS: ShiftType[] = ['vacation', 'AP', 'baja'];
