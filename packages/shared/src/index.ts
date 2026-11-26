import { z } from 'zod';

export const STATUSES = ['backlog', 'todo', 'doing', 'review', 'done', 'deployed'] as const;
export const OPEN_STATUSES = ['todo', 'doing', 'review'] as const;
export const ROLES = ['team', 'admin'] as const;
export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Status = (typeof STATUSES)[number];
export type Role = (typeof ROLES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const roleLabels: Record<Role, string> = {
  team: 'Team member', admin: 'Admin'
};
export const capabilities = {
  edit: ['team', 'admin'], plan: ['team', 'admin'],
  delete: ['admin'], reports: ['admin'], export: ['admin'], admin: ['admin'],
  manageMembers: ['admin'], manageProject: ['admin']
} as const satisfies Record<string, readonly Role[]>;
export type Capability = keyof typeof capabilities;
export const can = (role: Role, capability: Capability): boolean =>
  (capabilities[capability] as readonly Role[]).includes(role);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const deliverableInputSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().max(20000).default(''),
  towerId: z.string().min(1), status: z.enum(STATUSES), priority: z.enum(PRIORITIES),
  primaryAssigneeId: z.string().min(1), contributorIds: z.array(z.string()).default([]),
  flagIds: z.array(z.string()).default([]),
  ticket: z.string().trim().min(1, 'Ticket number or N/A is required'), startDate: date, dueDate: date,
  completionDate: date.nullable().optional(), deploymentDate: date.nullable().optional(), estimatedHours: z.number().min(0),
  blocked: z.boolean().default(false), blockReason: z.string().default(''), toBeDeployed: z.boolean().default(false),
  plannedDeploymentDate: date.nullable().optional(),
  defects: z.number().int().min(0).default(0), escapedDefects: z.number().int().min(0).default(0),
  testsTotal: z.number().int().min(0).default(0), testsAutomated: z.number().int().min(0).default(0),
  automatedDeployment: z.boolean().default(false), hoursSaved: z.number().min(0).default(0)
}).superRefine((value, ctx) => {
  if (value.startDate > value.dueDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot precede start date' });
  if (value.estimatedHours <= 0) ctx.addIssue({ code: 'custom', path: ['estimatedHours'], message: 'Positive estimated effort is required' });
  if ((value.status === 'done' || value.status === 'deployed') && !value.completionDate) ctx.addIssue({ code: 'custom', path: ['completionDate'], message: 'Completion date is required' });
  if (value.status === 'deployed' && !value.deploymentDate) ctx.addIssue({ code: 'custom', path: ['deploymentDate'], message: 'Deployment date is required' });
  if (value.completionDate && value.completionDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['completionDate'], message: 'Completion cannot precede start' });
  if (value.completionDate && value.deploymentDate && value.deploymentDate < value.completionDate) ctx.addIssue({ code: 'custom', path: ['deploymentDate'], message: 'Deployment cannot precede completion' });
  if (value.blocked && !value.blockReason.trim()) ctx.addIssue({ code: 'custom', path: ['blockReason'], message: 'A block reason is required' });
  if (value.toBeDeployed && !value.plannedDeploymentDate) ctx.addIssue({ code: 'custom', path: ['plannedDeploymentDate'], message: 'A deployment plan date is required' });
});
export type DeliverableInput = z.infer<typeof deliverableInputSchema>;

export type PeriodMode = 'day' | 'week' | 'month' | 'custom' | 'active' | 'history';
export interface PeriodRange { from?: string; to?: string; mode: PeriodMode; includeEarlierOverdue?: boolean }
export interface PeriodItem { status: Status; startDate?: string | null; dueDate?: string | null; completionDate?: string | null; deploymentDate?: string | null; createdAt?: string | Date }
export function isInPeriod(item: PeriodItem, range: PeriodRange): boolean {
  if (range.mode === 'history') return true;
  if (range.mode === 'active') return true;
  if (!range.from || !range.to) return true;
  if (item.status === 'done' || item.status === 'deployed') {
    const finished = item.status === 'deployed' ? item.deploymentDate || item.completionDate : item.completionDate;
    return Boolean(finished && finished >= range.from && finished <= range.to);
  }
  if (range.includeEarlierOverdue && item.dueDate && item.dueDate < range.from) return true;
  const created = typeof item.createdAt === 'string' ? item.createdAt.slice(0, 10) : item.createdAt?.toISOString().slice(0, 10);
  const start = item.startDate || item.dueDate || created || range.from;
  const end = item.dueDate || item.startDate || created || range.to;
  return start <= range.to && end >= range.from;
}

export interface EffortItem { estimatedHours?: number; worklogMinutes?: number }
export const effectiveEffort = (item: EffortItem) => ({ estimatedHours: item.estimatedHours ?? 0, actualHours: (item.worklogMinutes ?? 0) / 60 });
export const remainingEffort = (item: EffortItem): number => {
  const effort = effectiveEffort(item); return Math.max(0, effort.estimatedHours - effort.actualHours);
};
