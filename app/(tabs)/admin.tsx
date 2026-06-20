import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/themeContext';
import { ShiftBadge } from '../../components/ShiftBadge';
import { SHIFT_COLORS, SHIFT_LABELS, ShiftType, Worker } from '../../lib/types';
import { useUndo } from '../../lib/undoContext';
import {
  useCycleStart,
  useDeleteOverride,
  useDeleteWorker,
  useMonthOverrides,
  useResetRotations,
  useUpdateCycleStart,
  useUpsertOverride,
  useUpsertPeriod,
  useUpsertWorker,
  useWorkers,
  useYearOverrides,
} from '../../hooks/useScheduleData';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DEFAULT_ROTATION } from '../../constants/rotation';
import { computeRotationFixes, getMonthSchedule, getWorkerMonthStats } from '../../lib/schedule';

type AdminTab = 'overrides' | 'workers' | 'config' | 'stats';

export default function AdminScreen() {
  const { isAdmin, loading, signIn, signOut } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('overrides');

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return <LoginScreen onLogin={signIn} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Panel Admin</Text>
        <Pressable style={[styles.signOutBtn, { backgroundColor: colors.dangerBg }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: colors.danger }]}>Salir</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <View style={[styles.tabs, { backgroundColor: colors.bgSegment }]}>
          {(
            [
              { id: 'overrides', label: 'Cambios', icon: 'swap-horizontal-outline' },
              { id: 'workers',   label: 'Equipo',   icon: 'people-outline' },
              { id: 'config',    label: 'Config',   icon: 'settings-outline' },
              { id: 'stats',     label: 'Días',     icon: 'bar-chart-outline' },
            ] as { id: AdminTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[]
          ).map(({ id, label, icon }) => {
            const active = activeTab === id;
            return (
              <Pressable
                key={id}
                style={[styles.tab, active && [styles.tabActive, { backgroundColor: colors.bgSegmentActive }]]}
                onPress={() => setActiveTab(id)}
              >
                <Ionicons name={icon} size={15} color={active ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textMuted }, active && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeTab === 'overrides' && <OverridesTab />}
      {activeTab === 'workers' && <WorkersTab />}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'stats' && <StatsTab />}
    </SafeAreaView>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<any> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const { error: err } = await onLogin(email, password);
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>Acceso Administrador</Text>
        <Text style={styles.loginSubtitle}>Cuadrante de turnos</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginBtnText}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Overrides Tab ───────────────────────────────────────────────────────────

const PERIOD_SHIFTS = [
  { type: 'vacation' as const, label: 'Vacaciones', color: '#065F46', bg: '#D1FAE5' },
  { type: 'AP'       as const, label: 'AP',         color: '#9A3412', bg: '#FFEDD5' },
  { type: 'baja'     as const, label: 'Baja',       color: '#9D174D', bg: '#FCE7F3' },
];

function OverridesTab() {
  const { colors } = useTheme();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const { data: workers = [] } = useWorkers();
  const { data: overrides = [], isLoading } = useMonthOverrides(year, month);
  const deleteOverride = useDeleteOverride();
  const upsertOverride = useUpsertOverride();
  const upsertPeriod = useUpsertPeriod();
  const { push: undoPush } = useUndo();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [showPeriod, setShowPeriod] = useState(false);
  const [pWorker, setPWorker] = useState('');
  const [pFrom, setPFrom] = useState('');
  const [pTo, setPTo] = useState('');
  const [pShift, setPShift] = useState<'vacation' | 'AP' | 'baja'>('vacation');
  const [pNotes, setPNotes] = useState('');

  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w]));

  const pDayCount = React.useMemo(() => {
    if (!pFrom || !pTo || pTo < pFrom) return null;
    try { return differenceInCalendarDays(parseISO(pTo), parseISO(pFrom)) + 1; } catch { return null; }
  }, [pFrom, pTo]);

  const confirmDelete = async (id: string) => {
    const override = overrides.find((o) => o.id === id);
    setPendingId(null);
    try {
      await deleteOverride.mutateAsync(id);
      if (override) {
        const workerName = workerMap[override.worker_id]?.name ?? '';
        undoPush({
          label: `Eliminar ${SHIFT_LABELS[override.shift_type]} de ${workerName} el ${override.date}`,
          execute: () =>
            upsertOverride.mutateAsync({
              worker_id: override.worker_id,
              date: override.date,
              shift_type: override.shift_type,
              notes: override.notes,
            }),
        });
      }
    } catch (_) {}
  };

  const handleSavePeriod = async () => {
    if (!pWorker) { Alert.alert('Selecciona un trabajador'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(pTo)) {
      Alert.alert('Formato incorrecto', 'Usa el formato AAAA-MM-DD (ej: 2026-07-01)'); return;
    }
    if (pTo < pFrom) { Alert.alert('Error', 'La fecha fin debe ser posterior a la fecha inicio'); return; }
    try {
      await upsertPeriod.mutateAsync({ workerId: pWorker, from: pFrom, to: pTo, shiftType: pShift, notes: pNotes });
      setShowPeriod(false);
      setPFrom('');
      setPTo('');
      setPNotes('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar el período');
    }
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
        Cambios — {format(today, 'MMMM yyyy', { locale: es })}
      </Text>
      {overrides.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No hay cambios manuales este mes.</Text>
      ) : (
        overrides.map((o) => {
          const worker = workerMap[o.worker_id];
          const confirming = pendingId === o.id;
          return (
            <View key={o.id} style={[styles.overrideRow, { backgroundColor: colors.bgCard }]}>
              <View style={[styles.workerDot, { backgroundColor: worker?.color ?? '#94A3B8' }]} />
              <View style={styles.overrideInfo}>
                <Text style={[styles.overrideWorker, { color: colors.text }]}>{worker?.name ?? 'Desconocido'}</Text>
                <Text style={[styles.overrideDate, { color: colors.textSub }]}>{o.date}</Text>
                {o.notes ? <Text style={[styles.overrideNote, { color: colors.textMuted }]}>{o.notes}</Text> : null}
              </View>
              {confirming ? (
                <View style={styles.confirmRow}>
                  <Pressable style={[styles.confirmBtnYes, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]} onPress={() => confirmDelete(o.id)}>
                    <Text style={[styles.confirmYesText, { color: colors.danger }]}>Eliminar</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtnNo, { backgroundColor: colors.bgSegment, borderColor: colors.border }]} onPress={() => setPendingId(null)}>
                    <Text style={[styles.confirmNoText, { color: colors.text }]}>No</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ShiftBadge shift={o.shift_type} size="sm" />
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => setPendingId(o.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                  </Pressable>
                </>
              )}
            </View>
          );
        })
      )}

      {/* ── Añadir período ───────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 24 }]}>Añadir período</Text>
      {!showPeriod ? (
        <Pressable
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={() => { setShowPeriod(true); if (!pWorker && workers.length > 0) setPWorker(workers[0].id); }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[styles.addBtnText, { color: colors.primary }]}>Vacaciones / AP / Baja</Text>
        </Pressable>
      ) : (
        <View style={[styles.periodForm, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSub, marginBottom: 6 }]}>Trabajador</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {workers.map((w) => (
                <Pressable
                  key={w.id}
                  style={[styles.workerSelChip, {
                    borderColor: pWorker === w.id ? w.color : colors.border,
                    backgroundColor: pWorker === w.id ? w.color + '22' : colors.bgScreen,
                  }]}
                  onPress={() => setPWorker(w.id)}
                >
                  <View style={[styles.workerDot, { backgroundColor: w.color }]} />
                  <Text style={[styles.workerSelChipText, { color: pWorker === w.id ? colors.text : colors.textSub }]}>{w.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSub, marginBottom: 4 }]}>Desde</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={pFrom}
                onChangeText={setPFrom}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSub, marginBottom: 4 }]}>Hasta</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={pTo}
                onChangeText={setPTo}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {pDayCount !== null && (
            <Text style={[styles.noteText, { color: colors.primary, marginBottom: 10 }]}>
              {pDayCount} {pDayCount === 1 ? 'día' : 'días'} seleccionados
            </Text>
          )}

          <Text style={[styles.label, { color: colors.textSub, marginBottom: 6 }]}>Tipo</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {PERIOD_SHIFTS.map((s) => (
              <Pressable
                key={s.type}
                style={[styles.periodShiftBtn, {
                  borderColor: pShift === s.type ? s.color : colors.border,
                  backgroundColor: pShift === s.type ? s.bg : colors.bgScreen,
                }]}
                onPress={() => setPShift(s.type)}
              >
                <Text style={[styles.periodShiftBtnText, { color: pShift === s.type ? s.color : colors.textSub }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text, marginBottom: 14 }]}
            placeholder="Nota (opcional)"
            placeholderTextColor={colors.textMuted}
            value={pNotes}
            onChangeText={setPNotes}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.btnCancel, { borderColor: colors.border }]} onPress={() => setShowPeriod(false)}>
              <Text style={[styles.btnCancelText, { color: colors.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSave, { backgroundColor: colors.primary }, upsertPeriod.isPending && { opacity: 0.5 }]}
              onPress={handleSavePeriod}
              disabled={upsertPeriod.isPending}
            >
              <Text style={styles.btnSaveText}>{upsertPeriod.isPending ? 'Guardando...' : 'Guardar período'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Workers Tab ─────────────────────────────────────────────────────────────

const WORKER_COLORS = ['#EF4444', '#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];

// Base cycle (ALB offset=0): 5M·4T·5D·5T·4M·5D
const BASE_PATTERN = DEFAULT_ROTATION['ALB'] as ShiftType[];

function rotateBasePattern(offset: number): ShiftType[] {
  return [...BASE_PATTERN.slice(offset), ...BASE_PATTERN.slice(0, offset)];
}

function inferOffset(pattern: ShiftType[]): number {
  for (let i = 0; i < BASE_PATTERN.length; i++) {
    const rotated = [...BASE_PATTERN.slice(i), ...BASE_PATTERN.slice(0, i)];
    if (rotated.every((s, idx) => s === pattern[idx])) return i;
  }
  return -1; // pattern is custom, doesn't match standard cycle
}

function WorkersTab() {
  const { colors } = useTheme();
  const { data: workers = [] } = useWorkers();
  const { data: cycleStart = '2026-06-01' } = useCycleStart();
  const upsertWorker = useUpsertWorker();
  const deleteWorker = useDeleteWorker();

  const { push: undoPush } = useUndo();

  // Rotation editor state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftOffset, setDraftOffset] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete confirmation state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Add worker state
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(WORKER_COLORS[5]);
  const [adding, setAdding] = useState(false);

  // Rotation fix message
  const [rotFixMsg, setRotFixMsg] = useState('');

  // Month stats
  const today = new Date();
  const { data: monthOverrides = [] } = useMonthOverrides(today.getFullYear(), today.getMonth() + 1);
  const monthSchedule = getMonthSchedule(today.getFullYear(), today.getMonth() + 1, workers, monthOverrides, cycleStart);

  const handleExpandWorker = (w: Worker) => {
    if (expandedId === w.id) {
      setExpandedId(null);
    } else {
      setExpandedId(w.id);
      const off = inferOffset(w.rotation_pattern);
      setDraftOffset(off === -1 ? 0 : off);
    }
  };

  const handleSaveOffset = async (w: Worker) => {
    const previousPattern = w.rotation_pattern;
    const previousOffset = inferOffset(previousPattern);
    setSavingId(w.id);
    try {
      await upsertWorker.mutateAsync({ ...w, rotation_pattern: rotateBasePattern(draftOffset) });
      undoPush({
        label: `Rotación de ${w.name}: día ${draftOffset + 1}`,
        execute: () => upsertWorker.mutateAsync({ ...w, rotation_pattern: previousPattern }),
      });

      // Compute and apply rotation fixes for other workers
      const changedWorker = { ...w, rotation_pattern: rotateBasePattern(draftOffset) };
      const allWithChanged = workers.map(wk => wk.id === w.id ? changedWorker : wk);
      const rotFixes = computeRotationFixes(allWithChanged);

      for (const fix of rotFixes) {
        const prev = fix.worker.rotation_pattern;
        await upsertWorker.mutateAsync({ ...fix.worker, rotation_pattern: fix.newPattern });
        undoPush({
          label: `Auto-rotación ${fix.worker.name}`,
          execute: () => upsertWorker.mutateAsync({ ...fix.worker, rotation_pattern: prev }),
        });
      }

      if (rotFixes.length > 0) {
        setRotFixMsg(`Ajuste automático: ${rotFixes.map(f => f.worker.name).join(', ')}`);
        setTimeout(() => setRotFixMsg(''), 4000);
      }

      setExpandedId(null);
    } catch (_) {}
    setSavingId(null);
  };

  const handleConfirmDelete = async (w: Worker) => {
    setPendingDeleteId(null);
    try {
      await deleteWorker.mutateAsync(w.id);
    } catch (_) {}
  };

  const handleAddWorker = () => {
    if (!newName.trim()) return;
    upsertWorker.mutate({
      name: newName.trim().toUpperCase(),
      display_name: newDisplayName.trim() || newName.trim().toUpperCase(),
      color: selectedColor,
      rotation_pattern: DEFAULT_ROTATION['ALB'] ?? Array(28).fill('D'),
      is_active: true,
      sort_order: workers.length + 1,
    });
    setNewName('');
    setNewDisplayName('');
    setAdding(false);
  };

  return (
    <ScrollView style={styles.tabContent}>
      {rotFixMsg ? (
        <View style={[styles.rotFixBanner, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
          <Text style={[styles.rotFixBannerText, { color: colors.success }]}>{rotFixMsg}</Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Trabajadores activos</Text>

      {workers.map((w) => {
        const isExpanded = expandedId === w.id;
        const currentOffset = inferOffset(w.rotation_pattern);
        const isCustom = currentOffset === -1;
        const stats = getWorkerMonthStats(w.id, monthSchedule);

        return (
          <View key={w.id} style={[styles.workerCard, { backgroundColor: colors.bgCard }, isExpanded && styles.workerCardExpanded]}>
            {/* Row */}
            <View style={styles.workerCardRow}>
              <View style={[styles.workerDot, { backgroundColor: w.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.workerName, { color: colors.text }]}>{w.name}</Text>
                <Text style={[styles.workerSubtext, { color: colors.textMuted }]}>
                  {w.is_active
                    ? isCustom
                      ? 'Rotación personalizada'
                      : `Ciclo: día ${currentOffset + 1}/28`
                    : 'Inactivo'}
                </Text>
                <View style={styles.workerStatsRow}>
                  <Text style={[styles.workerStatChip, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>M:{stats.mDays}</Text>
                  <Text style={[styles.workerStatChip, { backgroundColor: '#DBEAFE', color: '#1E40AF' }]}>T:{stats.tDays}</Text>
                  <Text style={[styles.workerStatChip, { backgroundColor: '#F3F4F6', color: '#374151' }]}>∑{stats.total}</Text>
                </View>
              </View>
              {pendingDeleteId === w.id ? (
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmDeleteMsg, { color: colors.danger }]}>¿Eliminar?</Text>
                  <Pressable style={[styles.confirmBtnYes, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]} onPress={() => handleConfirmDelete(w)}>
                    <Text style={[styles.confirmYesText, { color: colors.danger }]}>Sí</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtnNo, { backgroundColor: colors.bgSegment, borderColor: colors.border }]} onPress={() => setPendingDeleteId(null)}>
                    <Text style={[styles.confirmNoText, { color: colors.text }]}>No</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Pressable style={[styles.editRotBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder }]} onPress={() => handleExpandWorker(w)}>
                    <Text style={[styles.editRotBtnText, { color: colors.primary }]}>{isExpanded ? 'Cerrar' : '⟳ Rotación'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleBtn, { backgroundColor: colors.bgSegment }]}
                    onPress={() => upsertWorker.mutate({ ...w, is_active: !w.is_active })}
                  >
                    <Text style={[styles.toggleBtnText, { color: colors.textSub }]}>{w.is_active ? 'Desactivar' : 'Activar'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteWorkerBtn, { backgroundColor: colors.dangerBg }]}
                    onPress={() => { setPendingDeleteId(w.id); setExpandedId(null); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </>
              )}
            </View>

            {/* Rotation editor */}
            {isExpanded && (
              <View style={styles.rotEditor}>
                <Text style={styles.rotEditorLabel}>
                  Día de inicio en el ciclo (desde {cycleStart})
                </Text>
                {isCustom && (
                  <Text style={[styles.noteText, { marginBottom: 8, color: '#F97316' }]}>
                    Este trabajador tiene un patrón personalizado. Guardar lo reemplazará con el ciclo estándar.
                  </Text>
                )}

                {/* 28-chip selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {BASE_PATTERN.map((shift, idx) => {
                      const selected = draftOffset === idx;
                      const colors = SHIFT_COLORS[shift];
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => setDraftOffset(idx)}
                          style={[
                            styles.cycleChip,
                            { backgroundColor: selected ? colors.border : colors.bg, borderColor: colors.border },
                            selected && styles.cycleChipSelected,
                          ]}
                        >
                          <Text style={[styles.cycleChipNum, { color: selected ? '#FFF' : colors.text }]}>
                            {idx + 1}
                          </Text>
                          <Text style={[styles.cycleChipLetter, { color: selected ? '#FFF' : colors.text }]}>
                            {shift}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Preview of selected rotation */}
                <View style={styles.rotPreview}>
                  <Text style={styles.rotPreviewLabel}>Vista previa (28 días desde día {draftOffset + 1}):</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'nowrap' }}>
                      {rotateBasePattern(draftOffset).map((shift, idx) => (
                        <Text
                          key={idx}
                          style={[styles.rotPreviewChip, { color: SHIFT_COLORS[shift].text, backgroundColor: SHIFT_COLORS[shift].bg }]}
                        >
                          {shift}
                        </Text>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable style={styles.btnCancel} onPress={() => setExpandedId(null)}>
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnSave, savingId === w.id && { opacity: 0.5 }]}
                    onPress={() => handleSaveOffset(w)}
                    disabled={savingId === w.id}
                  >
                    <Text style={styles.btnSaveText}>
                      {savingId === w.id ? 'Guardando...' : 'Guardar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {adding ? (
        <View style={styles.addWorkerForm}>
          <Text style={styles.sectionTitle}>Nuevo trabajador</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre corto (ej: JOSE)"
            placeholderTextColor="#94A3B8"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            placeholder="Nombre completo (opcional)"
            placeholderTextColor="#94A3B8"
            value={newDisplayName}
            onChangeText={setNewDisplayName}
          />
          <Text style={styles.label}>Color:</Text>
          <View style={styles.colorPicker}>
            {WORKER_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorDotSelected,
                ]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>
          <Text style={styles.noteText}>
            Patrón de rotación: día 1 del ciclo estándar. Cámbialo después con ⟳ Rotación.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.btnCancel} onPress={() => setAdding(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.btnSave} onPress={handleAddWorker}>
              <Text style={styles.btnSaveText}>Añadir</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addBtnText}>+ Añadir trabajador</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─── Config Tab ──────────────────────────────────────────────────────────────

function ConfigTab() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { data: cycleStart = '2026-06-01' } = useCycleStart();
  const { data: workers = [] } = useWorkers();
  const updateCycleStart = useUpdateCycleStart();
  const resetRotations = useResetRotations();
  const [newDate, setNewDate] = useState('');
  const [editing, setEditing] = useState(false);

  const handleUpdate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      Alert.alert('Formato incorrecto', 'Usa el formato AAAA-MM-DD (ej: 2026-06-01)');
      return;
    }
    Alert.alert(
      'Cambiar fecha de inicio',
      `¿Cambiar la fecha de inicio del ciclo a ${newDate}? Esto afectará a todos los cuadrantes calculados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            updateCycleStart.mutate(newDate);
            setEditing(false);
          },
        },
      ],
    );
  };

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const doReset = async () => {
    setConfirmReset(false);
    try {
      await resetRotations.mutateAsync(workers);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    } catch (_) {}
  };

  return (
    <ScrollView style={styles.tabContent}>
      {/* Apariencia */}
      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Apariencia</Text>
      <View style={[styles.configCard, { backgroundColor: colors.bgCard }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Modo oscuro</Text>
            <Text style={[styles.configNote, { color: colors.textMuted }]}>
              {isDark ? 'Activo — fondo oscuro' : 'Inactivo — fondo claro'}
            </Text>
          </View>
          <Pressable
            onPress={toggleTheme}
            style={[
              styles.themeToggle,
              { backgroundColor: isDark ? colors.primary : colors.bgSegment },
            ]}
          >
            <View style={[styles.themeToggleThumb, { transform: [{ translateX: isDark ? 22 : 2 }] }]} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 24 }]}>Configuración del ciclo</Text>

      <View style={[styles.configCard, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.configLabel, { color: colors.text }]}>Fecha de inicio del ciclo</Text>
        <Text style={[styles.configValue, { color: colors.primary }]}>{cycleStart}</Text>
        <Text style={[styles.configNote, { color: colors.textMuted }]}>
          El cuadrante se calcula a partir de este día como el día 1 del ciclo de 28 días.
        </Text>

        {editing ? (
          <>
            <TextInput
              style={[styles.input, { marginTop: 12, backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={newDate}
              onChangeText={setNewDate}
              keyboardType="numbers-and-punctuation"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable style={styles.btnCancel} onPress={() => setEditing(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnSave} onPress={handleUpdate}>
                <Text style={styles.btnSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            style={[styles.btnSave, { marginTop: 12, alignSelf: 'flex-start' }]}
            onPress={() => {
              setNewDate(cycleStart);
              setEditing(true);
            }}
          >
            <Text style={styles.btnSaveText}>Cambiar fecha</Text>
          </Pressable>
        )}
      </View>

      {/* Restablecer rotación */}
      <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 24 }]}>Rotación de turnos</Text>
      <View style={[styles.configCard, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.configLabel, { color: colors.text }]}>Restablecer horarios originales</Text>
        <Text style={[styles.configNote, { color: colors.textMuted }]}>
          Aplica los patrones de rotación del cuadrante PDF original a todos los trabajadores.
          Útil si los patrones se han corrompido o modificado por error.
        </Text>
        {confirmReset ? (
          <View style={[styles.confirmRow, { marginTop: 12 }]}>
            <Text style={[styles.configNote, { flex: 1 }]}>¿Sobrescribir patrones de todos los trabajadores?</Text>
            <Pressable style={styles.confirmBtnYes} onPress={doReset}>
              <Text style={styles.confirmYesText}>Sí</Text>
            </Pressable>
            <Pressable style={styles.confirmBtnNo} onPress={() => setConfirmReset(false)}>
              <Text style={styles.confirmNoText}>No</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.btnReset, { marginTop: 12 }, resetRotations.isPending && { opacity: 0.5 }]}
            onPress={() => setConfirmReset(true)}
            disabled={resetRotations.isPending}
          >
            <Text style={styles.btnResetText}>
              {resetRotations.isPending
                ? 'Restableciendo...'
                : resetDone
                ? '✓ Restablecido'
                : '↺ Restablecer rotación original'}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Stats Tab ───────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

type WorkerStats = { worker: Worker; mDays: number; tDays: number; total: number; vacDays?: number };

function StatsTable({ rows, showVac }: { rows: WorkerStats[]; showVac?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsTable, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[styles.statsRow, styles.statsHeaderRow, { backgroundColor: colors.bgScreen, borderBottomColor: colors.border }]}>
        <Text style={[styles.statsNameCell, styles.statsHeaderText, { color: colors.textSub }]}>Trabajador</Text>
        <Text style={[styles.statsNumCell, styles.statsHeaderText, { color: colors.textSub }]}>M</Text>
        <Text style={[styles.statsNumCell, styles.statsHeaderText, { color: colors.textSub }]}>T</Text>
        <Text style={[styles.statsNumCell, styles.statsHeaderText, { color: colors.textSub }]}>∑</Text>
        {showVac && <Text style={[styles.statsNumCell, styles.statsHeaderText, { color: colors.textSub }]}>Vac</Text>}
      </View>
      {rows.map((s) => (
        <View key={s.worker.id} style={[styles.statsRow, { borderTopColor: colors.borderLight }]}>
          <View style={[styles.statsNameCell, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <View style={[styles.workerDot, { backgroundColor: s.worker.color }]} />
            <Text style={[styles.statsWorkerText, { color: colors.text }]}>{s.worker.name}</Text>
          </View>
          <Text style={[styles.statsNumCell, styles.statsMVal]}>{s.mDays}</Text>
          <Text style={[styles.statsNumCell, styles.statsTVal]}>{s.tDays}</Text>
          <Text style={[styles.statsNumCell, styles.statsSumVal]}>{s.total}</Text>
          {showVac && (
            <Text style={[styles.statsNumCell, { color: '#065F46', fontWeight: '700', fontSize: 14, textAlign: 'center' }]}>
              {s.vacDays ?? 0}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function FairnessChart({ rows }: { rows: WorkerStats[] }) {
  const { colors } = useTheme();
  const maxM = Math.max(...rows.map((r) => r.mDays), 1);
  const maxT = Math.max(...rows.map((r) => r.tDays), 1);
  return (
    <View style={[styles.statsTable, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[styles.statsRow, styles.statsHeaderRow, { backgroundColor: colors.bgScreen, borderBottomColor: colors.border }]}>
        <Text style={[styles.statsHeaderText, { color: colors.textSub }]}>Distribución de turnos</Text>
      </View>
      {rows.map((r) => (
        <View key={r.worker.id} style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <View style={[styles.workerDot, { backgroundColor: r.worker.color }]} />
            <Text style={[styles.statsWorkerText, { color: colors.text }]}>{r.worker.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1, textAlign: 'right' }}>
              M:{r.mDays}  T:{r.tDays}
            </Text>
          </View>
          <View style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E', width: 12 }}>M</Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgScreen, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((r.mDays / maxM) * 100)}%` as `${number}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 }} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E40AF', width: 12 }}>T</Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgScreen, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((r.tDays / maxT) * 100)}%` as `${number}%`, height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 }} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function StatsTab() {
  const { colors } = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const { data: workers = [] } = useWorkers();
  const { data: cycleStart = '2026-06-01' } = useCycleStart();
  const { data: yearOverrides = [], isLoading } = useYearOverrides(currentYear);

  const monthsData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mo = yearOverrides.filter((o) => parseInt(o.date.slice(5, 7), 10) === month);
      const schedule = getMonthSchedule(currentYear, month, workers, mo, cycleStart);
      return { month, stats: workers.map((w) => ({ worker: w, ...getWorkerMonthStats(w.id, schedule) })) };
    }),
    [currentYear, workers, yearOverrides, cycleStart]
  );

  const annualStats = useMemo(() =>
    workers.map((w) => ({
      worker: w,
      mDays: monthsData.reduce((s, m) => s + (m.stats.find((x) => x.worker.id === w.id)?.mDays ?? 0), 0),
      tDays: monthsData.reduce((s, m) => s + (m.stats.find((x) => x.worker.id === w.id)?.tDays ?? 0), 0),
      total: monthsData.reduce((s, m) => s + (m.stats.find((x) => x.worker.id === w.id)?.total ?? 0), 0),
      vacDays: yearOverrides.filter((o) => o.worker_id === w.id && o.shift_type === 'vacation').length,
    })),
    [workers, monthsData, yearOverrides]
  );

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  const selectedData = monthsData[selectedMonth - 1];

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Total anual {currentYear}</Text>
      <StatsTable rows={annualStats} showVac />

      <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 24 }]}>Desglose por mes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {MONTH_NAMES_SHORT.map((name, i) => {
            const m = i + 1;
            const isSel = selectedMonth === m;
            return (
              <Pressable
                key={m}
                style={[styles.monthChip, { backgroundColor: isSel ? colors.primary : colors.bgSegment, borderColor: isSel ? colors.primary : colors.border }]}
                onPress={() => setSelectedMonth(m)}
              >
                <Text style={[styles.monthChipText, { color: isSel ? '#FFFFFF' : colors.textSub }]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <StatsTable rows={selectedData.stats} />

      <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 24 }]}>Equidad de turnos</Text>
      <FairnessChart rows={selectedData.stats} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', letterSpacing: -0.3 },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
  },
  signOutText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 7,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  tabTextActive: { color: '#2563EB', fontWeight: '700' },
  tabContent: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 40 },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  workerDot: { width: 10, height: 10, borderRadius: 5 },
  overrideInfo: { flex: 1 },
  overrideWorker: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  overrideDate: { fontSize: 12, color: '#64748B' },
  overrideNote: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  workerCardExpanded: {
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  workerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  workerName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  workerSubtext: { fontSize: 12, color: '#94A3B8' },
  workerStatsRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  workerStatChip: { fontSize: 10, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  toggleBtnText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  editRotBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editRotBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  rotEditor: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  rotEditorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  cycleChip: {
    width: 36,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cycleChipSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cycleChipNum: { fontSize: 9, fontWeight: '700' },
  cycleChipLetter: { fontSize: 13, fontWeight: '800' },
  rotPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rotPreviewLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
  rotPreviewChip: {
    width: 22,
    height: 22,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  addBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  addBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  addWorkerForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  colorPicker: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  noteText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', lineHeight: 17 },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  configLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  configValue: { fontSize: 22, fontWeight: '700', color: '#2563EB', marginBottom: 6 },
  configNote: { fontSize: 12, color: '#94A3B8', lineHeight: 18 },
  loginCard: {
    width: '90%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  loginTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  loginSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  errorText: { color: '#DC2626', fontSize: 13 },
  loginBtn: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  btnCancelText: { color: '#374151', fontWeight: '600' },
  btnSave: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  btnSaveText: { color: '#FFFFFF', fontWeight: '700' },
  btnReset: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
  },
  btnResetText: { color: '#92400E', fontWeight: '700', fontSize: 14 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmBtnYes: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  confirmYesText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  confirmBtnNo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmNoText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  rotFixBanner: { backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  rotFixBannerText: { color: '#065F46', fontSize: 12, fontWeight: '600' },
  deleteWorkerBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteWorkerBtnText: { fontSize: 14 },
  confirmDeleteMsg: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginRight: 4 },
  statsTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statsHeaderRow: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statsNameCell: { flex: 3 },
  statsNumCell: { flex: 1, textAlign: 'center' },
  statsHeaderText: { fontSize: 11, fontWeight: '700', color: '#64748B', textAlign: 'center' },
  statsWorkerText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  statsMVal: { color: '#92400E', fontWeight: '700', fontSize: 14 },
  statsTVal: { color: '#1E40AF', fontWeight: '700', fontSize: 14 },
  statsSumVal: { color: '#374151', fontWeight: '700', fontSize: 14 },
  themeToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  themeToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthChipSel: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  monthChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  monthChipTextSel: { color: '#FFFFFF' },
  periodForm: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  workerSelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  workerSelChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  periodShiftBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  periodShiftBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
