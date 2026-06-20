-- Ejecutar en el SQL Editor de Supabase para añadir el tipo "baja"
ALTER TABLE schedule_overrides
  DROP CONSTRAINT schedule_overrides_shift_type_check;

ALTER TABLE schedule_overrides
  ADD CONSTRAINT schedule_overrides_shift_type_check
  CHECK (shift_type IN ('M', 'T', 'D', 'vacation', 'AP', 'baja'));
