import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { deliverableInputSchema } from '@effort-tracker/shared';
import { clearProjectSession, hashPassword, sessionFromRequest, setProjectSession, verifyPassword, verifySetupPassword } from '../middleware/auth.js';
import { projectAccess, requireCapability } from '../middleware/access.js';
import { AuditEvent, Deliverable, DirectoryContact, Flag, Leave, LegacyActivity, Member, Notification, Organization, Portfolio, Project, RosterOverride, Tower, Worklog } from '../models/index.js';

const router = Router();
const passwordSchema = z.string().min(8).max(128);
const passwordLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const istDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const scope = (req: any) => ({ organizationId: req.access.organizationId, portfolioId: req.access.portfolioId, projectId: req.access.projectId });
const audit = (req: any, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) => AuditEvent.create({ ...scope(req), actorMode: req.access.role, action, entityType, entityId, before, after });
const canManageEntry = (req: any, memberId: unknown) => req.access.role === 'admin' || String(memberId || '') === String(req.access.memberId);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const taxonomySchema = z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
async function validateFlags(req: any, flagIds: string[]): Promise<string[]> {
  const unique = [...new Set(flagIds)];
  if (!unique.length) return unique;
  const count = await Flag.countDocuments({ ...scope(req), _id: { $in: unique }, archivedAt: null });
  if (count !== unique.length) throw Object.assign(new Error('One or more selected flags are unavailable.'), { status: 400 });
  return unique;
}

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'effort-tracker-api' }));
router.get('/config', (_req, res) => res.json({ access: 'project-password', projectCreationProtected: true }));
router.get('/projects', async (_req, res) => {
  const projects = await Project.find({ archivedAt: null }, { name: 1, key: 1, portfolioId: 1 }).sort({ name: 1 }).lean();
  const portfolios = await Portfolio.find({ _id: { $in: projects.map((project: any) => project.portfolioId) } }, { name: 1 }).lean();
  const names = new Map(portfolios.map((portfolio: any) => [String(portfolio._id), portfolio.name]));
  res.json(projects.map((project: any) => ({ _id: project._id, name: project.name, key: project.key, portfolioId: project.portfolioId, portfolioName: names.get(String(project.portfolioId)) || 'Portfolio' })));
});

router.post('/projects', passwordLimit, async (req, res) => {
  const body = z.object({ applicationPassword: passwordSchema, portfolioName: z.string().trim().min(2).max(120), name: z.string().trim().min(2).max(120), key: z.string().trim().max(12).optional(), startDate: z.string().optional(), endDate: z.string().optional(), creatorName: z.string().trim().min(2).max(120), creatorEmail: z.string().trim().email().transform((value) => value.toLowerCase()), teamPassword: passwordSchema, adminPassword: passwordSchema }).parse(req.body);
  if (!verifySetupPassword(body.applicationPassword)) { res.status(401).json({ error: 'invalid_application_password', message: 'The application-level password is incorrect.' }); return; }
  if (body.teamPassword === body.adminPassword) { res.status(400).json({ error: 'passwords_must_differ', message: 'Team and admin passwords must be different.' }); return; }
  const organization = await Organization.findOneAndUpdate({ slug: 'local' }, { $setOnInsert: { name: 'Effort Tracker', slug: 'local' } }, { upsert: true, new: true });
  const portfolioSlug = slug(body.portfolioName) || `portfolio-${randomUUID().slice(0, 6)}`;
  const portfolio = await Portfolio.findOneAndUpdate({ organizationId: organization._id, slug: portfolioSlug }, { $setOnInsert: { name: body.portfolioName, description: '' } }, { upsert: true, new: true });
  const [teamPasswordHash, adminPasswordHash] = await Promise.all([hashPassword(body.teamPassword), hashPassword(body.adminPassword)]);
  const project = await Project.create({ organizationId: organization._id, portfolioId: portfolio._id, name: body.name, key: body.key, startDate: body.startDate, endDate: body.endDate, teamPasswordHash, adminPasswordHash, passwordVersion: 1, passwordUpdatedAt: new Date(), settings: { timeZone: 'Asia/Kolkata' } });
  const creator = await Member.create({ organizationId: organization._id, portfolioId: portfolio._id, projectId: project._id, name: body.creatorName, email: body.creatorEmail, workingDays: [0, 1, 2, 3, 4], shiftId: 'general', color: '#6d5ce7', allocationPercent: 100 });
  setProjectSession(res, { projectId: String(project._id), memberId: String(creator._id), role: 'admin', adminVerified: true, passwordVersion: project.passwordVersion });
  res.status(201).json({ _id: project._id, name: project.name, key: project.key, portfolioId: portfolio._id, portfolioName: portfolio.name });
});

