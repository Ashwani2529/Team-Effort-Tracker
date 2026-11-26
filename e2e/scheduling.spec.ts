import { expect, test } from '@playwright/test';

const task = {
  _id: 'task-1', __v: 0, title: 'Calendar delivery', description: 'Release activity', ticket: 'CAL-1', towerId: 'tower-1', flagIds: [], primaryAssigneeId: 'member-1', contributorIds: [],
  status: 'deployed', priority: 'high', startDate: '2026-11-23', dueDate: '2026-11-25', completionDate: '2026-11-26', deploymentDate: '2026-11-27',
  estimatedHours: 8, worklogMinutes: 120, parentDeliverableId: undefined, dependencyIds: [], comments: [], worklogs: [{ _id: 'worklog-1', memberId: 'member-2', authorName: 'Other Member', workDate: '2026-11-24', minutes: 120, note: 'Verified delivery work entered by another member', createdAt: '2026-11-24' }], statusHistory: [], createdAt: '2026-11-20', updatedAt: '2026-11-27'
};

const secondTask = {
  _id: 'task-2', __v: 0, title: 'Mobile API migration', description: 'Contains the FooBar substring for filtering', ticket: 'API-2', towerId: 'tower-2', flagIds: ['flag-1'], primaryAssigneeId: 'member-2', contributorIds: [],
  status: 'doing', priority: 'critical', startDate: '2026-12-08', dueDate: '2026-12-10', estimatedHours: 12, worklogMinutes: 0, parentDeliverableId: undefined, dependencyIds: [],
  comments: [], worklogs: [], statusHistory: [], createdAt: '2026-11-22', updatedAt: '2026-11-24'
};

const snapshot = {
  project: { _id: 'project-1', portfolioId: 'portfolio-1', name: 'Demo Project' },
  towers: [{ _id: 'tower-1', name: 'Platform', color: '#5b7cfa' }, { _id: 'tower-2', name: 'Applications', color: '#8b5cf6' }], flags: [{ _id: 'flag-1', name: 'Release', color: '#e6a740' }],
  members: [{ _id: 'member-1', name: 'Taylor Member', email: 'taylor@example.com', color: '#17865f' }, { _id: 'member-2', name: 'Other Member', email: 'other@example.com', color: '#8b5cf6' }],
  deliverables: [task, secondTask], leaves: [], rosterOverrides: [], activity: [], directory: [], notifications: [],
  access: { role: 'team', memberId: 'member-1', memberName: 'Taylor Member', memberEmail: 'taylor@example.com', adminVerified: false, sessionExpiresAt: Date.now() + 60_000 }, serverDate: '2026-11-24'
};

const analytics = {
  month: '2026-11', minMonth: '2026-10', maxMonth: '2026-11',
  today: { date: '2026-11-24', capacity: 16, logged: 2, availability: 14, overtime: 0, adjustedEffort: 1, availableMembers: 2, utilization: 12.5 },
  monthTotals: { capacity: 336, logged: 2, availability: 334, overtime: 0, adjustedEffort: 1, utilization: 0.6, estimatedEfforts: 20, remainingEffort: 12 },
  daily: [{ date: '2026-11-24', capacity: 16, logged: 2, availability: 14, overtime: 0, adjustedEffort: 1 }],
  members: [{ memberId: 'member-1', name: 'Taylor Member', capacity: 168, logged: 2, availability: 166, overtime: 0, todayCapacity: 8, todayLogged: 2, todayAvailability: 6, todayOvertime: 0, overPlanned: false }, { memberId: 'member-2', name: 'Other Member', capacity: 168, logged: 0, availability: 168, overtime: 0, todayCapacity: 8, todayLogged: 0, todayAvailability: 8, todayOvertime: 0, overPlanned: true }],
  burndown: [{ date: '2026-11-01', label: 'Start', ideal: 20, actual: 20, logged: 0, variance: 0 }, { date: '2026-11-30', label: 'Month end', ideal: 0, actual: 12, logged: 2, variance: 12 }]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path.endsWith('/projects')) { await route.fulfill({ json: [{ _id: 'project-1', portfolioId: 'portfolio-1', portfolioName: 'Demo Portfolio', name: 'Demo Project' }] }); return; }
    if (path.endsWith('/snapshot')) { await route.fulfill({ json: snapshot }); return; }
    if (path.endsWith('/analytics')) { const month = url.searchParams.get('month') || analytics.month; await route.fulfill({ json: { ...analytics, month, monthTotals: { ...analytics.monthTotals, logged: month === '2026-10' ? 5 : analytics.monthTotals.logged } } }); return; }
    if (request.method() === 'PUT' && path.includes('/roster/')) { await route.fulfill({ json: { _id: 'override-1', memberId: 'member-1', date: '2026-11-23', shiftId: 'night' } }); return; }
    await route.fulfill({ status: 204, body: '' });
  });
});

