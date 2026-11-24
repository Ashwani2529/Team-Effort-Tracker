import type { Server } from 'socket.io';
import { Member, Project } from '../models/index.js';
import { cookieValue, verifySessionToken } from '../middleware/auth.js';

export function configureSockets(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const session = verifySessionToken(cookieValue(socket.handshake.headers.cookie));
      if (!session) throw new Error('Project password required');
      const project = await Project.findById(session.projectId).lean();
      if (!project || project.archivedAt || project.passwordVersion !== session.passwordVersion) throw new Error('Project session expired');
      const member = await Member.exists({ _id: session.memberId, projectId: project._id, archivedAt: null });
      if (!member) throw new Error('Project membership required');
      socket.data.projectSession = session; next();
    } catch (error) { next(error as Error); }
  });
  io.on('connection', (socket) => {
    socket.on('project:join', async (projectId: string, reply?: (value: unknown) => void) => {
      if (socket.data.projectSession?.projectId !== projectId) { reply?.({ ok: false, error: 'forbidden' }); return; }
      await socket.join(`project:${projectId}`); reply?.({ ok: true });
    });
  });
}