router.post('/projects/:projectId/unlock', passwordLimit, async (req, res) => {
  const { email, password } = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), password: passwordSchema }).parse(req.body);
  const project = await Project.findById(req.params.projectId).select('+teamPasswordHash');
  if (!project || project.archivedAt) { res.status(404).json({ error: 'project_not_found' }); return; }
  const member = await Member.findOne({ projectId: project._id, email, archivedAt: null });
  if (!member) { res.status(403).json({ error: 'member_not_added', message: 'You are not added to this project. Ask an Admin to add your email to the team.' }); return; }
  if (!await verifyPassword(password, project.teamPasswordHash)) { res.status(401).json({ error: 'invalid_project_password', message: 'The project password is incorrect.' }); return; }
  setProjectSession(res, { projectId: String(project._id), memberId: String(member._id), role: 'team', adminVerified: false, passwordVersion: project.passwordVersion });
  res.json({ role: 'team', member: { _id: member._id, name: member.name, email: member.email } });
});

router.use('/projects/:projectId', projectAccess);

router.post('/projects/:projectId/admin-mode', passwordLimit, async (req, res) => {
  const session = sessionFromRequest(req);
  const { password } = z.object({ password: passwordSchema.optional() }).parse(req.body || {});
  const project = await Project.findById(req.params.projectId).select('+adminPasswordHash');
  if (!project || !session) { res.status(401).json({ error: 'project_password_required' }); return; }
  if (!session.adminVerified && !password) { res.status(401).json({ error: 'admin_password_required', message: 'Enter the project Admin password once to enable Admin mode.' }); return; }
  if (!session.adminVerified && !await verifyPassword(password!, project.adminPasswordHash)) { res.status(401).json({ error: 'invalid_admin_password', message: 'The Admin password is incorrect.' }); return; }
  setProjectSession(res, { ...session, role: 'admin', adminVerified: true });
  res.json({ role: 'admin', adminVerified: true });
});
router.post('/projects/:projectId/team-mode', async (req, res) => {
  const session = sessionFromRequest(req);
  if (!session) { res.status(401).json({ error: 'project_password_required' }); return; }
  setProjectSession(res, { ...session, role: 'team' }); res.json({ role: 'team', adminVerified: session.adminVerified });
});
router.post('/projects/:projectId/lock', (_req, res) => { clearProjectSession(res); res.status(204).end(); });

router.get('/projects/:projectId/snapshot', async (req, res) => {
  const q = scope(req);
  const [project, towers, flags, members, deliverables, worklogs, leaves, rosterOverrides, activity, directory, notifications] = await Promise.all([
    Project.findById(req.params.projectId).lean(), Tower.find({ ...q, archivedAt: null }).sort({ name: 1 }).lean(), Flag.find({ ...q, archivedAt: null }).sort({ name: 1 }).lean(), Member.find({ ...q, archivedAt: null }).sort({ name: 1 }).lean(),
    Deliverable.find({ ...q, deletedAt: null }).sort({ updatedAt: -1 }).lean(), Worklog.find({ ...q, deletedAt: null }).sort({ createdAt: -1 }).lean(), Leave.find(q).lean(), RosterOverride.find(q).sort({ date: 1 }).lean(), LegacyActivity.find(q).sort({ at: -1 }).limit(100).lean(),
    DirectoryContact.find(q).lean(), Notification.find(q).sort({ createdAt: -1 }).limit(50).lean()
  ]);
  const worklogsByDeliverable = new Map<string, any[]>();
  for (const worklog of worklogs) { const key = String(worklog.deliverableId); worklogsByDeliverable.set(key, [...(worklogsByDeliverable.get(key) || []), worklog]); }
  for (const deliverable of deliverables as any[]) deliverable.worklogs = worklogsByDeliverable.get(String(deliverable._id)) || [];
  res.json({ project, towers, flags, members, deliverables, leaves, rosterOverrides, activity, directory, notifications, access: req.access, serverDate: istDate() });
});

