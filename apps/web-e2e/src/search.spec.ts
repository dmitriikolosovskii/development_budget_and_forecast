import { test, expect } from '@playwright/test';

// Read-only journey: it never edits data, so it searches the seeded projects instead of a duplicate
// (duplicates from other specs pile up and must not be relied on to rank in the top 8).
test('should jump from ⌘K search to the highlighted heat pump row [AC-13.12]', async ({
  page,
}) => {
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'Search' });
  await expect(box).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(box).toBeFocused();
  await box.fill('AROTHERM');
  const items = page.getByRole('group', { name: 'Cost items' });
  await expect(items.getByRole('option').first()).toContainText('aroTHERM');
  await expect(items.getByRole('option').first().locator('mark')).toHaveText(
    'aroTHERM',
  );

  const optionIds = await page
    .getByRole('option')
    .evaluateAll((els) => els.map((el) => el.id));
  const firstItemId = await items
    .getByRole('option')
    .first()
    .getAttribute('id');
  for (let i = 0; i <= optionIds.indexOf(firstItemId ?? ''); i++)
    await box.press('ArrowDown');
  await box.press('Enter');

  await expect(page).toHaveURL(
    /\/projects\/[^/]+\/materials\/heating\?highlight=[^&]+$/,
  );
  const highlighted = page.locator('[data-highlighted]');
  await expect(highlighted).toBeVisible();
  await expect(highlighted).toContainText('aroTHERM');
});

test('should show "No results for …" for an unknown term on the results page [AC-13.12]', async ({
  page,
}) => {
  await page.goto('/search?q=zzqqxx');

  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  await expect(page.getByText('No results for “zzqqxx”')).toBeVisible();
});
