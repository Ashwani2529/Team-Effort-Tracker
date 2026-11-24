import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { AuditEvent, Deliverable, DirectoryContact, ImportBatch, LegacyActivity, Member, Organization, Portfolio, Project, Tower } from '../models/index.js';
import { hashPassword } from '../middleware/auth.js';
import { dataQualityWarnings, EXPECTED_LEGACY, extractLegacyStarter, legacyCounts } from '../services/legacy-extractor.js';

const deterministicId = (namespace: string, value: string) => new Types.ObjectId(createHash('sha256').update(`${namespace}:${value}`).digest('hex').slice(0, 24));
const sourcePath = resolve(process.cwd(), env.LEGACY_HTML_PATH), command = process.argv[2] || 'verify', dryRun = process.argv.includes('--dry-run') || process.env.npm_config_dry_run === 'true';

async function context(starter: any) {
  const organization = await Organization.findOne({ slug: 'local' });
  const portfolio = organization && await Portfolio.findOne({ organizationId: organization._id, legacyDatasetId: starter.id });
  const project = portfolio && await Project.findOne({ portfolioId: portfolio._id, legacyDatasetId: starter.id });
  return { organization, portfolio, project };
}

async function verify(starter: any, checksum: string) {
  const { project } = await context(starter); if (!project) throw new Error('Legacy project has not been imported');
  const projectId = project._id;
  const [deliverables, members, towers, directory, activity, stageRows, totals, batch] = await Promise.all([
    Deliverable.countDocuments({ projectId, sourceDatasetId: starter.id, deletedAt: null }), Member.countDocuments({ projectId }), Tower.countDocuments({ projectId }),
    DirectoryContact.countDocuments({ projectId }), LegacyActivity.countDocuments({ projectId }),
    Deliverable.aggregate([{ $match: { projectId, sourceDatasetId: starter.id, deletedAt: null } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Deliverable.aggregate([{ $match: { projectId, sourceDatasetId: starter.id, deletedAt: null } }, { $group: { _id: null, subtasks: { $sum: { $size: '$subtasks' } }, comments: { $sum: { $size: '$comments' } }, dependencies: { $sum: { $size: '$dependencyIds' } }, histories: { $sum: { $size: '$statusHistory' } } } }]),
    ImportBatch.findOne({ projectId, sourceDatasetId: starter.id }).lean()
  ]);
  const total = totals[0] || {}, actual = { deliverables, subtasks: total.subtasks || 0, members, towers, directory, comments: total.comments || 0, dependencies: total.dependencies || 0, histories: total.histories || 0, activity };
  const mismatches = Object.entries(EXPECTED_LEGACY).filter(([key, expected]) => actual[key as keyof typeof actual] !== expected);
  const stageCounts = Object.fromEntries(stageRows.map((row: any) => [row._id, row.count]));
  const dependencyTargets = await Deliverable.find({ projectId, dependencyIds: { $not: { $size: 0 } } }, { dependencyIds: 1 }).lean();
  const targetIds = new Set((await Deliverable.find({ projectId }, { _id: 1 }).lean()).map((item: any) => String(item._id)));
  const unresolved = dependencyTargets.flatMap((item: any) => item.dependencyIds).filter((id: unknown) => !targetIds.has(String(id))).length;
  const report = { datasetId: starter.id, checksum, batchId: batch?._id, expected: EXPECTED_LEGACY, actual, stageCounts, unresolvedDependencies: unresolved, verifiedAt: new Date().toISOString(), ok: mismatches.length === 0 && unresolved === 0 };
  console.log(JSON.stringify(report, null, 2)); if (!report.ok) throw new Error(`Legacy verification failed: ${mismatches.map(([key, expected]) => `${key} expected ${expected}`).join(', ')}; unresolved dependencies ${unresolved}`);
  return report;
}

async function seed(starter: any, checksum: string) {
  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'seed', sourcePath, datasetId: starter.id, checksum, counts: legacyCounts(starter) }, null, 2));
  if (dryRun) return;
  const organization = await Organization.findOneAndUpdate({ slug: 'local' }, { $setOnInsert: { slug: 'local', name: 'Legacy imported organization' } }, { upsert: true, new: true });
  const portfolio = await Portfolio.findOneAndUpdate({ organizationId: organization._id, legacyDatasetId: starter.id }, { $setOnInsert: { name: 'SBM Delivery Portfolio', slug: `sbm-${starter.id}`, description: 'Imported from Portfolio Delivery Hub', settings: {} } }, { upsert: true, new: true });
  const [teamPasswordHash, adminPasswordHash] = await Promise.all([hashPassword(env.LEGACY_PROJECT_PASSWORD), hashPassword(env.LEGACY_ADMIN_PASSWORD)]);
  const project = await Project.findOneAndUpdate({ portfolioId: portfolio._id, legacyDatasetId: starter.id }, { $setOnInsert: { organizationId: organization._id, name: starter.project.name, key: starter.project.ref, startDate: starter.project.start, endDate: starter.project.end, settings: { timeZone: 'Asia/Kolkata' }, teamPasswordHash, adminPasswordHash, passwordVersion: 1, passwordUpdatedAt: new Date() } }, { upsert: true, new: true }).select('+teamPasswordHash +adminPasswordHash');
  if (!project.teamPasswordHash || !project.adminPasswordHash) { project.teamPasswordHash ||= teamPasswordHash; project.adminPasswordHash ||= adminPasswordHash; project.passwordVersion ||= 1; await project.save(); }
  const existingBatch = await ImportBatch.findOne({ projectId: project._id, sourceDatasetId: starter.id, status: 'completed' });
  if (existingBatch) { console.log(`Dataset already imported in batch ${existingBatch._id}; verifying without mutation.`); await verify(starter, checksum); return; }
  const common = { organizationId: organization._id, portfolioId: portfolio._id, projectId: project._id };
  await Tower.bulkWrite(starter.towers.map((tower: any) => ({ updateOne: { filter: { projectId: project._id, legacyId: tower.id }, update: { $setOnInsert: { ...common, legacyId: tower.id, name: tower.name, color: tower.color } }, upsert: true } })));
  await Member.bulkWrite(starter.members.map((member: any) => ({ updateOne: { filter: { projectId: project._id, legacyId: member.id }, update: { $setOnInsert: { ...common, legacyId: member.id, name: member.name, email: member.email, title: member.title, department: member.dept, color: member.color, workingDays: member.days, shiftId: member.shift, allocationPercent: member.alloc, rotates: member.rotate, role: member.access } }, upsert: true } })));
  await DirectoryContact.bulkWrite(starter.dir.map((person: any) => ({ updateOne: { filter: { projectId: project._id, email: person.email }, update: { $setOnInsert: { ...common, name: person.name, email: person.email, title: person.title, department: person.dept, location: person.location, manager: person.manager, phone: person.phone } }, upsert: true } })));
  const memberIds = new Set(starter.members.map((m: any) => m.id));
  const docs = starter.items.map((item: any) => {
    const id = deterministicId(starter.id, item.id), extra = (item.assigneeIds || []).filter((value: string) => value !== item.ownerId && memberIds.has(value));
    return { _id: id, ...common, legacyId: item.id, sourceSystem: 'portfolio-delivery-hub', sourceDatasetId: starter.id, plannerId: item.plannerId,
      title: item.title, ticket: item.ticket || null, towerId: item.towerId || null, primaryAssigneeId: item.ownerId || null, contributorIds: [...new Set(extra)],
      status: item.status, priority: item.priority, startDate: item.start || null, dueDate: item.due || null, completionDate: item.completedOn || null, deploymentDate: item.deployedOn || null,
      estimatedHours: Number(item.est) || 0, legacyActualHours: Number(item.act) || 0, worklogMinutes: 0, legacyEffortMode: item.actMode,
      blocked: Boolean(item.blocked), blockReason: item.reason || '', blockedSince: item.blockedSince ? new Date(item.blockedSince) : null, blockedMilliseconds: Number(item.blockedMs) || 0,
      toBeDeployed: Boolean(item.tbd), plannedDeploymentDate: item.deployPlan || null,
      subtasks: (item.subs || []).map((sub: any) => ({ legacyId: sub.id, title: sub.title, assigneeId: sub.assigneeId || null, estimatedHours: Number(sub.est) || 0, legacyActualHours: Number(sub.act) || 0, status: sub.status })),
      dependencyIds: (item.deps || []).map((dep: string) => String(deterministicId(starter.id, dep))),
      comments: (item.comments || []).map((comment: any) => ({ legacyId: comment.id, authorName: comment.by, at: new Date(comment.t), text: comment.text })),
      statusHistory: (item.hist || []).map((entry: any) => ({ status: entry.s, at: new Date(entry.t), sourceTimestamp: entry.t })), emailAttachments: item.mails || [],
      defects: Number(item.defects) || 0, escapedDefects: Number(item.escaped) || 0, testsTotal: Number(item.testsTotal) || 0, testsAutomated: Number(item.testsAuto) || 0,
      automatedDeployment: Boolean(item.deployAuto), hoursSaved: Number(item.savedHrs) || 0, dataQualityWarnings: dataQualityWarnings(item),
      provenance: { sourceFile: 'portfolio-delivery-hub-COMPLETE.html', sourceDatasetId: starter.id, approximatePlannerHistory: true }, createdAt: new Date(item.created), updatedAt: new Date(item.created) };
  });
  await Deliverable.bulkWrite(docs.map((doc: any) => ({ updateOne: { filter: { projectId: project._id, sourceDatasetId: starter.id, legacyId: doc.legacyId }, update: { $setOnInsert: doc }, upsert: true } })), { ordered: false });
  await LegacyActivity.bulkWrite(starter.activity.map((entry: any) => ({ updateOne: { filter: { projectId: project._id, legacyId: entry.id }, update: { $setOnInsert: { ...common, legacyId: entry.id, at: new Date(entry.t), by: entry.by, text: entry.text, itemLegacyId: entry.itemId } }, upsert: true } })));
  const report = await verify(starter, checksum);
  await ImportBatch.findOneAndUpdate({ projectId: project._id, sourceSystem: 'portfolio-delivery-hub', sourceDatasetId: starter.id }, { $setOnInsert: common, $set: { checksum, status: 'completed', summary: report, completedAt: new Date() } }, { upsert: true, new: true });
  await AuditEvent.create({ ...common, actorMode: 'admin', action: 'legacy.imported', entityType: 'project', entityId: String(project._id), metadata: { checksum, counts: EXPECTED_LEGACY } });
  await verify(starter, checksum);
}

let connected = false;
try {
  const { starter, checksum } = await extractLegacyStarter(sourcePath);
  if (command === 'seed' && dryRun) await seed(starter, checksum);
  else {
    await connectDatabase(); connected = true;
    if (command === 'seed') await seed(starter, checksum); else if (command === 'verify') await verify(starter, checksum); else throw new Error(`Unknown command ${command}`);
  }
} catch (error) { console.error(error); process.exitCode = 1; } finally { if (connected) await disconnectDatabase(); }
