import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const integration = process.env.RUN_MONGO_INTEGRATION === '1' ? describe : describe.skip;

integration('member-bound project flow', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
    await connectDatabase(mongo.getUri());
    app.set('io', { to: () => ({ emit: () => undefined }) });
  }, 120_000);

  afterAll(async () => {
    await disconnectDatabase();
    await mongo?.stop();
  });

  it('covers creation, membership, remembered Admin mode, identity, worklogs and finished status', async () => {
    const creator = request.agent(app);
    const created = await creator.post('/api/v1/projects').send({
      applicationPassword: process.env.APP_SETUP_PASSWORD,
      portfolioName: 'Integration Portfolio',
      name: 'Integration Project',
      key: 'INT',
      creatorName: 'Project Creator',
      creatorEmail: 'creator@example.com',
      teamPassword: 'team-password-123',
      adminPassword: 'admin-password-123'
    }).expect(201);
    const projectId = created.body._id;

    let snapshot = await creator.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    expect(snapshot.body.access).toMatchObject({ role: 'admin', memberName: 'Project Creator', adminVerified: true });
    const creatorId = snapshot.body.access.memberId;

    await creator.post(`/api/v1/projects/${projectId}/team-mode`).expect(200);
    await creator.post(`/api/v1/projects/${projectId}/admin-mode`).send({}).expect(200);
    await creator.post(`/api/v1/projects/${projectId}/members`).send({ name: 'Taylor Member', email: 'taylor@example.com', allocationPercent: 100 }).expect(201);

    const member = request.agent(app);
    await member.post(`/api/v1/projects/${projectId}/unlock`).send({ email: 'missing@example.com', password: 'team-password-123' }).expect(403);
    await member.post(`/api/v1/projects/${projectId}/unlock`).send({ email: 'taylor@example.com', password: 'team-password-123' }).expect(200);
    await member.post(`/api/v1/projects/${projectId}/admin-mode`).send({}).expect(401);
    await member.post(`/api/v1/projects/${projectId}/admin-mode`).send({ password: 'admin-password-123' }).expect(200);
    await member.post(`/api/v1/projects/${projectId}/team-mode`).expect(200);
    await member.post(`/api/v1/projects/${projectId}/admin-mode`).send({}).expect(200);

    const tower = await member.post(`/api/v1/projects/${projectId}/towers`).send({ name: 'Platform', color: '#5b7cfa' }).expect(201);
    await member.post(`/api/v1/projects/${projectId}/team-mode`).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    const taylor = snapshot.body.members.find((value: any) => value.email === 'taylor@example.com');
    await member.put(`/api/v1/projects/${projectId}/roster/${creatorId}/2026-11-24`).send({ status: 'night' }).expect(403);
    await member.put(`/api/v1/projects/${projectId}/roster/${taylor._id}/2026-11-24`).send({ status: 'leave' }).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    expect(snapshot.body.rosterOverrides).toContainEqual(expect.objectContaining({ memberId: taylor._id, date: '2026-11-24', shiftId: 'leave' }));
    expect(snapshot.body.leaves).toContainEqual(expect.objectContaining({ memberId: taylor._id, startDate: '2026-11-24', endDate: '2026-11-24', status: 'approved', source: 'roster' }));
    await member.put(`/api/v1/projects/${projectId}/roster/${taylor._id}/2026-11-24`).send({ status: 'night' }).expect(200);
    await creator.put(`/api/v1/projects/${projectId}/roster/${taylor._id}/2026-11-25`).send({ status: 'off' }).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    expect(snapshot.body.leaves).not.toContainEqual(expect.objectContaining({ memberId: taylor._id, startDate: '2026-11-24', source: 'roster' }));
    expect(snapshot.body.rosterOverrides).toEqual(expect.arrayContaining([expect.objectContaining({ memberId: taylor._id, date: '2026-11-24', shiftId: 'night' }), expect.objectContaining({ memberId: taylor._id, date: '2026-11-25', shiftId: 'off' })]));
    const task = await member.post(`/api/v1/projects/${projectId}/deliverables`).send({
      title: 'Ship integration flow', description: '', ticket: 'INT-1', towerId: tower.body._id, status: 'doing', priority: 'high',
      primaryAssigneeId: taylor._id, contributorIds: [], flagIds: [], startDate: '2026-11-24', dueDate: '2026-11-30',
      completionDate: null, deploymentDate: null, estimatedHours: 8, blocked: false, blockReason: '', toBeDeployed: false,
      plannedDeploymentDate: null, defects: 0, escapedDefects: 0, testsTotal: 0, testsAutomated: 0, automatedDeployment: false, hoursSaved: 0
    }).expect(201);

    const comment = await member.post(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/comments`).send({ text: 'Identity is preserved' }).expect(201);
    const worklog = await member.post(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/worklogs`).send({ workDate: '2026-11-24', minutes: 45, note: 'Validated the release path' }).expect(201);
    await member.patch(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/comments/${comment.body._id}`).send({ text: 'Identity and edits are preserved' }).expect(200);
    await member.patch(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/worklogs/${worklog.body._id}`).send({ workDate: '2026-11-25', minutes: 60, note: 'Validated and corrected the release path' }).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    let refreshed = snapshot.body.deliverables.find((value: any) => value._id === task.body._id);
    expect(refreshed.comments.at(-1).authorName).toBe('Taylor Member');
    expect(refreshed.comments.at(-1).text).toBe('Identity and edits are preserved');
    expect(refreshed.worklogs[0]).toMatchObject({ authorName: 'Taylor Member', workDate: '2026-11-25', minutes: 60, note: 'Validated and corrected the release path' });
    expect(refreshed.worklogMinutes).toBe(60);

    await member.put(`/api/v1/projects/${projectId}/deliverables/${task.body._id}`).set('If-Match', String(refreshed.__v)).send({ ...task.body, dueDate: '2026-12-02' }).expect(200);
    await member.delete(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/comments/${comment.body._id}`).expect(204);
    await member.delete(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/worklogs/${worklog.body._id}`).expect(204);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    refreshed = snapshot.body.deliverables.find((value: any) => value._id === task.body._id);
    expect(refreshed).toMatchObject({ dueDate: '2026-12-02', worklogMinutes: 0, comments: [], worklogs: [] });

    await member.patch(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/status`).send({ status: 'done', version: refreshed.__v }).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    expect(snapshot.body.deliverables.find((value: any) => value._id === task.body._id)).toMatchObject({ status: 'done', completionDate: '2026-11-24' });
  }, 120_000);
});
