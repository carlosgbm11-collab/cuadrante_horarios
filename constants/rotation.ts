import { ShiftType } from '../lib/types';

export const CYCLE_LENGTH = 28;

// Ciclo base de 28 días: 5M → 4T → 5D → 5T → 4M → 5D
// Todos siguen el mismo ciclo con distinto punto de entrada,
// garantizando cobertura ≥1M y ≥1T cada día del año.
//
// Verificación de cobertura (todos los 28 días tienen M y T):
//   ALB  off=0  : empieza bloque 5M
//   PEPI off=5  : empieza bloque 4T
//   DIE  off=9  : empieza bloque 5D
//   IGN  off=14 : empieza bloque 5T
//   ALE.M. off=19: empieza bloque 4M
//
// Cada trabajador: 9M + 9T + 10D por ciclo de 28 días.
export const DEFAULT_ROTATION: Record<string, ShiftType[]> = {
  // off=0 → 5M · 4T · 5D · 5T · 4M · 5D
  'ALB': [
    'M','M','M','M','M',
    'T','T','T','T',
    'D','D','D','D','D',
    'T','T','T','T','T',
    'M','M','M','M',
    'D','D','D','D','D',
  ],
  // off=5 → 4T · 5D · 5T · 4M · 5D · 5M
  'PEPI': [
    'T','T','T','T',
    'D','D','D','D','D',
    'T','T','T','T','T',
    'M','M','M','M',
    'D','D','D','D','D',
    'M','M','M','M','M',
  ],
  // off=9 → 5D · 5T · 4M · 5D · 5M · 4T
  'DIE': [
    'D','D','D','D','D',
    'T','T','T','T','T',
    'M','M','M','M',
    'D','D','D','D','D',
    'M','M','M','M','M',
    'T','T','T','T',
  ],
  // off=14 → 5T · 4M · 5D · 5M · 4T · 5D
  'IGN': [
    'T','T','T','T','T',
    'M','M','M','M',
    'D','D','D','D','D',
    'M','M','M','M','M',
    'T','T','T','T',
    'D','D','D','D','D',
  ],
  // off=19 → 4M · 5D · 5M · 4T · 5D · 5T
  'ALE.M.': [
    'M','M','M','M',
    'D','D','D','D','D',
    'M','M','M','M','M',
    'T','T','T','T',
    'D','D','D','D','D',
    'T','T','T','T','T',
  ],
};
