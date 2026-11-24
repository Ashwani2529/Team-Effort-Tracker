import { expect, test } from '@playwright/test';
test('renders the project password landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Effort Tracker', { exact: true })).toBeVisible();
  await expect(page.getByText(/Choose a project|Loading projects|Workspace unavailable/)).toBeVisible();
  const developer = page.getByRole('link', { name: 'Open developer portfolio' });
  await expect(developer).toBeVisible();
  await expect(developer).toHaveAttribute('href', 'https://ashwanisingh-portfolio.netlify.app');
});
