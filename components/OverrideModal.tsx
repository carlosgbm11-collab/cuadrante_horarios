import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../lib/themeContext';
import { ShiftType, Worker, SHIFT_LABELS } from '../lib/types';
import { ShiftBadge } from './ShiftBadge';

const EDITABLE_SHIFTS: ShiftType[] = ['M', 'T', 'D', 'vacation', 'AP', 'baja'];

interface Props {
  visible: boolean;
  date: string | null;
  workerId: string | null;
  workers: Worker[];
  currentShift: ShiftType | null;
  existingOverrideId?: string | null;
  onSave: (params: {
    workerId: string;
    date: string;
    shift: ShiftType;
    notes: string;
  }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function OverrideModal({
  visible,
  date,
  workerId,
  workers,
  currentShift,
  existingOverrideId,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [selectedShift, setSelectedShift] = useState<ShiftType>(currentShift ?? 'vacation');
  const [notes, setNotes] = useState('');

  const worker = workers.find((w) => w.id === workerId);

  React.useEffect(() => {
    if (visible) {
      setSelectedShift(currentShift ?? 'vacation');
      setNotes('');
    }
  }, [visible, currentShift]);

  const { colors } = useTheme();

  if (!date || !workerId || !worker) return null;

  const handleSave = () => {
    onSave({ workerId, date, shift: selectedShift, notes });
    onClose();
  };

  const handleDelete = () => {
    if (!existingOverrideId) return;
    Alert.alert('Eliminar cambio', '¿Eliminar el cambio manual para este día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          onDelete?.(existingOverrideId);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.bgCard }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <Text style={[styles.title, { color: colors.text }]}>
          Cambiar turno — {worker.name}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>{date}</Text>

        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Tipo de turno</Text>
        <View style={styles.shiftGrid}>
          {EDITABLE_SHIFTS.map((shift) => (
            <Pressable
              key={shift}
              style={[
                styles.shiftOption,
                { borderColor: colors.border },
                selectedShift === shift && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
              ]}
              onPress={() => setSelectedShift(shift)}
            >
              <ShiftBadge shift={shift} size="md" />
              <Text style={[styles.shiftOptionLabel, { color: colors.text }]}>{SHIFT_LABELS[shift]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Nota (opcional)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.bgInput, color: colors.text }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Ej: Cambio con ALB"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <View style={styles.actions}>
          {existingOverrideId && (
            <Pressable style={[styles.btnDelete, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]} onPress={handleDelete}>
              <Text style={[styles.btnDeleteText, { color: colors.danger }]}>Eliminar</Text>
            </Pressable>
          )}
          <Pressable style={[styles.btnCancel, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.btnCancelText, { color: colors.text }]}>Cancelar</Text>
          </Pressable>
          <Pressable style={[styles.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <Text style={styles.btnSaveText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 8 },
  shiftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shiftOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: '45%',
    flex: 1,
  },
  shiftOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  shiftOptionLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btnDelete: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  btnDeleteText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  btnCancelText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  btnSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  btnSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
