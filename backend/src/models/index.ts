import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

const scope = { organizationId: { type: Schema.Types.ObjectId, required: true, index: true }, portfolioId: { type: Schema.Types.ObjectId, required: true, index: true }, projectId: { type: Schema.Types.ObjectId, required: true, index: true } };
const timestamps = { timestamps: true, optimisticConcurrency: true } as const;
// Mongoose's runtime model cache has a wider generic signature than model().
// This boundary is intentionally dynamic; request and domain data are validated before persistence.
const scopedModel = (name: string, definition: Record<string, unknown>, indexes: Array<[Record<string, 1 | -1>, Record<string, unknown>]> = []): any => {
  const schema = new Schema({ ...scope, ...definition }, timestamps);
  for (const [fields, options] of indexes) schema.index(fields, options);
  return models[name] || model(name, schema);
};

const organizationSchema = new Schema({ slug: { type: String, required: true, unique: true }, name: { type: String, required: true }, archivedAt: Date }, timestamps);
export const Organization: any = models.Organization || model('Organization', organizationSchema);
const portfolioSchema = new Schema({ organizationId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, slug: { type: String, required: true }, description: String, archivedAt: Date, legacyDatasetId: String, settings: Schema.Types.Mixed }, timestamps);
portfolioSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
export const Portfolio: any = models.Portfolio || model('Portfolio', portfolioSchema);
const projectSchema = new Schema({ organizationId: { type: Schema.Types.ObjectId, required: true, index: true }, portfolioId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, key: String, startDate: String, endDate: String, archivedAt: Date, settings: Schema.Types.Mixed, legacyDatasetId: String, teamPasswordHash: { type: String, required: true, select: false }, adminPasswordHash: { type: String, required: true, select: false }, passwordVersion: { type: Number, default: 1 }, passwordUpdatedAt: Date }, timestamps);
projectSchema.index({ portfolioId: 1, name: 1 }, { unique: true });
export const Project: any = models.Project || model('Project', projectSchema);

export const Tower = scopedModel('Tower', { legacyId: String, name: { type: String, required: true }, color: String, archivedAt: Date }, [[{ projectId: 1, name: 1 }, { unique: true }]]);
export const Flag = scopedModel('Flag', { name: { type: String, required: true }, color: { type: String, required: true }, archivedAt: Date }, [[{ projectId: 1, name: 1 }, { unique: true }]]);
export const Member = scopedModel('Member', { legacyId: String, name: { type: String, required: true }, email: { type: String, required: true, lowercase: true }, title: String, department: String, color: String, workingDays: [Number], shiftId: String, allocationPercent: Number, rotates: Boolean, archivedAt: Date }, [[{ projectId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } }], [{ projectId: 1, email: 1 }, { unique: true }]]);
export const DirectoryContact = scopedModel('DirectoryContact', { email: { type: String, lowercase: true }, name: String, title: String, department: String, location: String, manager: String, phone: String }, [[{ projectId: 1, email: 1 }, { unique: true }]]);

