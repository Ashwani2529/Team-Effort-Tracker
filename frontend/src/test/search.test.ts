import { describe, expect, it } from 'vitest';
import { searchDeliverables } from '../lib/search';

const snapshot: any = {
  members: [{ _id: 'member-1', name: 'Ashwani Singh' }],
  towers: [{ _id: 'tower-1', name: 'Platform Engineering' }],
  flags: [{ _id: 'flag-1', name: 'Customer blocker', color: '#ef4444' }],
  deliverables: [{ _id: 'task-1', title: 'Upgrade gateway', description: 'API rollout', ticket: 'OPS-42', primaryAssigneeId: 'member-1', towerId: 'tower-1', flagIds: ['flag-1'] }]
};

describe('global deliverable search', () => {
  it.each(['gateway', 'OPS-42', 'ashwani', 'platform', 'customer blocker', 'API rollout'])('finds work by %s', (query) => {
    expect(searchDeliverables(snapshot, query)).toHaveLength(1);
  });
  it('returns no unrelated work', () => expect(searchDeliverables(snapshot, 'finance')).toHaveLength(0));
});