router.post('/projects/:projectId/towers', requireCapability('admin'), async (req, res) => {
  const body = taxonomySchema.parse(req.body), tower = await Tower.create({ ...scope(req), ...body });
  await audit(req, 'tower.created', 'tower', String(tower._id), undefined, tower.toObject()); res.status(201).json(tower);
});
router.patch('/projects/:projectId/towers/:id', requireCapability('admin'), async (req, res) => {
  const body = taxonomySchema.parse(req.body), tower = await Tower.findOne({ _id: req.params.id, ...scope(req), archivedAt: null });
  if (!tower) { res.status(404).json({ error: 'tower_not_found' }); return; }
  const before = tower.toObject(); Object.assign(tower, body); await tower.save(); await audit(req, 'tower.updated', 'tower', String(tower._id), before, tower.toObject()); res.json(tower);
});
router.delete('/projects/:projectId/towers/:id', requireCapability('admin'), async (req, res) => {
  const tower = await Tower.findOne({ _id: req.params.id, ...scope(req), archivedAt: null });
  if (!tower) { res.status(404).json({ error: 'tower_not_found' }); return; }
  const references = await Deliverable.countDocuments({ ...scope(req), deletedAt: null, towerId: { $in: [String(tower._id), tower.legacyId].filter(Boolean) } });
  if (references) { res.status(409).json({ error: 'tower_in_use', message: `Move ${references} task${references === 1 ? '' : 's'} to another tower before deleting it.` }); return; }
  await tower.deleteOne(); await audit(req, 'tower.deleted', 'tower', String(tower._id)); res.status(204).end();
});

router.post('/projects/:projectId/flags', requireCapability('admin'), async (req, res) => {
  const body = taxonomySchema.parse(req.body), flag = await Flag.create({ ...scope(req), ...body });
  await audit(req, 'flag.created', 'flag', String(flag._id), undefined, flag.toObject()); res.status(201).json(flag);
});
router.patch('/projects/:projectId/flags/:id', requireCapability('admin'), async (req, res) => {
  const body = taxonomySchema.parse(req.body), flag = await Flag.findOne({ _id: req.params.id, ...scope(req), archivedAt: null });
  if (!flag) { res.status(404).json({ error: 'flag_not_found' }); return; }
  const before = flag.toObject(); Object.assign(flag, body); await flag.save(); await audit(req, 'flag.updated', 'flag', String(flag._id), before, flag.toObject()); res.json(flag);
});
router.delete('/projects/:projectId/flags/:id', requireCapability('admin'), async (req, res) => {
  const flag = await Flag.findOne({ _id: req.params.id, ...scope(req), archivedAt: null });
  if (!flag) { res.status(404).json({ error: 'flag_not_found' }); return; }
  await Deliverable.updateMany({ ...scope(req), flagIds: String(flag._id) }, { $pull: { flagIds: String(flag._id) } }); await flag.deleteOne();
  await audit(req, 'flag.deleted', 'flag', String(flag._id)); res.status(204).end();
});

