import { describe, expect, it } from 'vitest';
import { calculateProjectAnalytics } from '../services/analytics.js';

describe('project analytics', () => {
  it('attributes effort to the assignee and respects roster allocation', () => {
    const result = calculateProjectAnalytics({
      project: { createdAt: new Date('2026-11-01T00:00:00.000Z') }, today: '2026-11-24', month: '2026-11',
      members: [{ _id: 'admin', name: 'Admin', allocationPercent: 100 }, { _id: 'member', name: 'Assignee', allocationPercent: 50 }],
      deliverables: [{ _id: 'task', title: 'Assigned work', primaryAssigneeId: 'member', status: 'doing', startDate: '2026-11-01', dueDate: '2026-11-30', estimatedHours: 8, worklogMinutes: 120 }],
      worklogs: [{ _id: 'log', deliverableId: 'task', memberId: 'admin', workDate: '2026-11-24', minutes: 120 }], leaves: [], overrides: []
    });
    const admin = result.members.find((member) => member.memberId === 'admin')!;
    const assignee = result.members.find((member) => member.memberId === 'member')!;
    expect(admin.todayLogged).toBe(0);
    expect(assignee).toMatchObject({ todayCapacity: 4, todayLogged: 2, todayAvailability: 2, overPlanned: true });
    expect(result.today).toMatchObject({ capacity: 12, logged: 2, availability: 10, adjustedEffort: 1 });
    expect(result.monthTotals.remainingEffort).toBe(6);
    expect(result.minMonth).toBe('2026-11');
  });

  it('recalculates burndown from the current non-deleted dataset', () => {
    const base = { project: { createdAt: new Date('2026-11-01T00:00:00.000Z') }, members: [], worklogs: [], leaves: [], overrides: [], today: '2026-11-24', month: '2026-11' };
    const withTask = calculateProjectAnalytics({ ...base, deliverables: [{ _id: 'task', status: 'doing', startDate: '2026-11-01', dueDate: '2026-11-30', estimatedHours: 10 }] });
    const afterDelete = calculateProjectAnalytics({ ...base, deliverables: [] });
    expect(withTask.burndown[0]!.actual).toBe(10);
    expect(afterDelete.burndown.every((point) => point.actual === 0 && point.ideal === 0)).toBe(true);
  });
});
