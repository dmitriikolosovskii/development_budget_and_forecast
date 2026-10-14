import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

let projectId: string;

// Every test works on a copy of the demo project (PROTOCOL §7): the seed is never modified.
test.beforeEach(async ({ request }) => {
  const list = await request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const taucha = (
    (await list.json()) as Array<{ id: string; slug: string }>
  ).find((p) => p.slug === 'taucha-stadtvilla');
  expect(taucha).toBeDefined();
  const copy = await request.post(`/api/projects/${taucha?.id}/duplicate`, {
    data: { name: `Deliveries e2e ${Date.now()}` },
  });
  expect(copy.ok()).toBe(true);
  projectId = ((await copy.json()) as { project: { id: string } }).project.id;
});

async function upload(page: Page, file: string) {
  await page.getByLabel('CSV file').setInputFiles(path.join(FIXTURES, file));
  await expect(page.getByRole('table', { name: 'Preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Import' }).click();
  return page.getByTestId('import-result');
}

test('should show row errors for an invalid file and update Materials for a valid one [AC-10.7]', async ({
  page,
}) => {
  await page.goto(`/deliveries?project=${projectId}`);
  await expect(
    page.getByRole('heading', { name: 'Delivery tracking' }),
  ).toBeVisible();

  const invalid = await upload(page, 'deliveries-invalid.csv');
  await expect(invalid.getByText('2 imported')).toBeVisible();
  await expect(invalid.getByText('6 failed')).toBeVisible();
  const errors = invalid.getByRole('table', { name: 'Import errors' });
  await expect(errors.getByRole('row')).toHaveCount(7); // header + 6 errors (rows 1, 2, 3, 4, 6, 7)
  await expect(errors).toContainText('duplicate deliveryNoteNo');
  await expect(errors).toContainText('Unknown item code MAT-XXX-999');

  await page.goto(`/projects/${projectId}/materials/windows-doors`);
  const frontDoor = page.getByRole('row').filter({ hasText: 'MAT-WIN-002' });
  await expect(frontDoor).toBeVisible();
  await expect(frontDoor).not.toContainText('Delivered');

  await page.goto(`/deliveries?project=${projectId}`);
  const valid = await upload(page, 'deliveries-valid.csv');
  await expect(valid.getByText('6 imported')).toBeVisible();
  await expect(valid.getByRole('table', { name: 'Import errors' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('table', { name: 'Delivery log' })).toContainText(
    'LS-FWS-261014-01',
  );

  await valid.getByRole('link', { name: /MAT-WIN-002/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/materials/windows-doors`),
  );
  // React Router commits the new route in a transition: the URL changes before the Delivery page
  // leaves the DOM, so wait for the Materials section and look for the row only inside it.
  const windowsDoors = page.getByRole('region', {
    name: 'Windows, doors & stairs',
    exact: true,
  });
  await expect(windowsDoors).toBeVisible();
  await expect(
    windowsDoors.getByRole('row').filter({ hasText: 'MAT-WIN-002' }),
  ).toContainText('Delivered');
});

test('should change nothing when the same valid file is imported twice [AC-10.7]', async ({
  page,
  request,
}) => {
  await page.goto(`/deliveries?project=${projectId}`);
  await expect(await upload(page, 'deliveries-valid.csv')).toContainText(
    '6 imported',
  );
  const first = await (
    await request.get(`/api/projects/${projectId}/deliveries`)
  ).json();

  await page
    .getByLabel('CSV file')
    .setInputFiles(path.join(FIXTURES, 'deliveries-valid.csv'));
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByTestId('import-result')).toContainText('6 imported');

  const second = (await (
    await request.get(`/api/projects/${projectId}/deliveries`)
  ).json()) as unknown[];
  expect(second).toHaveLength((first as unknown[]).length);
});
