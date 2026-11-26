import { describe, expect, it } from 'vitest';
import { dependencyCreatesCycle, statusDates, subtaskCreatesCycle } from '../services/workflow.js';

describe('deliverable workflow rules', () => {
  it('records delivery and deployment as separate milestones', () => {
    const delivered = statusDates({ status: 'doing' }, 'done', '2026-11-24');
    expect(delivered).toEqual({ completionDate: '2026-11-24', deploymentDate: null });
    const deployed = statusDates({ status: 'done', ...delivered }, 'deployed', '2026-11-26');
    expect(deployed).toEqual({ completionDate: '2026-11-24', deploymentDate: '2026-11-26' });
  });

  it('blocks direct deployment and clears milestones when reopened', () => {
    expect(() => statusDates({ status: 'doing' }, 'deployed', '2026-11-24')).toThrow('Mark this task as Delivered');
    expect(statusDates({ status: 'deployed', completionDate: '2026-11-20', deploymentDate: '2026-11-21' }, 'doing', '2026-11-24')).toEqual({ completionDate: null, deploymentDate: null });
  });

  it('detects dependency and subtask cycles', () => {
    const dependencies = new Map([['a', ['b']], ['b', ['c']], ['c', []]]);
    expect(dependencyCreatesCycle('c', 'a', dependencies)).toBe(true);
    expect(dependencyCreatesCycle('a', 'c', dependencies)).toBe(false);
    const parents = new Map<string, string | undefined>([['b', 'a'], ['c', 'b']]);
    expect(subtaskCreatesCycle('c', 'a', parents)).toBe(true);
    expect(subtaskCreatesCycle('a', 'c', parents)).toBe(false);
  });
});
