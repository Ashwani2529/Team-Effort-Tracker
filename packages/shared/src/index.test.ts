import { describe, expect, it } from 'vitest';
import { can, deliverableInputSchema, effectiveEffort, isInPeriod, remainingEffort } from './index.js';

describe('legacy-compatible domain rules', () => {
  it('keeps normal work open while protecting premium administration', () => {
    expect(can('team', 'edit')).toBe(true); expect(can('team', 'delete')).toBe(false);
    expect(can('team', 'export')).toBe(false); expect(can('admin', 'admin')).toBe(true);
  });
  it('uses completion or deployment dates for finished periods', () => {
    const range = { mode: 'custom' as const, from: '2026-11-01', to: '2026-11-30' };
    expect(isInPeriod({ status: 'done', completionDate: '2026-11-12' }, range)).toBe(true);
    expect(isInPeriod({ status: 'deployed', completionDate: '2026-10-20', deploymentDate: '2026-11-02' }, range)).toBe(true);
  });
  it('keeps every status visible in the default all-status view', () => {
    expect(isInPeriod({ status: 'done' }, { mode: 'active' })).toBe(true);
    expect(isInPeriod({ status: 'deployed' }, { mode: 'active' })).toBe(true);
  });
  it('uses deliverable estimates and verified worklogs directly', () => {
    const item = { estimatedHours: 12, worklogMinutes: 180 };
    expect(effectiveEffort(item)).toEqual({ estimatedHours: 12, actualHours: 3 }); expect(remainingEffort(item)).toBe(9);
  });
  it('requires dates for a new deployed record', () => {
    expect(deliverableInputSchema.safeParse({ title: 'Release', towerId: 'tower', status: 'deployed', priority: 'high', primaryAssigneeId: 'member', contributorIds: [], ticket: 'N/A', startDate: '2026-11-01', dueDate: '2026-11-10', estimatedHours: 8, blocked: false, toBeDeployed: false }).success).toBe(false);
  });
  it('preserves multiple selected task tags', () => {
    const result = deliverableInputSchema.parse({ title: 'Tagged work', towerId: 'tower', status: 'todo', priority: 'medium', primaryAssigneeId: 'member', contributorIds: [], flagIds: ['red', 'green'], ticket: 'N/A', startDate: '2026-11-01', dueDate: '2026-11-10', estimatedHours: 3, blocked: false, toBeDeployed: false });
    expect(result.flagIds).toEqual(['red', 'green']);
  });
});
