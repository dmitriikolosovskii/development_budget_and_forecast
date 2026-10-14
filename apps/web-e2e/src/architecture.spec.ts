import { expect, test, type Page } from '@playwright/test';

// Block 08 e2e (run by the integrator in the main tree). Works on a copy of the demo project.
let projectId = '';

async function duplicateDemo(page: Page): Promise<string> {
  const list = await page.request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = ((await list.json()) as Array<{ id: string; slug: string }>).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo, 'seeded demo project taucha-stadtvilla').toBeTruthy();
  const copy = await page.request.post(`/api/projects/${demo?.id}/duplicate`, { data: { name: 'E2E architecture copy' } });
  expect(copy.ok()).toBe(true);
  return ((await copy.json()) as { project: { id: string } }).project.id;
}

test.beforeEach(async ({ page }) => {
  projectId = await duplicateDemo(page);
});

test('should show the house plan with 143.65 m² living area, 6 GF and 8 UF rooms and the site plan', async ({ page }) => {
  await page.goto(`/projects/${projectId}/architecture`);

  await expect(page.getByTestId('living-area')).toHaveText('143.65 m²');
  await expect(page.getByTestId(/^room-GF-/)).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Living + dining 33.0 m²' })).toBeVisible();
  await page.getByRole('tab', { name: 'Upper floor' }).click();
  await expect(page.getByTestId(/^room-UF-/)).toHaveCount(8);
  await expect(page.getByTestId('setbacks')).toHaveText('Street 4.0 m · Rear 7.0 m · Left 8.0 m · Right 8.0 m');
  await expect(page.getByText('House extends outside the plot')).toHaveCount(0);
});

test('should move the linked Building materials row when a BOQ quantity is edited, and keep it after reload', async ({ page }) => {
  await page.goto(`/projects/${projectId}/architecture`);
  await page.getByRole('tab', { name: 'Electrical' }).click();

  await page.getByRole('button', { name: 'Edit qty BOQ-ELE-001' }).click();
  await page.getByRole('textbox', { name: 'qty BOQ-ELE-001' }).fill('1400');
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes('/plan/components/') && r.status() === 200,
  );
  await page.getByRole('textbox', { name: 'qty BOQ-ELE-001' }).press('Enter');
  const body = (await (await saved).json()) as { updatedItemIds: string[] };
  expect(body.updatedItemIds).toHaveLength(1);

  const snapshot = await page.request.get(`/api/projects/${projectId}`);
  const items = ((await snapshot.json()) as { items: Array<{ code: string; qtyMilli: number }> }).items;
  expect(items.find((i) => i.code === 'MAT-ELE-001')?.qtyMilli).toBe(1_400_000);

  await page.reload();
  await page.getByRole('tab', { name: 'Electrical' }).click();
  await expect(page.getByRole('button', { name: 'Edit qty BOQ-ELE-001' })).toContainText('1,400');
});

test('should warn about overlapping rooms but still save the change', async ({ page }) => {
  await page.goto(`/projects/${projectId}/architecture`);
  await page.getByTestId('room-GF-KIT').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('X from the left wall (cm)').fill('500');
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes('/plan/rooms/') && r.status() === 200,
  );
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Living + dining overlaps Kitchen')).toBeVisible();
  await saved;
  await page.reload();
  await expect(page.getByText('Living + dining overlaps Kitchen')).toBeVisible();
});
