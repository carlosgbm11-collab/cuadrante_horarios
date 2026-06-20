import { addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { WeekView } from '../../components/WeekView';
import { getDaySchedule } from '../../lib/schedule';
import { exportWeekToPdf } from '../../lib/exportPdf';
import {
  useCycleStart,
  useMonthOverrides,
  useWorkers,
} from '../../hooks/useScheduleData';

export default function WeekScreen() {
  const { colors } = useTheme();
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(today, { weekStartsOn: 1 })
  );
  const [exportingPdf, setExportingPdf] = useState(false);

  const year = weekStart.getFullYear();
  const month = weekStart.getMonth() + 1;
  const nextMonth = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);

  const { data: workers = [], isLoading: loadingWorkers } = useWorkers();
  const { data: overrides1 = [] } = useMonthOverrides(year, month);
  const { data: overrides2 = [] } = useMonthOverrides(nextMonth.getFullYear(), nextMonth.getMonth() + 1);
  const { data: cycleStart = '2026-06-01' } = useCycleStart();

  const allOverrides = [...overrides1, ...overrides2];

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return getDaySchedule(date, workers, allOverrides, cycleStart);
  });

  const weekLabel = format(weekStart, "'Semana del' d 'de' MMMM", { locale: es });

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportWeekToPdf(weekDays, weekLabel);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <Pressable style={[styles.navBtn, { backgroundColor: colors.navBtnBg }]} onPress={() => setWeekStart((w) => subWeeks(w, 1))}>
          <Text style={[styles.navBtnText, { color: colors.navBtnText }]}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.weekLabel, { color: colors.text }]}>{weekLabel}</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.todayBtn, { backgroundColor: colors.primaryBg }]}
              onPress={() => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))}
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Hoy</Text>
            </Pressable>
            <Pressable
              style={[styles.pdfBtn, exportingPdf && { opacity: 0.5 }]}
              onPress={handleExportPdf}
              disabled={exportingPdf}
            >
              <Ionicons name="document-outline" size={15} color="#FFFFFF" />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </Pressable>
          </View>
        </View>
        <Pressable style={[styles.navBtn, { backgroundColor: colors.navBtnBg }]} onPress={() => setWeekStart((w) => addWeeks(w, 1))}>
          <Text style={[styles.navBtnText, { color: colors.navBtnText }]}>›</Text>
        </Pressable>
      </View>

      {loadingWorkers ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <WeekView weekStart={weekStart} schedule={weekDays} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 22, color: '#374151', lineHeight: 26 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  weekLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B', textTransform: 'capitalize' },
  todayBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  todayBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pdfBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
});