test('renders and operates the monthly task calendar', async ({ page }) => {
  await page.goto('/p/project-1/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(page.getByLabel('Calendar month')).toHaveValue('2026-11');
  await expect(page.getByRole('button', { name: 'Open 2026-11-24' })).toBeVisible();
  await expect(page.locator('.calendar-task.finished')).toHaveCount(5);
  await page.getByLabel('Calendar status').selectOption('deployed');
  await page.getByRole('button', { name: 'Open 2026-11-26' }).click();
  await expect(page.getByText('Thursday, 26 November')).toBeVisible();
  await page.locator('.calendar-task').first().click();
  await expect(page.getByRole('dialog')).toContainText('Calendar delivery');
});

test('renders roster permissions and sends a date-specific override', async ({ page }) => {
  await page.goto('/p/project-1/roster');
  await expect(page.getByRole('heading', { name: 'Shift Roster' })).toBeVisible();
  const own = page.getByLabel('Taylor Member 2026-11-23 shift');
  await expect(own).toBeEnabled();
  await expect(own).toHaveValue('general');
  await expect(page.getByLabel('Taylor Member 2026-11-28 shift')).toHaveValue('off');
  await expect(page.getByLabel('Other Member 2026-11-23 shift')).toBeDisabled();
  const requestPromise = page.waitForRequest((request) => request.method() === 'PUT' && request.url().includes('/roster/member-1/2026-11-23'));
  await own.selectOption('night');
  const request = await requestPromise;
  expect(request.postDataJSON()).toEqual({ status: 'night' });
});

test('keeps calendar, search, navigation and task drawer usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/p/project-1/calendar');

  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await expect(page.getByLabel('Calendar month')).toBeVisible();
  await expect(page.getByLabel('Calendar status')).toBeVisible();
  await expect(page.locator('.calendar-main')).toBeVisible();
  expect(await page.locator('.calendar-main').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.getByLabel('Search deliverables').fill('Calendar');
  await expect(page.locator('.search-results').getByText('Calendar delivery')).toBeVisible();
  await page.getByLabel('Search deliverables').fill('');

  await page.locator('.calendar-task').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox?.x).toBeGreaterThanOrEqual(0);
  expect(drawerBox?.width).toBeLessThanOrEqual(391);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.locator('.drawer-close').click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('link', { name: 'Shift Roster' })).toBeVisible();
  await page.getByRole('link', { name: 'Shift Roster' }).click();
  await expect(page.getByRole('heading', { name: 'Shift Roster' })).toBeVisible();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
});

