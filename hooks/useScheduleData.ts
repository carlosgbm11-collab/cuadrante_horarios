import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Worker, ScheduleOverride, ShiftType } from '../lib/types';
import { DEFAULT_ROTATION } from '../constants/rotation';

const DEFAULT_CYCLE_START = '2026-06-01';

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async (): Promise<Worker[]> => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCycleStart() {
  return useQuery({
    queryKey: ['app_config', 'cycle_start_date'],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'cycle_start_date')
        .single();
      if (error) return DEFAULT_CYCLE_START;
      return data?.value ?? DEFAULT_CYCLE_START;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useMonthOverrides(year: number, month: number) {
  const from = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const to = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['overrides', year, month],
    queryFn: async (): Promise<ScheduleOverride[]> => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('*')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useYearOverrides(year: number) {
  return useQuery({
    queryKey: ['overrides', 'year', year],
    queryFn: async (): Promise<ScheduleOverride[]> => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Overrides de un trabajador concreto en un rango amplio (para su vista personal)
export function useWorkerOverrides(workerId: string, year: number, month: number) {
  const from = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const to = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['overrides', 'worker', workerId, year, month],
    queryFn: async (): Promise<ScheduleOverride[]> => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('*')
        .eq('worker_id', workerId)
        .gte('date', from)
        .lte('date', to)
        .order('date');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!workerId,
  });
}

// Todos los overrides futuros de un trabajador (para mostrar próximos períodos)
export function useWorkerUpcomingOverrides(workerId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['overrides', 'worker', workerId, 'upcoming'],
    queryFn: async (): Promise<ScheduleOverride[]> => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('*')
        .eq('worker_id', workerId)
        .gte('date', today)
        .in('shift_type', ['vacation', 'AP', 'baja'])
        .order('date')
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!workerId,
  });
}

export function useUpsertOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (override: Omit<ScheduleOverride, 'id' | 'created_at'>): Promise<ScheduleOverride> => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .upsert(override, { onConflict: 'worker_id,date' })
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleOverride;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
    },
  });
}

// Crear overrides para un rango de fechas (período de vacaciones/AP/baja)
export function useUpsertPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workerId,
      from,
      to,
      shiftType,
      notes,
    }: {
      workerId: string;
      from: string;
      to: string;
      shiftType: ShiftType;
      notes: string;
    }) => {
      const days = eachDayOfInterval({
        start: parseISO(from),
        end: parseISO(to),
      });
      const rows = days.map((d) => ({
        worker_id: workerId,
        date: format(d, 'yyyy-MM-dd'),
        shift_type: shiftType,
        notes: notes || null,
      }));
      const { error } = await supabase
        .from('schedule_overrides')
        .upsert(rows, { onConflict: 'worker_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
    },
  });
}

export function useDeleteOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_overrides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
    },
  });
}

// Eliminar todos los overrides de un trabajador en un rango de fechas
export function useDeletePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, from, to }: { workerId: string; from: string; to: string }) => {
      const { error } = await supabase
        .from('schedule_overrides')
        .delete()
        .eq('worker_id', workerId)
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
    },
  });
}

export function useDeleteWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
    },
  });
}

export function useUpsertWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (worker: Partial<Worker> & { name: string }) => {
      const { error } = await supabase
        .from('workers')
        .upsert(worker, { onConflict: 'name' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
}

export function useResetRotations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workers: Worker[]) => {
      for (const worker of workers) {
        const pattern = DEFAULT_ROTATION[worker.name];
        if (!pattern) continue;
        const { error } = await supabase
          .from('workers')
          .update({ rotation_pattern: pattern })
          .eq('id', worker.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
}

export function useUpdateCycleStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'cycle_start_date', value: date }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_config'] });
    },
  });
}
