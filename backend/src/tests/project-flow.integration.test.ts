import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const integration = process.env.RUN_MONGO_INTEGRATION === '1' ? describe : describe.skip;

integration('member-bound project flow', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
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
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    const taylor = snapshot.body.members.find((value: any) => value.email === 'taylor@example.com');
    const task = await member.post(`/api/v1/projects/${projectId}/deliverables`).send({
      title: 'Ship integration flow', description: '', ticket: 'INT-1', towerId: tower.body._id, status: 'doing', priority: 'high',
      primaryAssigneeId: taylor._id, contributorIds: [], flagIds: [], startDate: '2026-11-24', dueDate: '2026-11-30',
      completionDate: null, deploymentDate: null, estimatedHours: 8, blocked: false, blockReason: '', toBeDeployed: false,
      plannedDeploymentDate: null, defects: 0, escapedDefects: 0, testsTotal: 0, testsAutomated: 0, automatedDeployment: false, hoursSaved: 0
    }).expect(201);

    await member.post(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/comments`).send({ text: 'Identity is preserved' }).expect(201);
    await member.post(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/worklogs`).send({ workDate: '2026-11-24', minutes: 45, note: 'Validated the release path' }).expect(201);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    const refreshed = snapshot.body.deliverables.find((value: any) => value._id === task.body._id);
    expect(refreshed.comments.at(-1).authorName).toBe('Taylor Member');
    expect(refreshed.worklogs[0]).toMatchObject({ authorName: 'Taylor Member', minutes: 45, note: 'Validated the release path' });

    await member.patch(`/api/v1/projects/${projectId}/deliverables/${task.body._id}/status`).send({ status: 'done', version: refreshed.__v }).expect(200);
    snapshot = await member.get(`/api/v1/projects/${projectId}/snapshot`).expect(200);
    expect(snapshot.body.deliverables.find((value: any) => value._id === task.body._id)).toMatchObject({ status: 'done', completionDate: '2026-11-24' });
  }, 120_000);
});
