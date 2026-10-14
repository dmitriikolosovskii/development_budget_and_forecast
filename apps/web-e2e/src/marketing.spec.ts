import { expect, test } from '@playwright/test';

// Block 09: the Marketing tab on a copy of the seeded demo project (PROTOCOL §7). Run by the integrator.
// Demo "today" is 2026-10-14 (__DEMO_TODAY__).
let projectId: string;

test.beforeEach(async ({ request }) => {
  const list = await request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = (
    (await list.json()) as Array<{ id: string; slug: string }>
  ).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo).toBeDefined();
  const copy = await request.post(`/api/projects/${demo?.id}/duplicate`, {
    data: { name: 'E2E marketing copy' },
  });
  expect(copy.ok()).toBe(true);
  projectId = ((await copy.json()) as { project: { id: string } }).project.id;
});

test('should edit paid search, see the channel mix move and keep the value after a reload', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/marketing/paid-search`);

  const nav = page.getByRole('navigation', { name: 'Marketing channels' });
  await expect(nav.getByRole('button')).toHaveCount(8);
  const legend = page
    .getByRole('list', { name: 'Channel mix legend' })
    .getByRole('listitem', { name: 'Paid search' });
  await expect(legend).toContainText('€2,700');

  await page
    .getByRole('button', { name: 'Edit Unit price SRV-SEA-001' })
    .click();
  const input = page.getByRole('textbox', { name: 'Unit price SRV-SEA-001' });
  await input.fill('3,600.00');
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes('/items/'),
  );
  await input.press('Enter');
  await expect(legend).toContainText('€3,600');
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Edit Unit price SRV-SEA-001' }),
  ).toHaveText('€3,600.00');
});

test('should show running campaigns, the share badge and the agency modal', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/marketing/visuals`);

  const renders = page.getByRole('row').filter({ hasText: 'SRV-VIS-001' });
  await expect(renders.getByText('Running now')).toBeVisible();
  await expect(
    page.getByLabel('Marketing share').getByText('Within 5%'),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Campaigns by month' }),
  ).toBeVisible();

  await renders
    .getByRole('button', { name: 'Nordlicht Immobilienmarketing GmbH' })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Paul Hartig')).toBeVisible();
});
