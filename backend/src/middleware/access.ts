import type { NextFunction, Request, Response } from 'express';
import { can, type Capability } from '@effort-tracker/shared';
import { Member, Project } from '../models/index.js';
import { sessionFromRequest } from './auth.js';

export async function projectAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project || project.archivedAt) { res.status(404).json({ error: 'project_not_found' }); return; }
    const session = await sessionFromRequest(req);
    if (!session || session.projectId !== String(project._id) || session.passwordVersion !== project.passwordVersion) {
      res.status(401).json({ error: 'project_password_required', message: 'Enter your registered email and the shared Team password to continue.' }); return;
    }
    const member = await Member.findOne({ _id: session.memberId, projectId: project._id, archivedAt: null }).lean();
    if (!member) { res.status(403).json({ error: 'member_not_added', message: 'You are not an active member of this project. Ask an Admin to add your email.' }); return; }
    req.access = { organizationId: String(project.organizationId), portfolioId: String(project.portfolioId), projectId: String(project._id), role: session.role, memberId: String(member._id), memberName: member.name, memberEmail: member.email, adminVerified: session.adminVerified, sessionExpiresAt: session.expiresAt };
    next();
  } catch (error) { next(error); }
}

export const requireCapability = (capability: Capability) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.access || !can(req.access.role, capability)) { res.status(403).json({ error: 'admin_mode_required', capability, message: 'Switch to Admin mode to use this feature.' }); return; }
  next();
};
