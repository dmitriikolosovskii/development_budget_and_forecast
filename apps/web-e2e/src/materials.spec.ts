import { expect, test, type Page } from '@playwright/test';

// Block 04 e2e (run by the integrator in the main tree). Works on a copy of the demo project.
let projectId = '';

async function duplicateDemo(page: Page): Promise<string> {
  const list = await page.request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = (
    (await list.json()) as Array<{ id: string; slug: string }>
  ).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo, 'seeded demo project taucha-stadtvilla').toBeTruthy();
  const copy = await page.request.post(`/api/projects/${demo?.id}/duplicate`, {
    data: { name: 'E2E materials copy' },
  });
  expect(copy.ok()).toBe(true);
  return ((await copy.json()) as { project: { id: string } }).project.id;
}

test.beforeEach(async ({ page }) => {
  projectId = await duplicateDemo(page);
});

test('should recalculate and persist an edited cable quantity, and open the supplier modal [AC-04.8]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/materials/electrical`);
  const table = page.getByRole('table', { name: 'Electrical' });
  // a PLANNED row: its forecast = planned, so the KPI moves (cfo-journey covers the PARTIAL NYM-J cable MAT-ELE-001)
  const cable = table.locator('tr', { hasText: 'MAT-ELE-008' });
  await expect(cable).toBeVisible();
  const total = page.getByTestId('section-planned');
  const forecastKpi = page
    .getByText('Forecast (EAC)')
    .first()
    .locator('xpath=following-sibling::dd[1]');
  const totalBefore = await total.textContent();
  const forecastBefore = await forecastKpi.textContent();

  await cable
    .getByRole('button', { name: 'Edit quantity MAT-ELE-008' })
    .click();
  const input = cable.getByRole('textbox', { name: 'quantity MAT-ELE-008' });
  await input.fill('20');
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' && r.url().includes('/items/') && r.ok(),
  );
  await input.press('Enter');

  await expect(total).not.toHaveText(totalBefore ?? '');
  await expect(forecastKpi).not.toHaveText(forecastBefore ?? '');
  await expect(
    cable.getByRole('button', { name: 'Edit quantity MAT-ELE-008' }),
  ).toHaveText('20 pcs');
  await saved;

  await page.reload();
  await expect(
    page
      .getByRole('table', { name: 'Electrical' })
      .locator('tr', { hasText: 'MAT-ELE-008' })
      .getByRole('button', { name: 'Edit quantity MAT-ELE-008' }),
  ).toHaveText('20 pcs');

  const reloadedCable = page
    .getByRole('table', { name: 'Electrical' })
    .locator('tr', { hasText: 'MAT-ELE-001' });
  const supplier = reloadedCable
    .locator('td')
    .nth(8)
    .getByRole('button')
    .first();
  await supplier.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('a[href^="tel:"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
