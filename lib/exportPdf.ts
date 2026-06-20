import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Platform } from 'react-native';
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

const SPECIAL_LABEL: Record<string, string> = {
  vacation: 'Vacaciones',
  AP: 'Asuntos Propios',
  baja: 'Baja',
};

const SPECIAL_STYLE: Record<string, { bg: string; color: string }> = {
  vacation: { bg: '#D1FAE5', color: '#065F46' },
  AP:       { bg: '#FFEDD5', color: '#9A3412' },
  baja:     { bg: '#FCE7F3', color: '#9D174D' },
};

export async function exportWeekToPdf(schedule: DaySchedule[], title: string): Promise<void> {
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');

  const DAY_NAMES: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };

  const dayCards = schedule.map((day) => {
    const date = parseISO(day.date);
    const dow = DAY_NAMES[date.getDay()];
    const dayNum = format(date, 'd');
    const monthName = format(date, 'MMMM', { locale: es });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const morning = day.entries.filter((e) => e.shift === 'M');
    const afternoon = day.entries.filter((e) => e.shift === 'T');
    const special = day.entries.filter((e) => ['vacation', 'AP', 'baja'].includes(e.shift));
    const rest = day.entries.filter((e) => e.shift === 'D');

    const workerChip = (name: string, color: string) =>
      `<span style="display:inline-flex;align-items:center;gap:5px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;color:#374151;margin:2px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${name}
      </span>`;

    const shiftSection = (label: string, hours: string, bg: string, textColor: string, entries: DaySchedule['entries']) =>
      entries.length === 0 ? '' : `
      <div style="margin-top:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="background:${bg};color:${textColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${label}</span>
          <span style="font-size:11px;color:#64748B">${hours}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;padding-left:4px">
          ${entries.map((e) => workerChip(e.worker.name, e.worker.color)).join('')}
        </div>
      </div>`;

    const specialSection = special.length === 0 ? '' : `
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
        ${special.map((e) => {
          const st = SPECIAL_STYLE[e.shift] ?? SPECIAL_STYLE.AP;
          const lbl = SPECIAL_LABEL[e.shift] ?? e.shift;
          return `<div style="display:flex;align-items:center;gap:8px;padding-left:4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.worker.color}"></span>
            <span style="font-size:12px;font-weight:600;color:#374151;flex:1">${e.worker.name}</span>
            <span style="background:${st.bg};color:${st.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${lbl}</span>
          </div>`;
        }).join('')}
      </div>`;

    const restSection = rest.length === 0 ? '' : `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #F1F5F9;font-size:12px;color:#94A3B8">
        <span style="font-weight:500">Descanso: </span>${rest.map((e) => e.worker.name).join(', ')}
      </div>`;

    return `
    <div style="background:#FFFFFF;border:1px solid ${isWeekend ? '#FED7AA' : '#E2E8F0'};border-radius:12px;padding:16px;margin-bottom:12px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
        <div style="width:48px;height:48px;border-radius:10px;background:${isWeekend ? '#FFF7ED' : '#F1F5F9'};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
          <div style="font-size:10px;font-weight:600;color:${isWeekend ? '#EA580C' : '#64748B'};text-transform:uppercase">${dow}</div>
          <div style="font-size:20px;font-weight:800;color:${isWeekend ? '#EA580C' : '#1E293B'};line-height:1.2">${dayNum}</div>
        </div>
        <div style="font-size:14px;color:#64748B;text-transform:capitalize">${monthName}</div>
      </div>
      ${shiftSection('Mañana', '8:00 - 15:00', '#FEF3C7', '#92400E', morning)}
      ${shiftSection('Tarde', '15:00 - 22:00', '#DBEAFE', '#1E40AF', afternoon)}
      ${specialSection}
      ${restSection}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 20px; }
  body{font-family:-apple-system,Arial,sans-serif;margin:20px;color:#1E293B;background:#F8FAFC}
  h1{font-size:18px;font-weight:800;color:#1E3A5F;margin:0 0 16px;text-transform:capitalize}
</style>
</head><body>
<h1>${title}</h1>
${dayCards}
</body></html>`;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, width: 595 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
}
