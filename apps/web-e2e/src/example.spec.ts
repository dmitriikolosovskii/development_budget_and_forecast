import { test, expect } from '@playwright/test';

test('should render the app shell with navigation and the API status [AC-02.9]', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/projects$/);
  const banner = page.getByRole('banner');
  await expect(banner.getByText('Kairon Budget')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByText('Projects', { exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Delivery tracking' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Analytics' })).toBeVisible();
  await expect(banner.getByRole('status')).toBeVisible();
});
