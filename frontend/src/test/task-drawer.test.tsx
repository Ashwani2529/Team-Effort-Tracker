import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TaskDrawer } from '../features/deliverables/TaskDrawer';
import type { Snapshot } from '../types';

const snapshot = {
  project: { _id: 'project-1', portfolioId: 'portfolio-1', name: 'Demo' },
  towers: [{ _id: 'tower-1', name: 'Platform', color: '#5b7cfa' }],
  flags: [{ _id: 'flag-1', name: 'Urgent', color: '#ef4444' }],
  members: [{ _id: 'member-1', name: 'Ashwani Singh', email: 'ashwani@example.com' }],
  deliverables: [{
    _id: 'task-1', __v: 0, title: 'Release API', description: 'Ship safely', ticket: 'API-1', towerId: 'tower-1', flagIds: ['flag-1'], primaryAssigneeId: 'member-1', contributorIds: [], status: 'doing', priority: 'high', startDate: '2026-11-01', dueDate: '2026-11-30', estimatedHours: 8, worklogMinutes: 45, comments: [], statusHistory: [], worklogs: [{ _id: 'work-1', memberId: 'member-1', authorName: 'Ashwani Singh', workDate: '2026-11-24', minutes: 45, note: 'Validated the deployment path', createdAt: '2026-11-24T10:00:00.000Z' }], createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-24T10:00:00.000Z'
  }],
  leaves: [], activity: [], directory: [], notifications: [], access: { role: 'team', memberId: 'member-1', memberName: 'Ashwani Singh', memberEmail: 'ashwani@example.com', adminVerified: false, sessionExpiresAt: Date.now() + 60_000 }, serverDate: '2026-11-24'
} satisfies Snapshot;

describe('deliverable details', () => {
  it('shows verified work as detail notes and removes deprecated task sections', () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/p/project-1/board']}><Routes><Route path="/p/:projectId/board" element={<TaskDrawer snapshot={snapshot} id="task-1" onClose={() => undefined} />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText('Verified work notes')).toBeInTheDocument();
    expect(screen.getByText('Validated the deployment path')).toBeInTheDocument();
    expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Effort/i }));
    expect(screen.getByText('Add verified worklog')).toBeInTheDocument();
    expect(screen.queryByText('Personal timer')).not.toBeInTheDocument();
  });
});