const historySchema = new Schema({ status: String, at: Date, sourceTimestamp: Number, changedBy: Schema.Types.ObjectId }, { _id: true });
const commentSchema = new Schema({ legacyId: String, authorName: String, authorId: Schema.Types.ObjectId, at: Date, text: String }, { _id: true });
const deliverableSchema = new Schema({
  ...scope, legacyId: String, sourceSystem: { type: String, default: 'native' }, sourceDatasetId: String, plannerId: String,
  title: { type: String, required: true }, description: String, ticket: String, towerId: String, flagIds: [String], primaryAssigneeId: String,
  contributorIds: [String], status: { type: String, enum: ['backlog', 'todo', 'doing', 'review', 'done', 'deployed'], index: true },
  priority: { type: String, enum: ['high', 'medium', 'low'] }, startDate: String, dueDate: { type: String, index: true }, completionDate: String, deploymentDate: String,
  estimatedHours: Number, legacyActualHours: Number, worklogMinutes: { type: Number, default: 0 }, legacyEffortMode: String,
  blocked: Boolean, blockReason: String, blockedSince: Date, blockedMilliseconds: Number, toBeDeployed: Boolean, plannedDeploymentDate: String,
  comments: [commentSchema], statusHistory: [historySchema], emailAttachments: [Schema.Types.Mixed],
  defects: Number, escapedDefects: Number, testsTotal: Number, testsAutomated: Number, automatedDeployment: Boolean, hoursSaved: Number,
  dataQualityWarnings: [String], provenance: Schema.Types.Mixed, createdBy: Schema.Types.ObjectId, updatedBy: Schema.Types.ObjectId, deletedAt: Date
}, timestamps);
deliverableSchema.index({ projectId: 1, sourceSystem: 1, sourceDatasetId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' }, sourceDatasetId: { $type: 'string' } } });
deliverableSchema.index({ projectId: 1, sourceSystem: 1, plannerId: 1 }, { unique: true, partialFilterExpression: { plannerId: { $type: 'string' } } });
deliverableSchema.index({ projectId: 1, status: 1, dueDate: 1 });
export const Deliverable: any = models.Deliverable || model('Deliverable', deliverableSchema);

export const Worklog = scopedModel('Worklog', { deliverableId: { type: Schema.Types.ObjectId, required: true }, memberId: { type: Schema.Types.ObjectId, required: true }, authorName: { type: String, required: true }, workDate: String, minutes: Number, note: String, source: String, deletedAt: Date }, [[{ projectId: 1, deliverableId: 1, createdAt: -1 }, {}]]);
export const TimerSession = scopedModel('TimerSession', { deliverableId: Schema.Types.ObjectId, subtaskId: Schema.Types.ObjectId, userId: Schema.Types.ObjectId, startedAt: Date, pausedAt: Date, stoppedAt: Date, elapsedSeconds: Number, state: String });
export const Attachment = scopedModel('Attachment', { deliverableId: Schema.Types.ObjectId, fileName: String, storageKey: String, mimeType: String, size: Number, uploadedBy: Schema.Types.ObjectId, deletedAt: Date });
export const AuditEvent = scopedModel('AuditEvent', { actorMode: { type: String, enum: ['team', 'admin'] }, action: String, entityType: String, entityId: String, before: Schema.Types.Mixed, after: Schema.Types.Mixed, metadata: Schema.Types.Mixed }, [[{ projectId: 1, createdAt: -1 }, {}]]);
export const Notification = scopedModel('Notification', { userId: { type: Schema.Types.ObjectId, index: true }, type: String, title: String, body: String, entityType: String, entityId: String, readAt: Date });
export const Leave = scopedModel('Leave', { legacyId: String, memberId: String, type: String, startDate: String, endDate: String, note: String, status: String });
export const Holiday = scopedModel('Holiday', { legacyId: String, name: String, startDate: String, endDate: String });
export const ShiftDefinition = scopedModel('ShiftDefinition', { legacyId: String, name: String, startTime: String, endTime: String, color: String, rotates: Boolean });
export const RosterOverride = scopedModel('RosterOverride', { memberId: String, date: String, shiftId: String }, [[{ projectId: 1, memberId: 1, date: 1 }, { unique: true }]]);
export const ProjectSettings = scopedModel('ProjectSettings', { values: Schema.Types.Mixed }, [[{ projectId: 1 }, { unique: true }]]);
export const ImportBatch = scopedModel('ImportBatch', { sourceSystem: String, sourceDatasetId: String, checksum: String, status: String, summary: Schema.Types.Mixed, warnings: [String], completedAt: Date }, [[{ projectId: 1, sourceSystem: 1, sourceDatasetId: 1 }, { unique: true }]]);
export const ImportRowResult = scopedModel('ImportRowResult', { importBatchId: Schema.Types.ObjectId, rowNumber: Number, sourceId: String, status: String, warnings: [String], targetId: Schema.Types.ObjectId });
export const LegacyActivity = scopedModel('LegacyActivity', { legacyId: String, at: Date, by: String, text: String, itemLegacyId: String });
