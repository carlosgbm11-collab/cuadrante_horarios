import { format, getDaysInMonth, getDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useTheme } from '../lib/themeContext';
import { DaySchedule, ShiftType, Worker } from '../lib/types';
import { ShiftBadge } from './ShiftBadge';

const DAY_WIDTH = 52;
const WORKER_COL_WIDTH = 70;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDayOfWeekIndex(date: Date): number {
  const d = getDay(date); // 0=Sun...6=Sat
  return d === 0 ? 6 : d - 1; // convert to Mon=0...Sun=6
}

interface Props {
  year: number;
  month: number;
  workers: Worker[];
  schedule: DaySchedule[];
  onDayPress?: (date: string, workerId: string) => void;
  isAdmin?: boolean;
}

export function MonthCalendar({ year, month, workers, schedule, onDayPress, isAdmin }: Props) {
  const { colors } = useTheme();
  const today = format(new Date(), 'yyyy-MM-dd');
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const activeWorkers = workers.filter((w) => w.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const getShiftForWorkerDay = useCallback(
    (workerId: string, daySchedule: DaySchedule): ShiftType => {
      const entry = daySchedule.entries.find((e) => e.worker.id === workerId);
      return entry?.shift ?? 'D';
    },
    [],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollOuter}>
      <View>
        {/* Header: día del mes + día de semana */}
        <View style={[styles.headerRow, { backgroundColor: colors.bgScreen, borderBottomColor: colors.border }]}>
          <View style={[styles.workerColHeader, { width: WORKER_COL_WIDTH }]} />
          {schedule.map((day, i) => {
            const date = new Date(year, month - 1, i + 1);
            const dayOfWeek = getDayOfWeekIndex(date);
            const isToday = day.date === today;
            const isWeekend = dayOfWeek >= 5;
            return (
              <View
                key={day.date}
                style={[
                  styles.dayHeader,
                  { width: DAY_WIDTH, borderLeftColor: colors.border, backgroundColor: isToday ? colors.todayBg : isWeekend ? colors.weekendBg : undefined },
                ]}
              >
                <Text style={[styles.dayName, { color: isWeekend ? colors.weekendText : colors.textSub }]}>
                  {DAY_NAMES[dayOfWeek]}
                </Text>
                <Text style={[styles.dayNum, { color: isToday ? colors.primary : colors.text }]}>{i + 1}</Text>
              </View>
            );
          })}
        </View>

        {/* Filas por trabajador */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeWorkers.map((worker) => (
            <View key={worker.id} style={[styles.workerRow, { borderBottomColor: colors.borderLight }]}>
              <View style={[styles.workerCol, { width: WORKER_COL_WIDTH, borderRightColor: colors.border }]}>
                <View style={[styles.workerDot, { backgroundColor: worker.color }]} />
                <Text style={[styles.workerName, { color: colors.text }]} numberOfLines={1}>
                  {worker.name}
                </Text>
              </View>

              {schedule.map((day) => {
                const shift = getShiftForWorkerDay(worker.id, day);
                const isToday = day.date === today;
                const entry = day.entries.find((e) => e.worker.id === worker.id);
                return (
                  <Pressable
                    key={day.date}
                    style={[styles.cell, { width: DAY_WIDTH, borderLeftColor: colors.borderLight, backgroundColor: isToday ? colors.todayBg : undefined }]}
                    onPress={() => isAdmin && onDayPress?.(day.date, worker.id)}
                  >
                    <ShiftBadge shift={shift} size="sm" />
                    {entry?.isOverride && <View style={styles.overrideDot} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollOuter: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  workerColHeader: { height: HEADER_HEIGHT },
  dayHeader: {
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayHeaderToday: { backgroundColor: '#EFF6FF' },
  dayHeaderWeekend: { backgroundColor: '#FFF7ED' },
  dayName: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  dayNameWeekend: { color: '#EA580C' },
  dayNum: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  dayNumToday: { color: '#2563EB' },
  workerRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  workerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    height: '100%',
  },
  workerDot: { width: 8, height: 8, borderRadius: 4 },
  workerName: { fontSize: 12, fontWeight: '600', color: '#374151', flex: 1 },
  cell: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderColor: '#F1F5F9',
  },
  cellToday: { backgroundColor: '#EFF6FF' },
  overrideDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6366F1',
  },
});
