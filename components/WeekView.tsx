import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/themeContext';
import { DaySchedule, SHIFT_HOURS, SHIFT_LABELS } from '../lib/types';
import { ShiftBadge } from './ShiftBadge';

const DAY_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getDayOfWeekIndex(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

interface Props {
  weekStart: Date;
  schedule: DaySchedule[];
}

export function WeekView({ weekStart, schedule }: Props) {
  const { colors } = useTheme();
  const today = new Date();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgScreen }]} showsVerticalScrollIndicator={false}>
      {schedule.map((day, i) => {
        const date = addDays(weekStart, i);
        const isToday = isSameDay(date, today);
        const dayIdx = getDayOfWeekIndex(date);
        const dayName = DAY_NAMES_ES[dayIdx];
        const dayNum = format(date, 'd');
        const monthName = format(date, 'MMMM', { locale: es });

        const morning = day.entries.filter((e) => e.shift === 'M');
        const afternoon = day.entries.filter((e) => e.shift === 'T');
        const rest = day.entries.filter((e) => e.shift === 'D');
        const special = day.entries.filter((e) => e.shift === 'vacation' || e.shift === 'AP');

        return (
          <View key={day.date} style={[styles.dayCard, { backgroundColor: colors.bgCard, borderColor: isToday ? '#3B82F6' : colors.borderLight }, isToday && styles.dayCardToday]}>
            {/* Header del día */}
            <View style={styles.dayHeader}>
              <View style={[styles.dayBadge, { backgroundColor: isToday ? '#2563EB' : colors.bgSegment }]}>
                <Text style={[styles.dayName, { color: isToday ? '#BFDBFE' : colors.textSub }]}>{dayName}</Text>
                <Text style={[styles.dayNum, { color: isToday ? '#FFFFFF' : colors.text }]}>{dayNum}</Text>
              </View>
              <Text style={[styles.monthLabel, { color: colors.textSub }]}>{monthName}</Text>
              {isToday && (
                <View style={[styles.todayChip, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.todayText, { color: colors.primaryText }]}>Hoy</Text>
                </View>
              )}
            </View>

            {morning.length > 0 && (
              <ShiftGroup label="Mañana" hours={SHIFT_HOURS['M']!} shift="M" entries={morning} colors={colors} />
            )}
            {afternoon.length > 0 && (
              <ShiftGroup label="Tarde" hours={SHIFT_HOURS['T']!} shift="T" entries={afternoon} colors={colors} />
            )}

            {special.length > 0 && (
              <View style={styles.shiftGroup}>
                {special.map((e) => (
                  <View key={e.worker.id} style={styles.specialRow}>
                    <View style={[styles.workerDot, { backgroundColor: e.worker.color }]} />
                    <Text style={[styles.workerText, { color: colors.text }]}>{e.worker.name}</Text>
                    <ShiftBadge shift={e.shift} size="sm" />
                  </View>
                ))}
              </View>
            )}

            {rest.length > 0 && (
              <View style={[styles.restRow, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.restLabel, { color: colors.textMuted }]}>Descanso: </Text>
                <Text style={[styles.restNames, { color: colors.textMuted }]}>
                  {rest.map((e) => e.worker.name).join(', ')}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

import { ThemeColors } from '../lib/theme';

interface ShiftGroupProps {
  label: string;
  hours: string;
  shift: 'M' | 'T';
  entries: DaySchedule['entries'];
  colors: ThemeColors;
}

function ShiftGroup({ label, hours, shift, entries, colors }: ShiftGroupProps) {
  return (
    <View style={styles.shiftGroup}>
      <View style={styles.shiftHeader}>
        <ShiftBadge shift={shift} size="sm" />
        <Text style={[styles.shiftHours, { color: colors.textSub }]}>{hours}</Text>
      </View>
      <View style={styles.workersRow}>
        {entries.map((e) => (
          <View key={e.worker.id} style={[styles.workerChip, { backgroundColor: colors.bgMuted, borderColor: colors.border }]}>
            <View style={[styles.workerDot, { backgroundColor: e.worker.color }]} />
            <Text style={[styles.workerChipText, { color: colors.text }]}>{e.worker.name}</Text>
            {e.isOverride && <View style={styles.overrideDot} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  dayCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dayCardToday: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    shadowOpacity: 0.1,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: { backgroundColor: '#2563EB' },
  dayName: { fontSize: 10, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' },
  dayNameToday: { color: '#BFDBFE' },
  dayNum: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  dayNumToday: { color: '#FFFFFF' },
  monthLabel: { fontSize: 13, color: '#64748B', textTransform: 'capitalize', flex: 1 },
  todayChip: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  todayText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  shiftGroup: { marginTop: 8, gap: 6 },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shiftHours: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  workersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 4 },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workerDot: { width: 8, height: 8, borderRadius: 4 },
  workerChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  overrideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' },
  specialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  workerText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  restRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  restLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  restNames: { fontSize: 12, color: '#CBD5E1' },
});