router.patch('/projects/:projectId/passwords', requireCapability('manageProject'), passwordLimit, async (req, res) => {
  const body = z.object({ teamPassword: passwordSchema.optional(), adminPassword: passwordSchema.optional() }).refine((value) => value.teamPassword || value.adminPassword, 'Provide at least one password').parse(req.body);
  if (body.teamPassword && body.adminPassword && body.teamPassword === body.adminPassword) { res.status(400).json({ error: 'passwords_must_differ' }); return; }
  const project = await Project.findById(req.params.projectId).select('+teamPasswordHash +adminPasswordHash');
  if ((body.teamPassword && await verifyPassword(body.teamPassword, project.adminPasswordHash)) || (body.adminPassword && await verifyPassword(body.adminPassword, project.teamPasswordHash))) { res.status(400).json({ error: 'passwords_must_differ', message: 'Team and admin passwords must be different.' }); return; }
  const update: Record<string, unknown> = { passwordUpdatedAt: new Date() };
  if (body.teamPassword) update.teamPasswordHash = await hashPassword(body.teamPassword);
  if (body.adminPassword) update.adminPasswordHash = await hashPassword(body.adminPassword);
  Object.assign(project, update); project.passwordVersion += 1; await project.save();
  setProjectSession(res, { projectId: String(project._id), memberId: req.access!.memberId, role: 'admin', adminVerified: true, passwordVersion: project.passwordVersion, expiresAt: req.access!.sessionExpiresAt });
  await audit(req, 'project.passwords_changed', 'project', String(project._id));
  res.json({ ok: true, passwordVersion: project.passwordVersion });
});

router.post('/projects/:projectId/members', requireCapability('manageMembers'), async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().transform((value) => value.toLowerCase()), title: z.string().trim().max(120).optional(), department: z.string().trim().max(120).optional(), allocationPercent: z.number().int().min(1).max(100).default(100) }).parse(req.body);
  const member = await Member.create({ ...scope(req), ...body, workingDays: [0, 1, 2, 3, 4], shiftId: 'general', color: '#5b7cfa' });
  await audit(req, 'member.created', 'member', String(member._id), undefined, member.toObject()); res.status(201).json(member);
});

