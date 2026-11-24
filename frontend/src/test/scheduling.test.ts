import { describe, expect, it } from 'vitest';
import { calendarActivityForDate, defaultRosterStatus, monthGridDates, rosterStatusFor } from '../lib/scheduling';
import type { Deliverable, Leave, Member, RosterOverride } from '../types';

const member = { _id: 'member-1', legacyId: 'legacy-member', name: 'Taylor', email: 'taylor@example.com' } satisfies Member;
const task = {
  _id: 'task-1', __v: 0, title: 'Calendar delivery', flagIds: [], contributorIds: [], status: 'deployed', priority: 'high',
  startDate: '2026-11-23', dueDate: '2026-11-25', completionDate: '2026-11-26', deploymentDate: '2026-11-27',
  estimatedHours: 8, worklogMinutes: 0, comments: [], worklogs: [], statusHistory: [], createdAt: '2026-11-20', updatedAt: '2026-11-27'
} satisfies Deliverable;

describe('roster scheduling', () => {
  it('defaults weekdays to General and weekends to Off', () => {
    expect(defaultRosterStatus('2026-11-23')).toBe('general');
    expect(defaultRosterStatus('2026-11-28')).toBe('off');
    expect(defaultRosterStatus('2026-11-29')).toBe('off');
  });

  it('uses date overrides while giving approved leave precedence', () => {
    const overrides = [{ _id: 'override-1', memberId: member._id, date: '2026-11-24', shiftId: 'night' }] satisfies RosterOverride[];
    expect(rosterStatusFor(member, '2026-11-24', overrides, [])).toBe('night');
    const leaves = [{ _id: 'leave-1', memberId: member.legacyId!, type: 'leave', startDate: '2026-11-24', endDate: '2026-11-24', status: 'approved' }] satisfies Leave[];
    expect(rosterStatusFor(member, '2026-11-24', overrides, leaves)).toBe('leave');
  });
});

describe('task calendar', () => {
  it('shows every timeline date and later completion/deployment milestones without duplicates', () => {
    expect(calendarActivityForDate([task], '2026-11-24')).toMatchObject([{ inTimeline: true, markers: [] }]);
    expect(calendarActivityForDate([task], '2026-11-25')[0]?.markers).toEqual(['due']);
    expect(calendarActivityForDate([task], '2026-11-26')[0]?.markers).toEqual(['delivered']);
    expect(calendarActivityForDate([task], '2026-11-27')[0]?.markers).toEqual(['deployed']);
    expect(calendarActivityForDate([task], '2026-11-28')).toEqual([]);
  });

  it('builds the complete Monday-first month grid', () => {
    const dates = monthGridDates('2026-11');
    expect(dates[0]).toBe('2026-10-26');
    expect(dates.at(-1)).toBe('2026-12-06');
    expect(dates).toHaveLength(42);
  });
});
