import type { Role, Status } from '@effort-tracker/shared';
export interface PublicProject { _id: string; portfolioId: string; portfolioName: string; name: string; key?: string }
export interface Project { _id: string; portfolioId: string; name: string; key?: string; startDate?: string; endDate?: string; createdAt?: string }
export interface Member { _id: string; legacyId?: string; name: string; email: string; title?: string; department?: string; color?: string; role?: Role; workingDays?: number[]; shiftId?: string; allocationPercent?: number }
export interface Tower { _id: string; legacyId?: string; name: string; color?: string }
export interface Flag { _id: string; name: string; color: string }
export interface Comment { _id: string; authorId?: string; authorName: string; at: string; text: string }
export interface Worklog { _id: string; memberId: string; authorName: string; workDate: string; minutes: number; note: string; createdAt: string }
export type RosterStatus = 'general' | 'night' | 'off' | 'leave';
export interface RosterOverride { _id: string; memberId: string; date: string; shiftId: RosterStatus }
export interface Leave { _id: string; memberId: string; type: string; startDate: string; endDate: string; note?: string; status?: string; source?: string }
export interface Deliverable {
  _id: string; __v: number; legacyId?: string; title: string; description?: string; ticket?: string | null; towerId?: string; flagIds: string[]; primaryAssigneeId?: string;
  contributorIds: string[]; status: Status; priority: 'critical' | 'high' | 'medium' | 'low'; startDate?: string; dueDate?: string; completionDate?: string; deploymentDate?: string;
  estimatedHours: number; legacyActualHours?: number; worklogMinutes: number; blocked?: boolean; blockReason?: string; toBeDeployed?: boolean; plannedDeploymentDate?: string;
  parentDeliverableId?: string; dependencyIds?: string[];
  comments: Comment[]; worklogs: Worklog[]; statusHistory: Array<{ status: Status; at: string }>;
  defects?: number; escapedDefects?: number; testsTotal?: number; testsAutomated?: number; automatedDeployment?: boolean; hoursSaved?: number;
  dataQualityWarnings?: string[]; createdAt: string; updatedAt: string;
}
export interface Notification { _id: string; title: string; body: string; readAt?: string; entityId?: string; createdAt: string }
export interface Snapshot { project: Project; towers: Tower[]; flags: Flag[]; members: Member[]; deliverables: Deliverable[]; leaves: Leave[]; rosterOverrides: RosterOverride[]; activity: any[]; directory: any[]; notifications: Notification[]; access: { role: Role; memberId: string; memberName: string; memberEmail: string; adminVerified: boolean; sessionExpiresAt: number }; serverDate: string }
export interface DailyCapacityPoint { date: string; capacity: number; logged: number; availability: number; overtime: number; adjustedEffort: number }
export interface MemberCapacityPoint { memberId: string; name: string; capacity: number; logged: number; availability: number; overtime: number; todayCapacity: number; todayLogged: number; todayAvailability: number; todayOvertime: number; overPlanned: boolean }
export interface BurndownPoint { date: string; label: string; ideal: number; actual: number; logged: number; variance: number }
export interface ProjectAnalytics {
  month: string; minMonth: string; maxMonth: string;
  today: DailyCapacityPoint & { availableMembers: number; utilization: number };
  monthTotals: { capacity: number; logged: number; availability: number; overtime: number; adjustedEffort: number; utilization: number; estimatedEfforts: number; remainingEffort: number };
  daily: DailyCapacityPoint[]; members: MemberCapacityPoint[]; burndown: BurndownPoint[];
}
