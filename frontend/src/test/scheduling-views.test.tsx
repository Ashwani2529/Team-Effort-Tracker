import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Calendar, Roster } from '../routes/Page';
import type { Deliverable, Snapshot } from '../types';

const task = {
  _id: 'task-1', __v: 0, title: 'Calendar delivery', flagIds: [], contributorIds: [], status: 'deployed', priority: 'high',
  startDate: '2026-11-23', dueDate: '2026-11-25', completionDate: '2026-11-26', deploymentDate: '2026-11-27', estimatedHours: 8,
  worklogMinutes: 0, comments: [], worklogs: [], statusHistory: [], createdAt: '2026-11-20', updatedAt: '2026-11-27'
} satisfies Deliverable;

const snapshot = {
  project: { _id: 'project-1', portfolioId: 'portfolio-1', name: 'Demo' }, towers: [], flags: [],
  members: [{ _id: 'member-1', name: 'Taylor Member', email: 'taylor@example.com' }, { _id: 'member-2', name: 'Other Member', email: 'other@example.com' }],
  deliverables: [task], leaves: [], rosterOverrides: [], activity: [], directory: [], notifications: [],
  access: { role: 'team', memberId: 'member-1', memberName: 'Taylor Member', memberEmail: 'taylor@example.com', adminVerified: false, sessionExpiresAt: Date.now() + 60_000 }, serverDate: '2026-11-24'
} satisfies Snapshot;

describe('calendar view', () => {
  it('highlights today, strikes finished work and opens date activity/tasks', () => {
    const openTask = vi.fn();
    const { container } = render(<Calendar snapshot={snapshot} items={[task]} openTask={openTask} projectId="project-1" role="team" month="2026-11" />);
    expect(screen.getByRole('button', { name: 'Open 2026-11-24' }).closest('.day-card')).toHaveClass('today');
    expect(container.querySelectorAll('.calendar-task.finished').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open 2026-11-26' }));
    expect(screen.getByText('Thursday, 26 November')).toBeInTheDocument();
    expect(screen.getByText(/Delivered · Deployed/)).toBeInTheDocument();
    fireEvent.click(container.querySelector('.calendar-task')!);
    expect(openTask).toHaveBeenCalledWith('task-1');
  });
});

describe('roster view', () => {
  it('allows a member to edit only their own date-specific shifts', () => {
    render(<QueryClientProvider client={new QueryClient()}><Roster snapshot={snapshot} items={[]} openTask={() => undefined} projectId="project-1" role="team" selectedDate="2026-11-24" /></QueryClientProvider>);
    expect(screen.getByLabelText('Taylor Member 2026-11-23 shift')).toBeEnabled();
    expect(screen.getByLabelText('Taylor Member 2026-11-23 shift')).toHaveValue('general');
    expect(screen.getByLabelText('Taylor Member 2026-11-28 shift')).toHaveValue('off');
    expect(screen.getByLabelText('Other Member 2026-11-23 shift')).toBeDisabled();
  });
});
