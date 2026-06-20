import { format, getDay, getDaysInMonth, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getBaseShift } from '../lib/schedule';
import { SHIFT_COLORS, SHIFT_LABELS, ScheduleOverride, ShiftType, Worker } from '../lib/types';

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDayOfWeekIndex(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

interface Props {
  year: number;
  month: number;
  worker: Worker;
  overrides: ScheduleOverride[];
  cycleStart: string;
  onDayPress?: (date: string, currentShift: ShiftType, overrideId?: string) => void;
  isAdmin?: boolean;
}

export function PersonalCalendar({ year, month, worker, overrides, cycleStart, onDayPress, isAdmin }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDayIndex = getDayOfWeekIndex(startOfMonth(new Date(year, month - 1)));

  // Build array: nulls for padding + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDayIndex).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const getShiftForDay = (day: number): { shift: ShiftType; isOverride: boolean; overrideId?: string } => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const override = overrides.find((o) => o.date === dateStr);
    if (override) return { shift: override.shift_type, isOverride: true, overrideId: override.id };
    const date = new Date(year, month - 1, day);
    return { shift: getBaseShift(worker, date, cycleStart), isOverride: false };
  };

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      {/* Day headers */}
      <View style={styles.weekHeader}>
        {DAY_NAMES.map((d, i) => (
          <Text key={d} style={[styles.dayName, i >= 5 && styles.dayNameWeekend]}>{d}</Text>
        ))}
      </View>

      {/* Weeks */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.week}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={styles.emptyCell} />;

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { shift, isOverride, overrideId } = getShiftForDay(day);
            const colors = SHIFT_COLORS[shift];
            const isToday = dateStr === today;
            const isWeekend = di >= 5;
            const isSpecial = shift === 'vacation' || shift === 'AP' || shift === 'baja';

            return (
              <Pressable
                key={di}
                style={[
                  styles.cell,
                  isToday && styles.cellToday,
                  isWeekend && !isToday && styles.cellWeekend,
                ]}
                onPress={() => isAdmin && onDayPress?.(dateStr, shift, overrideId)}
              >
                <Text style={[styles.dayNum, isToday && styles.dayNumToday, isWeekend && styles.dayNumWeekend]}>
                  {day}
                </Text>
                <View style={[
                  styles.shiftPill,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  isSpecial && styles.shiftPillSpecial,
                ]}>
                  <Text style={[styles.shiftText, { color: colors.text }, isSpecial && styles.shiftTextSpecial]}>
                    {shift === 'vacation' ? 'VAC' : shift === 'baja' ? 'BAJA' : shift}
                  </Text>
                </View>
                {isOverride && <View style={styles.overrideDot} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4 },
  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    paddingVertical: 6,
  },
  dayNameWeekend: { color: '#EA580C' },
  week: { flexDirection: 'row', marginBottom: 4 },
  emptyCell: { flex: 1 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
    position: 'relative',
  },
  cellToday: { backgroundColor: '#EFF6FF' },
  cellWeekend: { backgroundColor: '#FFF7ED' },
  dayNum: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dayNumToday: { color: '#2563EB' },
  dayNumWeekend: { color: '#EA580C' },
  shiftPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  shiftPillSpecial: { paddingHorizontal: 4, minWidth: 32 },
  shiftText: { fontSize: 9, fontWeight: '700' },
  shiftTextSpecial: { fontSize: 8 },
  overrideDot: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6366F1',
  },
});
