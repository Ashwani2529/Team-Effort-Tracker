import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface LegacyStarter {
  id: string; ownerId: string; project: { name: string; ref: string; start: string; end: string };
  towers: any[]; members: any[]; dir: any[]; items: any[]; activity: any[];
}
export const EXPECTED_LEGACY = { deliverables: 622, subtasks: 973, members: 20, towers: 9, directory: 20, comments: 622, dependencies: 10, histories: 1882, activity: 1 } as const;

export async function extractLegacyStarter(path: string): Promise<{ starter: LegacyStarter; checksum: string }> {
  const source = await readFile(path, 'utf8'), marker = 'const STARTER=', start = source.indexOf(marker), endMarker = '\nfunction applyStarter';
  if (start < 0) throw new Error('The complete HTML does not contain const STARTER=');
  const end = source.indexOf(endMarker, start); if (end < 0) throw new Error('The STARTER end marker was not found');
  let objectText = source.slice(start + marker.length, end).trim(); if (objectText.endsWith(';')) objectText = objectText.slice(0, -1);
  const starter = JSON.parse(objectText) as LegacyStarter;
  if (starter.id !== 'sbm-delivery-board-2026-11-21' || !Array.isArray(starter.items)) throw new Error('Unexpected legacy dataset identity or shape');
  const counts = legacyCounts(starter);
  for (const [key, expected] of Object.entries(EXPECTED_LEGACY)) if (counts[key as keyof typeof counts] !== expected) throw new Error(`Legacy ${key} count mismatch: expected ${expected}, found ${counts[key as keyof typeof counts]}`);
  return { starter, checksum: createHash('sha256').update(objectText).digest('hex') };
}

export function legacyCounts(starter: LegacyStarter) {
  return {
    deliverables: starter.items.length, subtasks: starter.items.reduce((n, item) => n + (item.subs?.length || 0), 0), members: starter.members.length,
    towers: starter.towers.length, directory: starter.dir.length, comments: starter.items.reduce((n, item) => n + (item.comments?.length || 0), 0),
    dependencies: starter.items.reduce((n, item) => n + (item.deps?.length || 0), 0), histories: starter.items.reduce((n, item) => n + (item.hist?.length || 0), 0), activity: starter.activity.length
  };
}

export function dataQualityWarnings(item: any): string[] {
  const warnings: string[] = [];
  if (!item.ticket) warnings.push('missing_ticket'); if (!item.start) warnings.push('missing_start_date'); if (!item.due) warnings.push('missing_due_date');
  if (!(Number(item.est) > 0) && !(item.subs || []).some((s: any) => Number(s.est) > 0)) warnings.push('missing_estimate');
  if (!item.ownerId) warnings.push('missing_primary_assignee'); if (item.tbd && !item.deployPlan) warnings.push('deployment_plan_missing');
  if ((item.assigneeIds || []).filter((id: string) => id !== item.ownerId).length) warnings.push('multiple_legacy_assignees');
  return warnings;
}
