export interface StatusDates { status: string; completionDate?: string | null; deploymentDate?: string | null }

export function statusDates(current: StatusDates | undefined, nextStatus: string, today: string, requested: Pick<StatusDates, 'completionDate' | 'deploymentDate'> = {}) {
  if (!['done', 'deployed'].includes(nextStatus)) return { completionDate: null, deploymentDate: null };
  if (nextStatus === 'done') return { completionDate: requested.completionDate || current?.completionDate || today, deploymentDate: null };
  if (current && current.status !== 'done' && current.status !== 'deployed') throw Object.assign(new Error('Mark this task as Delivered before deploying it.'), { status: 409, code: 'deliver_first' });
  return { completionDate: requested.completionDate || current?.completionDate || today, deploymentDate: requested.deploymentDate || current?.deploymentDate || today };
}

export function dependencyCreatesCycle(itemId: string, targetId: string, dependencies: Map<string, string[]>) {
  const visit = (id: string, seen: Set<string>): boolean => id === itemId || (!seen.has(id) && (seen.add(id), (dependencies.get(id) || []).some((next) => visit(next, seen))));
  return visit(targetId, new Set());
}

export function subtaskCreatesCycle(parentId: string, childId: string, parents: Map<string, string | undefined>) {
  let cursor: string | undefined = parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === childId) return true;
    seen.add(cursor); cursor = parents.get(cursor);
  }
  return false;
}