router.put('/projects/:projectId/roster/:memberId/:date', requireCapability('edit'), async (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.params.date);
  const { status } = z.object({ status: z.enum(['general', 'night', 'off', 'leave']) }).parse(req.body);
  const member = await Member.findOne({ _id: req.params.memberId, ...scope(req), archivedAt: null });
  if (!member) { res.status(404).json({ error: 'member_not_found' }); return; }
  if (req.access!.role !== 'admin' && String(member._id) !== String(req.access!.memberId)) {
    res.status(403).json({ error: 'roster_member_forbidden', message: 'Team members can only edit their own roster.' }); return;
  }
  const filter = { ...scope(req), memberId: String(member._id), date };
  const previous = await RosterOverride.findOne(filter).lean();
  const override = await RosterOverride.findOneAndUpdate(filter, { $set: { shiftId: status } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const rosterLeave = { ...scope(req), memberId: String(member._id), startDate: date, endDate: date, source: 'roster' };
  if (status === 'leave') {
    await Leave.findOneAndUpdate(rosterLeave, { $set: { type: 'leave', note: 'Roster leave', status: 'approved' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } else {
    await Leave.deleteMany(rosterLeave);
  }
  await audit(req, 'roster.updated', 'rosterOverride', String(override._id), previous, override.toObject());
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('roster:updated', { memberId: String(member._id), date, status });
  res.json(override);
});

router.post('/projects/:projectId/deliverables', requireCapability('edit'), async (req, res) => {
  const input = deliverableInputSchema.parse(req.body), nowDate = istDate();
  input.flagIds = await validateFlags(req, input.flagIds);
  const completionDate = ['done', 'deployed'].includes(input.status) ? input.completionDate || nowDate : null;
  const deploymentDate = input.status === 'deployed' ? input.deploymentDate || nowDate : null;
  const item = await Deliverable.create({ ...scope(req), ...input, completionDate, deploymentDate, sourceSystem: 'native', contributorIds: [...new Set(input.contributorIds.filter((id) => id !== input.primaryAssigneeId))], statusHistory: [{ status: input.status, at: new Date() }] });
  await audit(req, 'deliverable.created', 'deliverable', String(item._id), undefined, item.toObject()); req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:created', item); res.status(201).json(item);
});

router.put('/projects/:projectId/deliverables/:id', requireCapability('edit'), async (req, res) => {
  const input = deliverableInputSchema.parse(req.body), current = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!current) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const expectedVersion = z.coerce.number().int().parse(req.headers['if-match'] ?? req.body.version ?? current.__v);
  if (current.__v !== expectedVersion) { res.status(409).json({ error: 'version_conflict', current }); return; }
  input.flagIds = await validateFlags(req, input.flagIds);
  const before = current.toObject(), today = istDate(); let completionDate = input.completionDate || null, deploymentDate = input.deploymentDate || null;
  if (['done', 'deployed'].includes(input.status) && !completionDate) completionDate = current.completionDate || today;
  if (input.status === 'deployed' && !deploymentDate) deploymentDate = current.deploymentDate || today;
  if (!['done', 'deployed'].includes(input.status)) { completionDate = null; deploymentDate = null; }
  if (input.status !== 'deployed') deploymentDate = null;
  Object.assign(current, input, { completionDate, deploymentDate, contributorIds: [...new Set(input.contributorIds.filter((id) => id !== input.primaryAssigneeId))] });
  if (before.status !== input.status) current.statusHistory.push({ status: input.status, at: new Date() } as any);
  await current.save(); await audit(req, 'deliverable.updated', 'deliverable', String(current._id), before, current.toObject()); req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', current); res.json(current);
});

router.patch('/projects/:projectId/deliverables/:id/flags', requireCapability('edit'), async (req, res) => {
  const body = z.object({ flagIds: z.array(z.string()), version: z.number().int() }).parse(req.body), flagIds = await validateFlags(req, body.flagIds);
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  if (item.__v !== body.version) { res.status(409).json({ error: 'version_conflict', current: item }); return; }
  const before = item.toObject(); item.flagIds = flagIds; await item.save(); await audit(req, 'deliverable.flags_changed', 'deliverable', String(item._id), before, item.toObject());
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.json(item);
});

router.patch('/projects/:projectId/deliverables/:id/status', requireCapability('edit'), async (req, res) => {
  const { status, version } = z.object({ status: z.enum(['backlog', 'todo', 'doing', 'review', 'done', 'deployed']), version: z.number().int() }).parse(req.body);
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null }); if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  if (item.__v !== version) { res.status(409).json({ error: 'version_conflict', current: item }); return; }
  const before = item.toObject(); item.status = status; item.statusHistory.push({ status, at: new Date() } as any);
  if (status === 'done' || status === 'deployed') item.completionDate ||= istDate(); else { item.completionDate = null; item.deploymentDate = null; }
  if (status === 'deployed') { item.deploymentDate ||= istDate(); item.toBeDeployed = false; } else item.deploymentDate = null;
  await item.save(); await audit(req, 'deliverable.status_changed', 'deliverable', String(item._id), before, item.toObject()); req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.json(item);
});

router.delete('/projects/:projectId/deliverables/:id', requireCapability('delete'), async (req, res) => {
  const item = await Deliverable.findOneAndUpdate({ _id: req.params.id, ...scope(req), deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  await audit(req, 'deliverable.deleted', 'deliverable', String(item._id)); req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:deleted', { id: item._id }); res.status(204).end();
});

router.post('/projects/:projectId/deliverables/:id/comments', requireCapability('edit'), async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(10000) }).parse(req.body);
  const item = await Deliverable.findOneAndUpdate({ _id: req.params.id, ...scope(req), deletedAt: null }, { $push: { comments: { authorId: req.access!.memberId, authorName: req.access!.memberName, at: new Date(), text } } }, { new: true });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  await audit(req, 'comment.created', 'deliverable', String(item._id), undefined, { text }); res.status(201).json(item.comments.at(-1));
});

router.patch('/projects/:projectId/deliverables/:id/comments/:commentId', requireCapability('edit'), async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(10000) }).parse(req.body);
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const comment = (item.comments as any).id(req.params.commentId);
  if (!comment) { res.status(404).json({ error: 'comment_not_found' }); return; }
  if (!canManageEntry(req, comment.authorId)) { res.status(403).json({ error: 'comment_not_owned', message: 'Team members can only edit their own comments.' }); return; }
  const before = comment.toObject(); comment.text = text; await item.save();
  await audit(req, 'comment.updated', 'deliverable', String(item._id), before, comment.toObject());
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.json(comment);
});