test('keeps roster and timeline contained at tablet and narrow-phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/p/project-1/roster');

  const roster = page.locator('.table-wrap.roster');
  await expect(roster).toBeVisible();
  expect(await roster.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByLabel('Roster week')).toBeVisible();
  await expect(page.getByLabel('Taylor Member 2026-11-23 shift')).toBeEnabled();

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/p/project-1/timeline');
  const timeline = page.locator('.timeline-scroll');
  await expect(timeline).toBeVisible();
  expect(await timeline.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('contains every member workspace view and the project landing on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose a project' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  const views = [
    ['overview', 'Overview'], ['framework', 'Delivery Framework'], ['board', 'Board'], ['list', 'List'],
    ['assignees', 'Assignees'], ['timeline', 'Timeline'], ['calendar', 'Calendar'], ['team', 'Team'],
    ['roster', 'Shift Roster'], ['activity', 'Activity']
  ];
  for (const [route, heading] of views) {
    await page.goto(`/p/project-1/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), route).toBeLessThanOrEqual(1);
  }
});

test('preserves project navigation in browser back history', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Demo Project/ }).click();
  await expect(page).toHaveURL('/p/project-1/overview');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await expect(page).toHaveURL('/p/project-1/calendar');
  await page.goBack();
  await expect(page).toHaveURL('/p/project-1/overview');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Choose a project' })).toBeVisible();
});

test('filters the board by status, person and due date', async ({ page }) => {
  await page.goto('/p/project-1/board');
  await page.getByLabel('Board status filter').selectOption('doing');
  await page.getByLabel('Board person filter').selectOption('member-2');
  await page.getByLabel('Board due date filter').fill('2026-12-10');
  await expect(page.locator('.board-column')).toHaveCount(1);
  await expect(page.locator('.task-card')).toHaveCount(1);
  await expect(page.locator('.task-card')).toContainText('Mobile API migration');
  await expect(page.getByText('1 matching task')).toBeVisible();
});

test('filters the list by substring, tower, tag, member and due date', async ({ page }) => {
  await page.goto('/p/project-1/list');
  await page.getByLabel('List text filter').fill('oObAr');
  await page.getByLabel('List tower filter').selectOption('tower-2');
  await page.getByLabel('List tag filter').selectOption('flag-1');
  await page.getByLabel('List member filter').selectOption('member-2');
  await page.getByLabel('List due date filter').fill('2026-12-10');
  await expect(page.getByRole('button', { name: /Mobile API migration/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'critical' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Remaining' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Calendar delivery/ })).toHaveCount(0);
  await expect(page.getByText('1 matching item')).toBeVisible();
});

test('shows dynamic capacity, task relationships and four-week burndown', async ({ page }) => {
  await page.goto('/p/project-1/overview');
  await expect(page.getByText("Today's team effort and availability")).toBeVisible();
  await expect(page.getByText('14.0h', { exact: true })).toBeVisible();

  await page.goto('/p/project-1/calendar');
  await page.locator('.calendar-task').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Subtasks' })).toBeVisible();
  await drawer.getByLabel('Search dependencies').fill('Mobile API');
  await expect(drawer.getByText('Mobile API migration')).toBeVisible();

  await page.locator('.drawer-close').click();
  await page.goto('/p/project-1/activity');
  await expect(page.getByText('Team burndown')).toBeVisible();
  await expect(page.getByText('Four-week planned versus actual remaining effort')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('updates report charts, values and export scope when the month changes', async ({ page }) => {
  await page.route('**/api/v1/projects/project-1/snapshot', async (route) => route.fulfill({ json: { ...snapshot, access: { ...snapshot.access, role: 'admin', adminVerified: true } } }));
  await page.goto('/p/project-1/reports');
  await expect(page.getByText('Daily team effort and availability')).toBeVisible();
  await expect(page.getByText('Monthly effort by team member')).toBeVisible();
  await expect(page.getByText('November 2026')).toBeVisible();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByText('October 2026')).toBeVisible();
  await expect(page.getByText('5.0h', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Monthly effort CSV' })).toBeEnabled();
});

test('opens the same member statistics dialog from Team and Assignees', async ({ page }) => {
  await page.goto('/p/project-1/team');
  await page.locator('.team-card').filter({ hasText: 'Taylor Member' }).click();
  let dialog = page.getByRole('dialog', { name: 'Taylor Member' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1');
  await expect(dialog).toContainText('8.0h');
  await expect(dialog).toContainText('2.0h');
  await expect(dialog).toContainText('Total Estimated Efforts');
  await expect(dialog).toContainText('Deployed');
  await dialog.getByRole('button', { name: 'Close member statistics' }).click();

  await page.goto('/p/project-1/assignees');
  await page.locator('.person-card').filter({ hasText: 'Taylor Member' }).click();
  dialog = page.getByRole('dialog', { name: 'Taylor Member' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Verified work hours');
  await expect(dialog).toContainText('Upcoming deadlines');
});
