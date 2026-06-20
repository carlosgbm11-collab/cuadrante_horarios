import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ShiftBadge } from '../../components/ShiftBadge';
import { getBaseShift } from '../../lib/schedule';
import { SHIFT_LABELS } from '../../lib/types';
import { useCycleStart, useMonthOverrides, useWorkers } from '../../hooks/useScheduleData';

export default function WorkersScreen() {
  const router = useRouter();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const { data: workers = [], isLoading } = useWorkers();
  const { data: overrides = [] } = useMonthOverrides(year, month);
  const { data: cycleStart = '2026-06-01' } = useCycleStart();

  const getTodayShift = (workerId: string) => {
    const override = overrides.find((o) => o.date === todayStr && o.worker_id === workerId);
    if (override) return { shift: override.shift_type, isOverride: true };
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return { shift: 'D' as const, isOverride: false };
    return { shift: getBaseShift(worker, today, cycleStart), isOverride: false };
  };

  const activeWorkers = workers.filter((w) => w.is_active);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trabajadores</Text>
        <Text style={styles.subtitle}>Hoy — {format(today, "d 'de' MMMM", { locale: require('date-fns/locale/es').es })}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {activeWorkers.map((worker) => {
            const { shift, isOverride } = getTodayShift(worker.id);
            return (
              <Pressable
                key={worker.id}
                style={styles.workerCard}
                onPress={() => router.push(`/worker/${worker.id}`)}
              >
                {/* Avatar con inicial */}
                <View style={[styles.avatar, { backgroundColor: worker.color }]}>
                  <Text style={styles.avatarText}>{worker.name[0]}</Text>
                </View>

                {/* Info */}
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerShiftLabel}>
                    Hoy: {SHIFT_LABELS[shift]}
                    {shift === 'M' ? ' · 8:00-15:00' : shift === 'T' ? ' · 15:00-22:00' : ''}
                    {isOverride ? ' ✏️' : ''}
                  </Text>
                </View>

                {/* Turno badge */}
                <ShiftBadge shift={shift} size="md" />

                {/* Flecha */}
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          })}

          {/* Resumen del día */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen de hoy</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {activeWorkers.filter((w) => getTodayShift(w.id).shift === 'M').length}
                </Text>
                <Text style={styles.summaryLabel}>Mañana</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {activeWorkers.filter((w) => getTodayShift(w.id).shift === 'T').length}
                </Text>
                <Text style={styles.summaryLabel}>Tarde</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {activeWorkers.filter((w) => {
                    const s = getTodayShift(w.id).shift;
                    return s === 'D' || s === 'vacation' || s === 'AP' || s === 'baja';
                  }).length}
                </Text>
                <Text style={styles.summaryLabel}>Fuera</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, padding: 12 },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  workerInfo: { flex: 1 },
  workerName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  workerShiftLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  arrow: { fontSize: 22, color: '#CBD5E1', fontWeight: '300' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  summaryLabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9' },
});
