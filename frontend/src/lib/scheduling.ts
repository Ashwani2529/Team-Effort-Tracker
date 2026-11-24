import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { Deliverable, Leave, Member, RosterOverride, RosterStatus } from '../types';

export interface CalendarTaskActivity {
  item: Deliverable;
  markers: Array<'start' | 'due' | 'delivered' | 'deployed'>;
  inTimeline: boolean;
}

export function defaultRosterStatus(date: string): RosterStatus {
  const day = parseISO(date).getDay();
  return day === 0 || day === 6 ? 'off' : 'general';
}

export function rosterStatusFor(member: Pick<Member, '_id' | 'legacyId'>, date: string, overrides: RosterOverride[], leaves: Leave[]): RosterStatus {
  const memberIds = [member._id, member.legacyId].filter(Boolean);
  const onLeave = leaves.some((leave) => memberIds.includes(leave.memberId) && leave.startDate <= date && leave.endDate >= date && !['cancelled', 'rejected'].includes((leave.status || '').toLowerCase()));
  if (onLeave) return 'leave';
  return overrides.find((entry) => entry.memberId === member._id && entry.date === date)?.shiftId || defaultRosterStatus(date);
}

export function calendarActivityForDate(items: Deliverable[], date: string): CalendarTaskActivity[] {
  return items.flatMap((item) => {
    const markers: CalendarTaskActivity['markers'] = [];
    if (item.startDate === date) markers.push('start');
    if (item.dueDate === date) markers.push('due');
    if (item.completionDate === date) markers.push('delivered');
    if (item.deploymentDate === date) markers.push('deployed');
    const start = item.startDate || item.dueDate;
    const end = item.dueDate || item.startDate;
    const inTimeline = Boolean(start && end && start <= end && start <= date && date <= end);
    return inTimeline || markers.length ? [{ item, markers, inTimeline }] : [];
  });
}

export function monthGridDates(month: string): string[] {
  const first = startOfMonth(parseISO(`${month}-01`));
  const from = startOfWeek(first, { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const days: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push(format(date, 'yyyy-MM-dd'));
  return days;
}
