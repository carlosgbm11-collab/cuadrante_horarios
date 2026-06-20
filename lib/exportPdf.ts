import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DaySchedule } from './types';

const S: Record<string, { bg: string; color: string; label: string }> = {
  M:        { bg: '#FEF3C7', color: '#92400E', label: 'M' },
  T:        { bg: '#DBEAFE', color: '#1E40AF', label: 'T' },
  D:        { bg: '#F3F4F6', color: '#6B7280', label: 'D' },
  vacation: { bg: '#D1FAE5', color: '#065F46', label: 'Vac' },
  AP:       { bg: '#FFEDD5', color: '#9A3412', label: 'AP' },
  baja:     { bg: '#FCE7F3', color: '#9D174D', label: 'Baja' },
};

export async function exportScheduleToPdf(schedule: DaySchedule[], title: string): Promise<void> {
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');

  const workerOrder: string[] = [];
  const workerNames: Record<string, string> = {};
  const workerColors: Record<string, string> = {};
  for (const day of schedule) {
    for (const e of day.entries) {
      if (!workerNames[e.worker.id]) {
        workerOrder.push(e.worker.id);
        workerNames[e.worker.id] = e.worker.name;
        workerColors[e.worker.id] = e.worker.color;
      }
    }
  }

  const headerCells = schedule.map((d) => {
    const date = parseISO(d.date);
    const dow = format(date, 'EEE', { locale: es });
    const num = format(date, 'd');
    const isWe = date.getDay() === 0 || date.getDay() === 6;
    return `<th style="background:${isWe ? '#FFF7ED' : '#EFF6FF'};color:${isWe ? '#EA580C' : '#1E3A5F'};min-width:26px;padding:3px 2px">
      <div style="font-size:9px;text-transform:capitalize">${dow}</div>
      <div style="font-size:13px;font-weight:800">${num}</div>
    </th>`;
  }).join('');

  const dataRows = workerOrder.map((wid) => {
    const cells = schedule.map((d) => {
      const entry = d.entries.find((e) => e.worker.id === wid);
      const shift = entry?.shift ?? 'D';
      const s = S[shift] ?? S.D;
      return `<td style="background:${s.bg};color:${s.color};font-weight:700;text-align:center;padding:4px 2px;font-size:10px">${s.label}</td>`;
    }).join('');
    return `<tr>
      <td style="padding:6px 10px;font-weight:600;white-space:nowrap;font-size:12px;border-right:2px solid #E2E8F0">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${workerColors[wid]};margin-right:5px;vertical-align:middle"></span>${workerNames[wid]}
      </td>
      ${cells}
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Arial,sans-serif;margin:16px;color:#1E293B}
  h1{font-size:16px;font-weight:800;color:#1E3A5F;margin:0 0 12px;text-transform:capitalize}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #E2E8F0}
  thead th:first-child{background:#1E3A5F;color:#FFF;text-align:left;padding:6px 10px;font-size:11px;min-width:70px}
</style>
</head><body>
<h1>${title}</h1>
<table>
<thead><tr><th></th>${headerCells}</tr></thead>
<tbody>${dataRows}</tbody>
</table>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
}
