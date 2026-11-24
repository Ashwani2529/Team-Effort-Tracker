import type { Deliverable, Snapshot } from '../types';

export function searchDeliverables(snapshot: Snapshot, query: string, items = snapshot.deliverables): Deliverable[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  const members = new Map(snapshot.members.flatMap((member) => [[member._id, member.name], ...(member.legacyId ? [[member.legacyId, member.name] as [string, string]] : [])]));
  const towers = new Map(snapshot.towers.flatMap((tower) => [[tower._id, tower.name], ...(tower.legacyId ? [[tower.legacyId, tower.name] as [string, string]] : [])]));
  const flags = new Map(snapshot.flags.map((flag) => [flag._id, flag.name]));
  return items.filter((item) => [item.title, item.description, item.ticket, members.get(item.primaryAssigneeId || ''), towers.get(item.towerId || ''), ...(item.flagIds || []).map((id) => flags.get(id))].filter(Boolean).join(' ').toLowerCase().includes(normalized));
}
