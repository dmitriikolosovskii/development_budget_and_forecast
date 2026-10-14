import { expect, test, type Page } from '@playwright/test';

// Block 07 e2e (run by the integrator in the main tree). Works on a copy of the demo project.
let projectId = '';

async function duplicateDemo(page: Page): Promise<string> {
  const list = await page.request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = (
    (await list.json()) as Array<{ id: string; slug: string }>
  ).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo, 'seeded demo project taucha-stadtvilla').toBeTruthy();
  const copy = await page.request.post(`/api/projects/${demo?.id}/duplicate`, {
    data: { name: 'E2E land copy' },
  });
  expect(copy.ok()).toBe(true);
  return ((await copy.json()) as { project: { id: string } }).project.id;
}

test.beforeEach(async ({ page }) => {
  projectId = await duplicateDemo(page);
});

test('should raise the soil risk badge when groundwater is set to 150 cm and keep it after reload [AC-07.11]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/land`);
  const soil = page.getByRole('region', { name: 'Soil' });
  // The seeded plot has groundwater at 7 m and soil class 4: no risk before the edit.
  await expect(soil.getByText('Soil OK', { exact: true })).toBeVisible();
  await expect(soil.getByText('Soil risk', { exact: true })).toHaveCount(0);

  await soil
    .getByRole('button', { name: 'Edit Groundwater depth (cm)' })
    .click();
  const input = soil.getByRole('textbox', { name: 'Groundwater depth (cm)' });
  await input.fill('150');
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      r.url().endsWith(`/api/projects/${projectId}/land`) &&
      r.ok(),
  );
  await input.press('Enter');

  await expect(soil.getByText('Soil risk', { exact: true })).toBeVisible();
  await saved;

  await page.reload();
  const soilAfter = page.getByRole('region', { name: 'Soil' });
  await expect(soilAfter.getByText('Soil risk', { exact: true })).toBeVisible();
  await expect(
    soilAfter.getByRole('button', { name: 'Edit Groundwater depth (cm)' }),
  ).toHaveText('150 cm');
  await expect(soilAfter.getByText('Soil OK', { exact: true })).toHaveCount(0);
});
