import { expect, test } from '@playwright/test';

const task = {
  _id: 'task-1', __v: 0, title: 'Calendar delivery', description: 'Release activity', ticket: 'CAL-1', towerId: 'tower-1', flagIds: [], primaryAssigneeId: 'member-1', contributorIds: [],
  status: 'deployed', priority: 'high', startDate: '2026-11-23', dueDate: '2026-11-25', completionDate: '2026-11-26', deploymentDate: '2026-11-27',
  estimatedHours: 8, worklogMinutes: 0, comments: [], worklogs: [], statusHistory: [], createdAt: '2026-11-20', updatedAt: '2026-11-27'
};

const snapshot = {
  project: { _id: 'project-1', portfolioId: 'portfolio-1', name: 'Demo Project' },
  towers: [{ _id: 'tower-1', name: 'Platform', color: '#5b7cfa' }], flags: [],
  members: [{ _id: 'member-1', name: 'Taylor Member', email: 'taylor@example.com', color: '#17865f' }, { _id: 'member-2', name: 'Other Member', email: 'other@example.com', color: '#8b5cf6' }],
  deliverables: [task], leaves: [], rosterOverrides: [], activity: [], directory: [], notifications: [],
  access: { role: 'team', memberId: 'member-1', memberName: 'Taylor Member', memberEmail: 'taylor@example.com', adminVerified: false, sessionExpiresAt: Date.now() + 60_000 }, serverDate: '2026-11-24'
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/projects')) { await route.fulfill({ json: [{ _id: 'project-1', portfolioId: 'portfolio-1', portfolioName: 'Demo Portfolio', name: 'Demo Project' }] }); return; }
    if (path.endsWith('/snapshot')) { await route.fulfill({ json: snapshot }); return; }
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
