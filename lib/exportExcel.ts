import { format, getDay, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { DaySchedule } from './types';

// ─── Colores (RGB hex sin #) ─────────────────────────────────────────────────
const C = {
  M:         'FEF3C7', // Amarillo mañana
  M_LABEL:   'F59E0B', // Ámbar etiqueta
  T:         'DBEAFE', // Azul tarde
  T_LABEL:   '3B82F6',
  D:         'F3F4F6', // Gris descanso
  D_LABEL:   '9CA3AF',
  VAC:       'D1FAE5', // Verde vacaciones
  VAC_LABEL: '10B981',
  AP:        'FFEDD5', // Naranja AP
  AP_LABEL:  'F97316',
  BAJA:      'FCE7F3', // Rosa baja
  BAJA_LABEL:'EC4899',
  MONTH_HDR: '1E3A5F', // Azul oscuro cabecera mes
  DAY_NUM:   'EFF6FF', // Azul muy claro números
  WEEKEND:   'FFF7ED', // Naranja pálido fines de semana
  WHITE:     'FFFFFF',
  BORDER:    'D1D5DB',
};

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const BLOCK_SIZE = 14; // 14 días por bloque (2 semanas), igual que el PDF

function dayOfWeekIdx(dateStr: string): number {
  const d = getDay(parseISO(dateStr));
  return d === 0 ? 6 : d - 1; // Lun=0 … Dom=6
}

function isWeekend(dateStr: string): boolean {
  const idx = dayOfWeekIdx(dateStr);
  return idx >= 5;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─── Estilo de celda ─────────────────────────────────────────────────────────
function cell(
  v: string | number,
  bgRgb: string,
  textRgb = '111827',
  bold = false,
  align: 'left' | 'center' | 'right' = 'center',
  wrapText = false,
) {
  return {
    v,
    t: typeof v === 'number' ? 'n' : 's',
    s: {
      fill: { fgColor: { rgb: bgRgb } },
      font: { color: { rgb: textRgb }, bold, sz: 10, name: 'Calibri' },
      alignment: { horizontal: align, vertical: 'center', wrapText },
      border: {
        top:    { style: 'thin', color: { rgb: C.BORDER } },
        bottom: { style: 'thin', color: { rgb: C.BORDER } },
        left:   { style: 'thin', color: { rgb: C.BORDER } },
        right:  { style: 'thin', color: { rgb: C.BORDER } },
      },
    },
  };
}

function emptyCell(bgRgb = C.WHITE) {
  return cell('', bgRgb);
}

// ─── Exportar ────────────────────────────────────────────────────────────────
export async function exportScheduleToExcel(
  schedule: DaySchedule[],
  title: string,
): Promise<void> {
  // Importación dinámica para evitar problemas con SSR
  const XLSX = (await import('xlsx-js-style')).default ?? await import('xlsx-js-style');

  const blocks = chunk(schedule, BLOCK_SIZE);

  // Cada bloque produce un conjunto de filas. Las acumulamos todas.
  const wsData: any[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  let rowIdx = 0;

  for (const block of blocks) {
    const n = block.length; // días en el bloque (≤14)

    // ── Por cada día calculamos las listas de trabajadores por turno ──────
    const days = block.map((day) => ({
      date:     day.date,
      num:      parseISO(day.date).getDate(),
      dow:      DAY_NAMES[dayOfWeekIdx(day.date)],
      weekend:  isWeekend(day.date),
      morning:  day.entries.filter((e) => e.shift === 'M').map((e) => e.worker.name),
      afternoon:day.entries.filter((e) => e.shift === 'T').map((e) => e.worker.name),
      descanso: day.entries.filter((e) => e.shift === 'D').map((e) => e.worker.name),
      vacation: day.entries.filter((e) => e.shift === 'vacation').map((e) => e.worker.name),
      ap:       day.entries.filter((e) => e.shift === 'AP').map((e) => e.worker.name),
      baja:     day.entries.filter((e) => e.shift === 'baja').map((e) => e.worker.name),
    }));

    const maxM   = Math.max(...days.map((d) => d.morning.length), 1);
    const maxT   = Math.max(...days.map((d) => d.afternoon.length), 1);
    const maxD   = Math.max(...days.map((d) => d.descanso.length), 1);
    const hasVac = days.some((d) => d.vacation.length > 0);
    const hasAP  = days.some((d) => d.ap.length > 0);
    const hasBaja= days.some((d) => d.baja.length > 0);

    // ── Fila 1: cabecera de mes ───────────────────────────────────────────
    const monthName = format(parseISO(block[0].date), 'MMMM', { locale: es }).toUpperCase();
    const yearStr   = format(parseISO(block[0].date), 'yyyy');
    const monthRow  = [
      cell(`${monthName}  ${yearStr}`, C.MONTH_HDR, C.WHITE, true, 'left'),
      ...days.map((d) => cell(String(d.num), isWeekend(d.date) ? C.WEEKEND : C.DAY_NUM, C.MONTH_HDR, true)),
    ];
    // Merge primera celda de la cabecera si es el primer bloque del mes
    wsData.push(monthRow);
    rowIdx++;

    // ── Fila 2: día de la semana ──────────────────────────────────────────
    const dowRow = [
      emptyCell(C.MONTH_HDR),
      ...days.map((d) => cell(d.dow, d.weekend ? C.WEEKEND : C.DAY_NUM, d.weekend ? 'EA580C' : '1E3A5F', true)),
    ];
    wsData.push(dowRow);
    rowIdx++;

    // ── Filas Mañana ──────────────────────────────────────────────────────
    for (let i = 0; i < maxM; i++) {
      const label = i === 0 ? cell('M\n8-15h', C.M_LABEL, C.WHITE, true, 'center', true) : emptyCell(C.M_LABEL);
      const row = [label, ...days.map((d) => cell(d.morning[i] ?? '', C.M, '92400E'))];
      wsData.push(row);
      rowIdx++;
    }

    // ── Filas Tarde ───────────────────────────────────────────────────────
    for (let i = 0; i < maxT; i++) {
      const label = i === 0 ? cell('T\n15-22h', C.T_LABEL, C.WHITE, true, 'center', true) : emptyCell(C.T_LABEL);
      const row = [label, ...days.map((d) => cell(d.afternoon[i] ?? '', C.T, '1E40AF'))];
      wsData.push(row);
      rowIdx++;
    }

    // ── Filas Descanso ────────────────────────────────────────────────────
    for (let i = 0; i < maxD; i++) {
      const label = i === 0 ? cell('D', C.D_LABEL, C.WHITE, true) : emptyCell(C.D_LABEL);
      const row = [label, ...days.map((d) => cell(d.descanso[i] ?? '', C.D, '6B7280'))];
      wsData.push(row);
      rowIdx++;
    }

    // ── Fila Vacaciones ───────────────────────────────────────────────────
    if (hasVac) {
      const row = [
        cell('Vacaciones', C.VAC_LABEL, C.WHITE, true),
        ...days.map((d) => cell(d.vacation.join('+'), C.VAC, '065F46')),
      ];
      wsData.push(row);
      rowIdx++;
    }

    // ── Fila AP ───────────────────────────────────────────────────────────
    if (hasAP) {
      const row = [
        cell('AP', C.AP_LABEL, C.WHITE, true),
        ...days.map((d) => cell(d.ap.join('+'), C.AP, '9A3412')),
      ];
      wsData.push(row);
      rowIdx++;
    }

    // ── Fila Baja ─────────────────────────────────────────────────────────
    if (hasBaja) {
      const row = [
        cell('Baja', C.BAJA_LABEL, C.WHITE, true),
        ...days.map((d) => cell(d.baja.join('+'), C.BAJA, '9D174D')),
      ];
      wsData.push(row);
      rowIdx++;
    }

    // ── Separador entre bloques ───────────────────────────────────────────
    wsData.push(Array(n + 1).fill(emptyCell(C.WHITE)));
    rowIdx++;
  }

  // ── Construir hoja de cálculo ─────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos de columna
  const maxCols = Math.max(...wsData.map((r) => r.length));
  ws['!cols'] = [
    { wch: 11 }, // etiqueta
    ...Array(maxCols - 1).fill({ wch: 7 }), // días
  ];

  // Altura de filas (filas M y T con salto de línea son más altas)
  ws['!rows'] = wsData.map(() => ({ hpt: 18 }));

  // ── Libro y descarga ──────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  XLSX.writeFile(wb, `${title}.xlsx`);
}

// ─── Helper: rango de fechas → DaySchedule[] ─────────────────────────────────
export function buildScheduleRange(
  from: Date,
  to: Date,
  workers: import('./types').Worker[],
  overrides: import('./types').ScheduleOverride[],
  cycleStart: string,
  getDayScheduleFn: (
    date: Date,
    workers: import('./types').Worker[],
    overrides: import('./types').ScheduleOverride[],
    cycleStart: string,
  ) => DaySchedule,
): DaySchedule[] {
  return eachDayOfInterval({ start: from, end: to }).map((d) =>
    getDayScheduleFn(d, workers, overrides, cycleStart),
  );
}
