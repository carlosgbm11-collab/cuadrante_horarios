import { Ionicons } from '@expo/vector-icons';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MonthCalendar } from '../../components/MonthCalendar';
import { OverrideModal } from '../../components/OverrideModal';
import { exportScheduleToExcel } from '../../lib/exportExcel';
import { exportScheduleToPdf } from '../../lib/exportPdf';
import { useAuth } from '../../lib/auth';
import { computeDateFixes, getMonthSchedule } from '../../lib/schedule';
import { useTheme } from '../../lib/themeContext';
import { ShiftType, SHIFT_LABELS } from '../../lib/types';
import { useUndo } from '../../lib/undoContext';
import {
  useCycleStart,
  useDeleteOverride,
  useMonthOverrides,
  useUpsertOverride,
  useWorkers,
} from '../../hooks/useScheduleData';

export default function MonthScreen() {
  const { colors } = useTheme();
  const today = new Date();
  const [viewDate, setViewDate] = useState(today);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalWorkerId, setModalWorkerId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [autoFixMsg, setAutoFixMsg] = useState('');

  const { isAdmin } = useAuth();
  const { data: workers = [], isLoading: loadingWorkers } = useWorkers();
  const { data: overrides = [], isLoading: loadingOverrides } = useMonthOverrides(year, month);
  const { data: cycleStart = '2026-06-01' } = useCycleStart();
  const upsertOverride = useUpsertOverride();
  const deleteOverride = useDeleteOverride();
  const { push: undoPush } = useUndo();

  const schedule = getMonthSchedule(year, month, workers, overrides, cycleStart);

  const modalEntry =
    modalDate && modalWorkerId
      ? schedule
          .find((d) => d.date === modalDate)
          ?.entries.find((e) => e.worker.id === modalWorkerId)
      : null;

  const existingOverride =
    modalDate && modalWorkerId
      ? overrides.find((o) => o.date === modalDate && o.worker_id === modalWorkerId)
      : null;

  const handleDayPress = (date: string, workerId: string) => {
    setModalDate(date);
    setModalWorkerId(workerId);
  };

  const handleSave = async ({
    workerId,
    date,
    shift,
    notes,
  }: {
    workerId: string;
    date: string;
    shift: ShiftType;
    notes: string;
  }) => {
    const previousOverride =
      overrides.find((o) => o.date === date && o.worker_id === workerId) ?? null;
    const workerName = workers.find((w) => w.id === workerId)?.name ?? '';

    try {
      const saved = await upsertOverride.mutateAsync({
        worker_id: workerId,
        date,
        shift_type: shift,
        notes: notes || null,
      });

      if (previousOverride) {
        undoPush({
          label: `Cambio de ${workerName} el ${date}`,
          execute: () =>
            upsertOverride.mutateAsync({
              worker_id: previousOverride.worker_id,
              date: previousOverride.date,
              shift_type: previousOverride.shift_type,
              notes: previousOverride.notes,
            }),
        });
      } else {
        undoPush({
          label: `${SHIFT_LABELS[shift]} de ${workerName} el ${date}`,
          execute: () => deleteOverride.mutateAsync(saved.id),
        });
      }

      // Auto-fix coverage if this is an absence
      const ABSENCE_TYPES: ShiftType[] = ['vacation', 'AP', 'baja'];
      if (ABSENCE_TYPES.includes(shift)) {
        // Include the new override in the check
        const tempOverrides = [
          ...overrides.filter((o) => !(o.date === date && o.worker_id === workerId)),
          saved,
        ];
        const fixes = computeDateFixes(parseISO(date), workers, tempOverrides, cycleStart);
        for (const fix of fixes) {
          const prevOverride = overrides.find((o) => o.date === date && o.worker_id === fix.workerId) ?? null;
          const fixSaved = await upsertOverride.mutateAsync({
            worker_id: fix.workerId,
            date,
            shift_type: fix.shift,
            notes: `Auto: cobertura por ${workers.find(w=>w.id===workerId)?.name ?? 'ausencia'}`,
          });
          // Push undo for the fix (revert fix by restoring previous)
          undoPush({
            label: `Auto-ajuste ${fix.workerName} ${date}: ${fix.shift}`,
            execute: prevOverride
              ? () => upsertOverride.mutateAsync({ worker_id: prevOverride.worker_id, date: prevOverride.date, shift_type: prevOverride.shift_type, notes: prevOverride.notes })
              : () => deleteOverride.mutateAsync(fixSaved.id),
          });
        }
        if (fixes.length > 0) {
          setAutoFixMsg(`Cobertura ajustada: ${fixes.map(f => `${f.workerName}→${f.shift}`).join(', ')}`);
          setTimeout(() => setAutoFixMsg(''), 4000);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar el cambio.');
    }
  };

  const handleDelete = async (id: string) => {
    const override = overrides.find((o) => o.id === id);
    const workerName = workers.find((w) => w.id === override?.worker_id)?.name ?? '';

    try {
      await deleteOverride.mutateAsync(id);
      if (override) {
        undoPush({
          label: `Eliminar ${SHIFT_LABELS[override.shift_type]} de ${workerName}`,
          execute: () =>
            upsertOverride.mutateAsync({
              worker_id: override.worker_id,
              date: override.date,
              shift_type: override.shift_type,
              notes: override.notes,
            }),
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar el cambio.');
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const label = format(viewDate, 'MMMM yyyy', { locale: es });
      await exportScheduleToExcel(schedule, `Cuadrante ${label}`);
    } catch (e: any) {
      Alert.alert('Error al exportar', e?.message ?? 'No se pudo generar el Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const label = format(viewDate, 'MMMM yyyy', { locale: es });
      await exportScheduleToPdf(schedule, `Cuadrante ${label}`);
    } catch (e: any) {
      Alert.alert('Error al exportar', e?.message ?? 'No se pudo generar el PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: es });
  const isLoading = loadingWorkers || loadingOverrides;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <View style={styles.monthNav}>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.navBtnBg }]} onPress={() => setViewDate((d) => subMonths(d, 1))}>
            <Text style={[styles.navBtnText, { color: colors.navBtnText }]}>‹</Text>
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.navBtnBg }]} onPress={() => setViewDate((d) => addMonths(d, 1))}>
            <Text style={[styles.navBtnText, { color: colors.navBtnText }]}>›</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.exportBtn, { backgroundColor: colors.successBg }, (exporting || isLoading) && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting || isLoading}
        >
          {exporting
            ? <Ionicons name="hourglass-outline" size={18} color={colors.success} />
            : <Ionicons name="download-outline" size={18} color={colors.success} />
          }
        </Pressable>
        <Pressable
          style={[styles.exportBtn, { backgroundColor: colors.primaryBg }, (exportingPdf || isLoading) && styles.exportBtnDisabled]}
          onPress={handleExportPdf}
          disabled={exportingPdf || isLoading}
        >
          {exportingPdf
            ? <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
            : <Ionicons name="document-outline" size={18} color={colors.primary} />
          }
        </Pressable>
      </View>

      {autoFixMsg ? (
        <View style={[styles.autoFixBanner, { backgroundColor: colors.successBg, borderBottomColor: colors.successBorder }]}>
          <Text style={[styles.autoFixBannerText, { color: colors.success }]}>{autoFixMsg}</Text>
        </View>
      ) : null}

      {/* Leyenda */}
      <View style={[styles.legend, { borderBottomColor: colors.borderLight }]}>
        {[
          { label: 'Mañana', color: '#F59E0B' },
          { label: 'Tarde', color: '#3B82F6' },
          { label: 'Descanso', color: '#9CA3AF' },
          { label: 'Vacaciones', color: '#10B981' },
          { label: 'AP', color: '#F97316' },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendText, { color: colors.textSub }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendario */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSub }]}>Cargando cuadrante...</Text>
        </View>
      ) : (
        <MonthCalendar
          year={year}
          month={month}
          workers={workers}
          schedule={schedule}
          onDayPress={handleDayPress}
          isAdmin={isAdmin}
        />
      )}

      {isAdmin && (
        <OverrideModal
          visible={!!modalDate && !!modalWorkerId}
          date={modalDate}
          workerId={modalWorkerId}
          workers={workers}
          currentShift={modalEntry?.shift ?? null}
          existingOverrideId={existingOverride?.id ?? null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setModalDate(null);
            setModalWorkerId(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 20, color: '#374151', lineHeight: 24 },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'capitalize',
    minWidth: 130,
    textAlign: 'center',
  },
  undoBtn: {
    minWidth: 40,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  undoBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  undoBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  undoBtnTextDisabled: { color: '#CBD5E1' },
  exportBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnDisabled: { opacity: 0.4 },
  exportBtnText: { fontSize: 16 },
  undoBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  undoBannerText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  autoFixBanner: { backgroundColor: '#D1FAE5', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#6EE7B7' },
  autoFixBannerText: { color: '#065F46', fontSize: 12, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#64748B' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
});
