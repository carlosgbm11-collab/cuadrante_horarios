import { addMonths, format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { PersonalCalendar } from '../../components/PersonalCalendar';
import { ShiftBadge } from '../../components/ShiftBadge';
import { useAuth } from '../../lib/auth';
import { SHIFT_COLORS, SHIFT_LABELS, ShiftType, SPECIAL_SHIFTS } from '../../lib/types';
import {
  useCycleStart,
  useDeleteOverride,
  useDeletePeriod,
  useUpsertOverride,
  useUpsertPeriod,
  useWorkerOverrides,
  useWorkerUpcomingOverrides,
  useWorkers,
} from '../../hooks/useScheduleData';

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();

  const today = new Date();
  const [viewDate, setViewDate] = useState(today);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const { data: workers = [] } = useWorkers();
  const { data: overrides = [], isLoading } = useWorkerOverrides(id, year, month);
  const { data: upcoming = [] } = useWorkerUpcomingOverrides(id);
  const { data: cycleStart = '2026-06-01' } = useCycleStart();

  const upsertOverride = useUpsertOverride();
  const upsertPeriod = useUpsertPeriod();
  const deleteOverride = useDeleteOverride();
  const deletePeriod = useDeletePeriod();

  const worker = workers.find((w) => w.id === id);

  // Estado del modal de día individual
  const [dayModal, setDayModal] = useState<{
    date: string;
    currentShift: ShiftType;
    overrideId?: string;
  } | null>(null);

  // Estado del modal de período
  const [periodModal, setPeriodModal] = useState(false);

  if (!worker) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#2563EB" />
      </SafeAreaView>
    );
  }

  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: es });

  const handleDayPress = (date: string, currentShift: ShiftType, overrideId?: string) => {
    setDayModal({ date, currentShift, overrideId });
  };

  const handleSaveDay = (shift: ShiftType, notes: string) => {
    if (!dayModal) return;
    upsertOverride.mutate({
      worker_id: id,
      date: dayModal.date,
      shift_type: shift,
      notes: notes || null,
    });
    setDayModal(null);
  };

  const handleDeleteDay = () => {
    if (!dayModal?.overrideId) return;
    Alert.alert('Eliminar cambio', '¿Eliminar el cambio de este día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteOverride.mutate(dayModal.overrideId!);
          setDayModal(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <View style={[styles.workerDot, { backgroundColor: worker.color }]} />
        <Text style={styles.workerName}>{worker.name}</Text>
      </View>

      <ScrollView>
        {/* Navegación de mes */}
        <View style={styles.monthNav}>
          <Pressable style={styles.navBtn} onPress={() => setViewDate((d) => subMonths(d, 1))}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable style={styles.navBtn} onPress={() => setViewDate((d) => addMonths(d, 1))}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* Leyenda */}
        <View style={styles.legend}>
          {(['M', 'T', 'D', 'vacation', 'AP', 'baja'] as ShiftType[]).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SHIFT_COLORS[s].border }]} />
              <Text style={styles.legendText}>{SHIFT_LABELS[s]}</Text>
            </View>
          ))}
        </View>

        {/* Calendario personal */}
        <View style={styles.calendarWrapper}>
          {isLoading ? (
            <ActivityIndicator color="#2563EB" style={{ marginVertical: 40 }} />
          ) : (
            <PersonalCalendar
              year={year}
              month={month}
              worker={worker}
              overrides={overrides}
              cycleStart={cycleStart}
              onDayPress={handleDayPress}
              isAdmin={isAdmin}
            />
          )}
        </View>

        {isAdmin && (
          <View style={styles.adminNote}>
            <Text style={styles.adminNoteText}>Toca cualquier día para cambiar su turno</Text>
          </View>
        )}

        {/* Botón añadir período */}
        {isAdmin && (
          <Pressable style={styles.addPeriodBtn} onPress={() => setPeriodModal(true)}>
            <Text style={styles.addPeriodBtnText}>+ Añadir período de vacaciones / AP / baja</Text>
          </Pressable>
        )}

        {/* Próximos períodos especiales */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximos períodos</Text>
            {groupConsecutiveDays(upcoming).map((group, i) => (
              <View key={i} style={styles.periodRow}>
                <ShiftBadge shift={group.shift} size="md" />
                <View style={styles.periodInfo}>
                  <Text style={styles.periodDates}>
                    {group.from === group.to ? group.from : `${group.from} → ${group.to}`}
                  </Text>
                  <Text style={styles.periodDays}>{group.days} día{group.days > 1 ? 's' : ''}</Text>
                  {group.notes ? <Text style={styles.periodNotes}>{group.notes}</Text> : null}
                </View>
                {isAdmin && (
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() =>
                      Alert.alert('Eliminar período', `¿Eliminar ${group.days} día(s) de ${SHIFT_LABELS[group.shift]}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: () => deletePeriod.mutate({ workerId: id, from: group.from, to: group.to }),
                        },
                      ])
                    }
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal: cambiar día individual */}
      {dayModal && (
        <DayModal
          date={dayModal.date}
          currentShift={dayModal.currentShift}
          hasOverride={!!dayModal.overrideId}
          onSave={handleSaveDay}
          onDelete={handleDeleteDay}
          onClose={() => setDayModal(null)}
        />
      )}

      {/* Modal: añadir período */}
      <PeriodModal
        visible={periodModal}
        workerId={id}
        onSave={(from, to, shift, notes) => {
          upsertPeriod.mutate({ workerId: id, from, to, shiftType: shift, notes });
          setPeriodModal(false);
        }}
        onClose={() => setPeriodModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Modal día individual ────────────────────────────────────────────────────

function DayModal({
  date,
  currentShift,
  hasOverride,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  currentShift: ShiftType;
  hasOverride: boolean;
  onSave: (shift: ShiftType, notes: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ALL_SHIFTS: ShiftType[] = ['M', 'T', 'D', 'vacation', 'AP', 'baja'];
  const [selected, setSelected] = useState<ShiftType>(currentShift);
  const [notes, setNotes] = useState('');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.modalTitle}>Cambiar turno</Text>
        <Text style={styles.modalSubtitle}>{date}</Text>

        <View style={styles.shiftGrid}>
          {ALL_SHIFTS.map((s) => (
            <Pressable
              key={s}
              style={[styles.shiftOption, selected === s && styles.shiftOptionSelected]}
              onPress={() => setSelected(s)}
            >
              <ShiftBadge shift={s} size="sm" />
              <Text style={styles.shiftOptionLabel}>{SHIFT_LABELS[s]}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nota (opcional)"
          placeholderTextColor="#94A3B8"
          value={notes}
          onChangeText={setNotes}
        />

        <View style={styles.modalActions}>
          {hasOverride && (
            <Pressable style={styles.btnDelete} onPress={onDelete}>
              <Text style={styles.btnDeleteText}>Eliminar</Text>
            </Pressable>
          )}
          <Pressable style={styles.btnCancel} onPress={onClose}>
            <Text style={styles.btnCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.btnSave} onPress={() => onSave(selected, notes)}>
            <Text style={styles.btnSaveText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal período ───────────────────────────────────────────────────────────

function PeriodModal({
  visible,
  workerId,
  onSave,
  onClose,
}: {
  visible: boolean;
  workerId: string;
  onSave: (from: string, to: string, shift: ShiftType, notes: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shift, setShift] = useState<ShiftType>('vacation');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      Alert.alert('Formato incorrecto', 'Las fechas deben tener el formato AAAA-MM-DD\nEj: 2026-07-15');
      return;
    }
    if (from > to) {
      Alert.alert('Error', 'La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }
    onSave(from, to, shift, notes);
    setFrom('');
    setTo('');
    setNotes('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.modalTitle}>Añadir período</Text>

        <Text style={styles.fieldLabel}>Tipo</Text>
        <View style={styles.shiftRow}>
          {SPECIAL_SHIFTS.map((s) => (
            <Pressable
              key={s}
              style={[styles.shiftChip, shift === s && styles.shiftChipSelected]}
              onPress={() => setShift(s)}
            >
              <ShiftBadge shift={s} size="sm" />
              <Text style={styles.shiftChipLabel}>{SHIFT_LABELS[s]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Fecha inicio (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-07-01"
          placeholderTextColor="#94A3B8"
          value={from}
          onChangeText={setFrom}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.fieldLabel}>Fecha fin (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-07-15"
          placeholderTextColor="#94A3B8"
          value={to}
          onChangeText={setTo}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.fieldLabel}>Nota (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Vacaciones de verano"
          placeholderTextColor="#94A3B8"
          value={notes}
          onChangeText={setNotes}
        />

        <View style={styles.modalActions}>
          <Pressable style={styles.btnCancel} onPress={onClose}>
            <Text style={styles.btnCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.btnSave} onPress={handleSave}>
            <Text style={styles.btnSaveText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper: agrupar días consecutivos del mismo tipo ───────────────────────

function groupConsecutiveDays(overrides: import('../../lib/types').ScheduleOverride[]) {
  if (!overrides.length) return [];
  const groups: { from: string; to: string; shift: ShiftType; days: number; notes: string | null }[] = [];
  let current = { from: overrides[0].date, to: overrides[0].date, shift: overrides[0].shift_type, days: 1, notes: overrides[0].notes };

  for (let i = 1; i < overrides.length; i++) {
    const o = overrides[i];
    const prevDate = new Date(current.to);
    prevDate.setDate(prevDate.getDate() + 1);
    const isConsecutive = format(prevDate, 'yyyy-MM-dd') === o.date && o.shift_type === current.shift;
    if (isConsecutive) {
      current.to = o.date;
      current.days++;
    } else {
      groups.push(current);
      current = { from: o.date, to: o.date, shift: o.shift_type, days: 1, notes: o.notes };
    }
  }
  groups.push(current);
  return groups;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: { paddingRight: 4 },
  backText: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
  workerDot: { width: 14, height: 14, borderRadius: 7 },
  workerName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 20, color: '#374151' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B', textTransform: 'capitalize' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#64748B' },
  calendarWrapper: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  adminNote: { alignItems: 'center', marginBottom: 8 },
  adminNoteText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  addPeriodBtn: {
    marginHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  addPeriodBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  section: { marginHorizontal: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  periodInfo: { flex: 1 },
  periodDates: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  periodDays: { fontSize: 11, color: '#94A3B8' },
  periodNotes: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  // Modal styles
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6B7280' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  shiftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shiftOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: '45%',
    flex: 1,
  },
  shiftOptionSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  shiftOptionLabel: { fontSize: 12, color: '#374151' },
  shiftRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  shiftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  shiftChipSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  shiftChipLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnDelete: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  btnDeleteText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  btnCancelText: { color: '#374151', fontWeight: '600' },
  btnSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  btnSaveText: { color: '#FFFFFF', fontWeight: '700' },
});