router.delete('/projects/:projectId/deliverables/:id/comments/:commentId', requireCapability('edit'), async (req, res) => {
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const comment = (item.comments as any).id(req.params.commentId);
  if (!comment) { res.status(404).json({ error: 'comment_not_found' }); return; }
  if (!canManageEntry(req, comment.authorId)) { res.status(403).json({ error: 'comment_not_owned', message: 'Team members can only delete their own comments.' }); return; }
  const before = comment.toObject(); (item.comments as any).pull({ _id: comment._id }); await item.save();
  await audit(req, 'comment.deleted', 'deliverable', String(item._id), before);
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.status(204).end();
});

router.post('/projects/:projectId/deliverables/:id/worklogs', requireCapability('edit'), async (req, res) => {
  const body = z.object({ workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), minutes: z.number().int().positive().max(1440), note: z.string().trim().min(1).max(1000) }).parse(req.body);
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null }); if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const worklog = await Worklog.create({ ...scope(req), deliverableId: item._id, memberId: req.access!.memberId, authorName: req.access!.memberName, ...body, source: 'manual' }); item.worklogMinutes = (item.worklogMinutes || 0) + body.minutes; await item.save(); await audit(req, 'worklog.created', 'worklog', String(worklog._id), undefined, worklog.toObject()); req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.status(201).json(worklog);
});

router.patch('/projects/:projectId/deliverables/:id/worklogs/:worklogId', requireCapability('edit'), async (req, res) => {
  const body = z.object({ workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), minutes: z.number().int().positive().max(1440), note: z.string().trim().min(1).max(1000) }).parse(req.body);
  const worklog = await Worklog.findOne({ _id: req.params.worklogId, deliverableId: req.params.id, ...scope(req), deletedAt: null });
  if (!worklog) { res.status(404).json({ error: 'worklog_not_found' }); return; }
  if (!canManageEntry(req, (worklog as any).memberId)) { res.status(403).json({ error: 'worklog_not_owned', message: 'Team members can only edit their own worklogs.' }); return; }
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const before = worklog.toObject(), priorMinutes = Number((worklog as any).minutes || 0);
  Object.assign(worklog, body); await worklog.save();
  item.worklogMinutes = Math.max(0, Number(item.worklogMinutes || 0) + body.minutes - priorMinutes); await item.save();
  await audit(req, 'worklog.updated', 'worklog', String(worklog._id), before, worklog.toObject());
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.json(worklog);
});

router.delete('/projects/:projectId/deliverables/:id/worklogs/:worklogId', requireCapability('edit'), async (req, res) => {
  const worklog = await Worklog.findOne({ _id: req.params.worklogId, deliverableId: req.params.id, ...scope(req), deletedAt: null });
  if (!worklog) { res.status(404).json({ error: 'worklog_not_found' }); return; }
  if (!canManageEntry(req, (worklog as any).memberId)) { res.status(403).json({ error: 'worklog_not_owned', message: 'Team members can only delete their own worklogs.' }); return; }
  const item = await Deliverable.findOne({ _id: req.params.id, ...scope(req), deletedAt: null });
  if (!item) { res.status(404).json({ error: 'deliverable_not_found' }); return; }
  const before = worklog.toObject(); (worklog as any).deletedAt = new Date(); await worklog.save();
  item.worklogMinutes = Math.max(0, Number(item.worklogMinutes || 0) - Number((worklog as any).minutes || 0)); await item.save();
  await audit(req, 'worklog.deleted', 'worklog', String(worklog._id), before);
  req.app.get('io')?.to(`project:${req.params.projectId}`).emit('deliverable:updated', item); res.status(204).end();
});

router.patch('/projects/:projectId/notifications/:id/read', async (req, res) => { const notification = await Notification.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, { $set: { readAt: new Date() } }, { new: true }); res.json(notification); });
router.post('/projects/:projectId/notifications/read-all', async (req, res) => { await Notification.updateMany({ ...scope(req), readAt: null }, { $set: { readAt: new Date() } }); res.status(204).end(); });

export default router;
